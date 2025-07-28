// Filename: optimizedPipeline.ts

import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { embeddings, vectorSummaryStore } from "./graphRetriever";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  filterDocsByScore,
  fuseParallelSummaryOutputs,
  selectChunksByRecency,
  splitQuestions,
} from "./function";
import { config } from "dotenv";
import {
  finalGraphTemplate,
  multiQueryGraphTemplate,
  standAloneQuestionTemplate,
} from "../const/templates";
import { ChatOpenAI } from "@langchain/openai";

config({ path: ".env.local" });

// --- Neo4j Graph without APOC ---
class NoApocGraph extends Neo4jGraph {
  async refreshSchema() {
    /* skip APOC schema discovery */
  }
  static async initialize(config) {
    const graph = new NoApocGraph(config);
    await graph.verifyConnectivity();
    return graph;
  }
}

// Initialize Neo4j graph
const graph = await NoApocGraph.initialize({
  url: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: process.env.NEO4J_PASSWORD,
  database: process.env.NEO4J_DATABASE,
});

// --- LLMs Setup ---
const llmFast = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

const llmFinal = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const llmCreative = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0.35,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

// --- Embedding Cache (in-memory, can be replaced by Redis/memcached) ---
const embeddingCache = {};

// --- Utility: Get or cache embedding ---
async function getCachedEmbedding(query) {
  if (embeddingCache[query]) return embeddingCache[query];
  const embedding = await embeddings.embedQuery(query);
  embeddingCache[query] = embedding;
  return embedding;
}

// --- Modularized Cypher Query for Neo4j Retrieval ---
const CYPHER_QUERY = `
CALL {
  CALL db.index.vector.queryNodes('chunkEmbeddingIndex', $limit, $embedding) YIELD node, score
  WITH collect({node: node, score: score}) AS nodes, max(score) AS maxScore
  UNWIND nodes AS n
  RETURN n.node AS node, (n.score / maxScore) AS normalizedScore
}
WITH node, normalizedScore
ORDER BY normalizedScore DESC
LIMIT $limit
MATCH (node)-[:FROM_DOCUMENT]->(doc:Document)
RETURN collect({ text: node.text, year: doc.date_of_issue, source: doc.path }) AS chunks
`;

// --- Retriever with batching, caching & dynamic k control ---
async function batchRetriever(questions, k = 10, maxBatchSize = 5) {
  // Process in batches if too large
  const results = [];
  for (let i = 0; i < questions.length; i += maxBatchSize) {
    const batch = questions.slice(i, i + maxBatchSize);

    // Get embeddings in batch
    const embeddingsBatch = await Promise.all(batch.map(getCachedEmbedding));

    // Run retrieval queries in parallel
    const retrievals = await Promise.all(
      embeddingsBatch.map(async (embedding, idx) => {
        // Query Neo4j with dynamic k scaled by query length (example heuristic)
        const limit = Math.min(k * 5, 50);

        const records = await graph.query(CYPHER_QUERY, {
          limit,
          embedding,
        });

        // Post-process chunks by recency or other heuristics
        const chunks = selectChunksByRecency(records[0]?.chunks || [], 15);

        const filteredDocs = chunks.map((chunk) => ({
          text: chunk.text,
          metadata: {
            source: chunk.source,
            year: chunk.year,
          },
        }));

        return {
          question: batch[idx],
          hits: filteredDocs,
        };
      })
    );

    results.push(...retrievals);
  }

  return results;
}

// --- Prompt templates ---
const standAloneQuestionPrompt = ChatPromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);
const multiQueryPrompt = ChatPromptTemplate.fromTemplate(
  multiQueryGraphTemplate
);
const finalPrompt = ChatPromptTemplate.fromTemplate(finalGraphTemplate);

// --- Runnables ---

// Standalone question chain with fast LLM and parsing
const standaloneChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) => input.chat_history,
  },
  standAloneQuestionPrompt,
  llmFast,
  new StringOutputParser(),
]);

// Extract multiple questions from raw input
const extractQuestionsRunnable = new RunnableLambda({
  func: async (raw) => splitQuestions(raw),
});

// Multi-query chain: format prompt, run creative LLM, parse output, then retrieve context for each question in batch
const multiQueryChain = new RunnableSequence([
  multiQueryPrompt,
  llmCreative,
  new StringOutputParser(),
  extractQuestionsRunnable,
  new RunnableLambda({
    func: async (questions) => {
      // Batch retrieve docs for all questions
      return batchRetriever(questions, 10);
    },
  }),
]);

// Parallel retrieval paths for fusion
const parallelGather = new RunnableMap({
  steps: {
    per_question_docs: multiQueryChain,
    plain_retrieval: standaloneChain.pipe(
      new RunnableLambda({
        func: async (input) => {
          const embedding = await getCachedEmbedding(input.question);
          const docsAndScores =
            await vectorSummaryStore.similaritySearchVectorWithScore(
              embedding,
              10
            );
          const filtered = filterDocsByScore(docsAndScores, 0.7);
          return {
            question: input.question,
            hits: filtered.map((doc) => ({
              text: doc.pageContent,
              metadata: {
                source: doc.metadata.source,
                year: doc.metadata.date_of_issue,
              },
            })),
          };
        },
      })
    ),
  },
});

// Fuse retrieved summaries intelligently
const fuseRunnable = new RunnableLambda({
  func: async (data) => {
    return fuseParallelSummaryOutputs(data, { k: 60 });
  },
});

// Final input assembly
const parallelInputs = new RunnableMap({
  steps: {
    context: parallelGather.pipe(fuseRunnable),
    question: new RunnablePassthrough(),
  },
});

// Final community chain uses the best LLM with your final prompt template
const finalCommunityChain_test = parallelInputs
  .pipe(finalPrompt)
  .pipe(llmFinal)
  .pipe(new StringOutputParser());

// --- Export ---
export { finalCommunityChain_test, batchRetriever, getCachedEmbedding };
