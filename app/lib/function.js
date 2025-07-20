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
export function fuseParallelOutputs(data, { k = 60 } = {}) {
  let perQ = Array.isArray(data?.per_question_docs)
    ? data.per_question_docs.flatMap((q) =>
        Array.isArray(q.hits) ? q.hits : []
      )
    : [];
  const plain = data?.plain_retrieval?.hits ?? [];
  // Normalize perQ to list[list[Document]]
  if (Array.isArray(perQ) && perQ.length > 0 && !Array.isArray(perQ[0])) {
    perQ = [perQ];
  }

  const rankedLists = [
    ...perQ,
    ...(plain && plain.length ? [plain] : []),
  ].filter((arr) => Array.isArray(arr) && arr.length);

  const finalList = reciprocalRankFusion(rankedLists, { k });

  return finalList;
}
