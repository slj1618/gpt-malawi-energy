import { OpenAIEmbeddings } from "@langchain/openai";
import { config } from "dotenv";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
// import { graph } from "./graphRagModel_001";
config({ path: ".env.local" });

const openAIApiKey = process.env.OPENAI_API_KEY;
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

const embeddings = new OpenAIEmbeddings({
  // model: "text-embedding-ada-002", // or another embedding model
  model: "text-embedding-3-small", // or another embedding model
  openAIApiKey: openAIApiKey,
});

//  GENERAL RETRIEVER

const retrievalQuery = `
RETURN
  node.text AS text,
  score,
  node { .source, .parentId, element_id: elementId(node) } AS metadata
`;

const retrievalNodeQuery = `
RETURN
  node.id AS text,
  score,
  node { .name } AS metadata
`;

const retrievalCommunityQuery = `
RETURN
  node.top_terms AS subjects,
  score,
  node { .communityId, element_id: elementId(node) } AS metadata
`;

const retrievalSummaryQuery = `
RETURN
  node.summary AS text,
  score,
  node { .path, .date_of_issue, element_id: elementId(node)} AS metadata
`;

const vectorStore = await Neo4jVectorStore.fromExistingGraph(embeddings, {
  url: NEO4J_URI,
  username: NEO4J_USERNAME,
  password: NEO4J_PASSWORD,
  indexName: "chunkEmbeddingIndex",
  nodeLabel: "Chunk",
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
  indexName: "entityEmbeddingIdIndex",
  nodeLabel: "__Entity__",
  textNodeProperties: ["name", "id"],
  embeddingNodeProperty: "embedding_id",
  retrievalQuery: retrievalNodeQuery,
  searchType: "vector",
});

const vectorCommunityStore = await Neo4jVectorStore.fromExistingGraph(
  embeddings,
  {
    url: NEO4J_URI,
    username: NEO4J_USERNAME,
    password: NEO4J_PASSWORD,
    indexName: "communityEmbeddingIdx",
    nodeLabel: "Community",
    textNodeProperties: ["top_terms"],
    embeddingNodeProperty: "embedding_top_terms",
    retrievalQuery: retrievalCommunityQuery,
    searchType: "vector",
  }
);

const vectorSummaryStore = await Neo4jVectorStore.fromExistingGraph(
  embeddings,
  {
    url: NEO4J_URI,
    username: NEO4J_USERNAME,
    password: NEO4J_PASSWORD,
    indexName: "summaryEmbeddingIdx",
    nodeLabel: "Document",
    textNodeProperties: ["summary"],
    embeddingNodeProperty: "embedding_summary",
    retrievalQuery: retrievalSummaryQuery,
    searchType: "vector",
  }
);

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
    k = 7,
    threshold = 0.8,
    minKeep = 2,
    unique = true,
    maxChars = null,
    // useScores = false,
    assumeSimilarity = true,
    log = false,
  } = {}
) {
  const question = normalizeQuestion(inp);
  // const question_embedding = await embeddings.embedQuery(question);
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

  // const cypher = `
  // CALL {
  //   CALL db.index.vector.queryNodes(
  //     'entityEmbeddingIdIndex', toInteger($k), $question_embedding
  //   )
  //   YIELD node, score

  //   // turn the node into a map of its props, minus embedding_id
  //   WITH apoc.map.removeKey(properties(node), 'embedding_id') AS nodeProps,
  //       score
  //   RETURN nodeProps AS node, score
  // }

  // WITH node, max(score) AS score
  // ORDER BY score DESC
  // LIMIT toInteger($k)
  // RETURN node;
  // `;
  // const hybrid_search = graph.query(cypher, {
  //   question_embedding,
  //   // question,
  //   k,
  // });

  return final.map((f) => f.text);
  // return (await hybrid_search).map((f) => f.text); // final.map((f) => f.text);
}

async function retrieverUnstructured(q, k = 15) {
  return vectorStore.similaritySearch(q, k); // Document[]
}

export {
  embeddings,
  retrieverGraph,
  retrieverNodeGraph,
  vectorNodeStore,
  vectorStore,
  vectorCommunityStore,
  vectorSummaryStore,
  retrieverUnstructured,
  retrieverEntity,
};
