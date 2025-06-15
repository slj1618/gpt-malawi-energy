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
