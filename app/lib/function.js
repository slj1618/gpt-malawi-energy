export function combineDocuments(docs) {
  return docs.map((doc) => doc.pageContent).join("\n\n");
}

export function splitQuestions(text) {
  return text
    .split(/\?\s*/g) // break after every “?”
    .map((q) => q.trim()) // remove stray whitespace
    .filter(Boolean) // drop empty entries
    .map((q) => q + " ?"); // add the “?” back
}

export function reciprocalRankFusion(rankedLists, { k = 60 } = {}) {
  const fusedScores = new Map(); // key -> score
  const docStore = new Map(); // key -> representative doc

  for (const list of rankedLists) {
    if (!Array.isArray(list)) continue;
    let rank = 0;
    for (const doc of list) {
      // Support either LangChain Document or generic object
      const metadata = doc?.metadata ?? doc?.meta ?? {};
      if (!metadata || metadata.source == null) continue;

      // Build key (tweak for your uniqueness needs: add element_id, id, etc.)
      const key = JSON.stringify({
        source: metadata.source,
        // include snippet or id to reduce collisions:
        id: metadata.element_id || metadata.id || metadata.uuid || undefined,
        text: doc.pageContent || doc.text || "",
      });

      // Fused score increment
      const prev = fusedScores.get(key) || 0;
      fusedScores.set(key, prev + 1 / (rank + k));
      // Store doc (first time is fine; you could decide to store best version)
      if (!docStore.has(key)) docStore.set(key, doc);

      rank += 1;
    }
  }

  // Sort descending by fused score
  const fusedArray = Array.from(fusedScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, score]) => [docStore.get(key), score]);

  return fusedArray; // Array<[Document, number]>
}

/**
 * fuseParallelOutputs
 * Combine per_question_docs + plain_retrieval then apply RRF.
 * Input shape:
 * {
 *   per_question_docs: list[list[Document]] OR list[Document],
 *   plain_retrieval:   list[Document]
 * }
 */

function nullyfier(score) {
  const s = score - score;
  if (s === 0) return;
  else return;
}

export function fuseParallelOutputs(data, { k = 60 } = {}) {
  // ---------- original preparation ----------
  let perQ = Array.isArray(data?.per_question_docs)
    ? data.per_question_docs.flatMap((q) =>
        Array.isArray(q.hits) ? q.hits : []
      )
    : [];

  const plain = data?.plain_retrieval?.hits ?? [];

  // Ensure perQ is an array of arrays
  if (Array.isArray(perQ) && perQ.length > 0 && !Array.isArray(perQ[0])) {
    perQ = [perQ];
  }

  const rankedLists = [
    ...perQ,
    ...(plain && plain.length ? [plain] : []),
  ].filter((arr) => Array.isArray(arr) && arr.length);

  const fused = reciprocalRankFusion(rankedLists, { k });

  // ---------- NEW: strip everything except text & source ----------
  return fused.map(([doc /* hit object */, _score]) => ({
    // (optional) ‑‑ remove the PDF‑location HTML comment if you don’t want it
    text:
      (doc.text || doc.pageContent || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim() + nullyfier(_score),
    source: doc.metadata?.source ?? null,
    date: doc.metadata?.date ?? null,
  }));
}

// Summary Entry
export function filterDocsByScore(docsAndScores, threshold) {
  if (!Array.isArray(docsAndScores) || docsAndScores.length === 0) {
    return [];
  }

  // Filter documents with score >= threshold
  const filtered = docsAndScores
    .filter((pair) => pair[1] >= threshold) // pair[0] doc, pair[1] score
    .map((pair) => pair[0]);

  if (filtered.length > 0) {
    return filtered;
  }

  // If none pass, return the top scoring document only
  const sorted = docsAndScores.slice().sort((a, b) => b[1] - a[1]);

  return [sorted[0][0]];
}

export function selectChunksByRecency(records, k) {
  if (!Array.isArray(records) || k <= 0) return [];

  // Flatten all chunks from all records
  const allChunks = records.flatMap((record) => record.combined_chunks || []);

  if (allChunks.length === 0) return [];

  // Helper to parse year string into a Date object
  function parseYear(chunk) {
    if (!chunk.year) return new Date(1900, 0, 1); // fallback very old date
    // Try full date first
    let date = new Date(chunk.year);
    if (isNaN(date.getTime())) {
      // fallback to just year (e.g., "2023")
      date = new Date(`${chunk.year}-01-01`);
      if (isNaN(date.getTime())) {
        // still invalid
        return new Date(1900, 0, 1);
      }
    }
    return date;
  }

  // Sort chunks descending by year (most recent first)
  allChunks.sort((a, b) => parseYear(b) - parseYear(a));

  // Get unique years (dates), sorted descending
  const uniqueYears = [
    ...new Set(allChunks.map((c) => parseYear(c).getTime())),
  ].sort((a, b) => b - a);

  // Median year timestamp
  const medianIdx = Math.floor(uniqueYears.length / 2);
  const medianYearTime = uniqueYears[medianIdx];

  // Split chunks by median year
  const recentChunks = allChunks.filter(
    (c) => parseYear(c).getTime() >= medianYearTime
  );
  const olderChunks = allChunks.filter(
    (c) => parseYear(c).getTime() < medianYearTime
  );

  // Calculate counts
  const recentCount = Math.ceil(k * 0.8);
  const olderCount = k - recentCount;

  // Select chunks
  let selected = recentChunks
    .slice(0, recentCount)
    .concat(olderChunks.slice(0, olderCount));

  // Fill missing from other group if needed
  if (selected.length < k) {
    const needed = k - selected.length;
    if (recentChunks.length > recentCount) {
      selected = selected.concat(
        recentChunks.slice(recentCount, recentCount + needed)
      );
    } else if (olderChunks.length > olderCount) {
      selected = selected.concat(
        olderChunks.slice(olderCount, olderCount + needed)
      );
    }
  }

  return selected.slice(0, k);
}

export function fuseParallelSummaryOutputs(data, { k = 60 } = {}) {
  // ---------- original preparation ----------
  // console.log("data: ", data.per_question_docs);
  let perQ = Array.isArray(data?.per_question_docs)
    ? data.per_question_docs.flatMap((q) =>
        Array.isArray(q.hits) ? q.hits : []
      )
    : [];

  const plain = data?.plain_retrieval?.hits ?? [];

  // Ensure perQ is an array of arrays
  if (Array.isArray(perQ) && perQ.length > 0 && !Array.isArray(perQ[0])) {
    perQ = [perQ];
  }

  const rankedLists = [
    ...perQ,
    ...(plain && plain.length ? [plain] : []),
  ].filter((arr) => Array.isArray(arr) && arr.length);

  const fused = reciprocalRankFusion(rankedLists, { k });

  const f = fused.map(([doc /* hit object */, _score]) => ({
    // (optional) ‑‑ remove the PDF‑location HTML comment if you don’t want it
    text:
      (doc.text || doc.pageContent || "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .trim() + nullyfier(_score),
    source: doc.metadata?.source ?? null,
    year: doc.metadata?.year ?? null,
  }));

  // ---------- NEW: strip everything except text & source ----------
  return f;
}
