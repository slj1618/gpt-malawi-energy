import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "dotenv";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
config({ path: ".env.local" });

const openAIApiKey = process.env.OPENAI_API_KEY;
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-ada-002", // or another embedding model
  openAIApiKey: openAIApiKey,
});

//  GENERAL RETRIEVER

const retrievalQuery = `
RETURN
  node.text AS text,
  score,
  node { .source, .parentId, element_id: elementId(node) } AS metadata
`;

// const retrievalNodeQuery = `
// RETURN
//   node.text AS text
// `;

const vectorStore = await Neo4jVectorStore.fromExistingGraph(embeddings, {
  url: NEO4J_URI,
  username: NEO4J_USERNAME,
  password: NEO4J_PASSWORD,
  indexName: "doc_chunk_embedding_index",
  nodeLabel: "DocumentChunk",
  textNodeProperties: ["text"],
  embeddingNodeProperty: "embedding",
  retrievalQuery,
  searchType: "vector",
});

const retrieverGraph = vectorStore.asRetriever({ k: 20 });

// NODE RETRIEVER

const vectorNodeStore = await Neo4jVectorStore.fromExistingGraph(embeddings, {
  url: NEO4J_URI,
  username: NEO4J_USERNAME,
  password: NEO4J_PASSWORD,
  indexName: "node_Retriever_index",
  nodeLabel: "Retriever",
  textNodeProperties: ["text"],
  embeddingNodeProperty: "embedding",
  retrievalQuery,
  searchType: "vector",
});

const retrieverNodeGraph = vectorNodeStore.asRetriever({ k: 20 });

function normalizeQuestion(inp) {
  if (!inp) return "";
  if (typeof inp === "string") return inp;
  if (typeof inp === "object") {
    if ("question" in inp && typeof inp.question === "string")
      return inp.question;
    if ("content" in inp && typeof inp.content === "string") return inp.content;
  }
  return String(inp);
}

async function retrieverEntity(
  inp,
  {
    k = 15,
    threshold = 0.9,
    minKeep = 3,
    unique = true,
    maxChars = null,
    useScores = false,
    assumeSimilarity = true,
    log = false,
  } = {}
) {
  const question = normalizeQuestion(inp);
  let withScores;

  if (vectorNodeStore.similaritySearchWithScore) {
    withScores = await vectorNodeStore.similaritySearchWithScore(question, k);
  } else {
    const docs = await vectorNodeStore.similaritySearch(question, k);
    withScores = docs.map((d) => [d, 1.0]);
  }

  const passCondition = (score) =>
    assumeSimilarity ? score >= threshold : score <= threshold;

  let passed = withScores.filter(([, score]) => passCondition(score));

  if (passed.length < minKeep) {
    const sorted = [...withScores].sort((a, b) =>
      assumeSimilarity ? b[1] - a[1] : a[1] - b[1]
    );
    passed = sorted.slice(0, Math.min(minKeep, sorted.length));
  }

  const seen = new Set();
  const final = [];

  for (const [doc, score] of passed) {
    let text = (doc.pageContent || "").trim();
    if (!text) continue;
    if (maxChars && text.length > maxChars) {
      text = text.slice(0, maxChars).trimEnd() + "…";
    }
    if (unique) {
      if (seen.has(text)) continue;
      seen.add(text);
    }
    final.push({ text, score });
  }

  if (log) {
    console.log(
      `[retrieverEntity] query="${question}" raw=${withScores.length} kept=${final.length} threshold=${threshold} similarityMode=${assumeSimilarity}`
    );
  }

  return useScores ? final : final.map((f) => f.text);
}

async function retrieverUnstructured(q, k = 20) {
  return vectorStore.similaritySearch(q, k); // Document[]
}

export {
  retrieverGraph,
  retrieverNodeGraph,
  vectorNodeStore,
  vectorStore,
  retrieverUnstructured,
  retrieverEntity,
};
