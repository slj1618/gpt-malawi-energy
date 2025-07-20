// luceneQuery.js

// Lucene meta characters that must be escaped
const LUCENE_SPECIAL = '+-&|!(){}[]^"~*?:\\/'; // same set as Python (note: backslash escaped in string)

// Build a regex that captures any special char (like the Python re.compile([...]))
const LUCENE_ESCAPE_RE = new RegExp(
  `([${LUCENE_SPECIAL.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}])`,
  "g"
);

/**
 * Escape or quote a single token so Lucene won't throw TokenMgrError.
 * If the token contains a space, wrap in quotes; else escape special chars.
 * @param {string} token
 * @returns {string}
 */
export function luceneSafe(token) {
  if (!token) return "";
  return token.includes(" ")
    ? `"${token}"`
    : token.replace(LUCENE_ESCAPE_RE, "\\$1");
}

/**
 * Build a Lucene query string for Neo4j full-text search.
 * Each token becomes <escaped>~<fuzz> joined with AND.
 * @param {string} text
 * @param {number} fuzz (Levenshtein edit distance for FTS) default 2
 * @returns {string}
 *
 * Example:
 *   generateFullTextQuery("Ethanol/Paraffin cookstoves")
 *   => Ethanol\\/Paraffin~2 AND cookstoves~2
 */
export function generateFullTextQuery(raw, fuzz = 2) {
  if (!raw) return "";

  let text;

  if (typeof raw === "string") {
    text = raw;
  } else if (typeof raw === "object") {
    // Try common fields
    text = raw.text ?? raw.value ?? raw.name ?? raw.id ?? JSON.stringify(raw); // last resort (maybe not ideal)
  } else {
    text = String(raw);
  }

  text = text.trim();
  if (!text) return "";

  const tokens = text.split(/\s+/).filter(Boolean);
  const escaped = tokens.map((tok) => `${luceneSafe(tok)}~${fuzz}`);
  return escaped.join(" AND ");
}
