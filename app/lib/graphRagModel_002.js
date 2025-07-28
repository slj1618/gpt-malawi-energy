// Summary Entry

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
  multiQueryGraphTemplate_test,
  standAloneQuestionTemplate,
} from "../const/templates";
import { ChatOpenAI } from "@langchain/openai";

config({ path: ".env.local" });

/**
 * Custom Neo4jGraph subclass that disables APOC schema discovery,
 * useful when APOC procedures should be skipped.
 */
class NoApocGraph extends Neo4jGraph {
  async refreshSchema() {
    // Override to disable APOC schema refresh (no-op)
  }

  static async initialize(config) {
    const graph = new NoApocGraph(config);
    await graph.verifyConnectivity();
    // Intentionally skip refreshSchema call
    return graph;
  }
}

const graph = await NoApocGraph.initialize({
  url: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: process.env.NEO4J_PASSWORD,
  database: process.env.NEO4J_DATABASE,
});

// Initialize Language Models
const googleLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

const openAiLlm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const creativeGoogleLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0.35,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

// Prompt templates
const standAloneQuestionPrompt = ChatPromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);
const multiQueryPrompt = ChatPromptTemplate.fromTemplate(
  multiQueryGraphTemplate_test
);
const finalPrompt = ChatPromptTemplate.fromTemplate(finalGraphTemplate);

// Standalone question-answer chain
const standaloneChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) => input.chat_history,
  },
  standAloneQuestionPrompt,
  googleLlm,
  new StringOutputParser(),
]);

/**
 * Retrieve context chunks for a single question using Neo4j vector search,
 * filter by score, then refine by recency.
 */
async function retrieveFunc(question) {
  const questionEmbedding = await embeddings.embedQuery(question);

  const docsAndScores =
    await vectorSummaryStore.similaritySearchVectorWithScore(
      questionEmbedding,
      10
    );

  const filteredDocs = filterDocsByScore(docsAndScores, 0.7);
  const docsIds = filteredDocs.map((doc) => doc.metadata.element_id);

  const CYPHER = `
CALL {
  CALL db.index.vector.queryNodes(
    'chunkEmbeddingIndex',
    toInteger($k * 4),
    $question_embedding
  )
  YIELD node, score

  UNWIND $ids AS id
  MATCH (node:Chunk)-[:FROM_DOCUMENT]-(doc:Document)
  WHERE elementId(doc) = id

  RETURN { text: node.text, year: doc.date_of_issue, source: doc.path } AS chunk, score

  UNION ALL

  CALL db.index.vector.queryNodes(
    'chunkEmbeddingIndex',
    toInteger($k * 4),
    $question_embedding
  )
  YIELD node

  UNWIND $ids AS id
  MATCH (node:Chunk)-[:FROM_DOCUMENT]-(doc:Document)
  WHERE elementId(doc) = id

  MATCH (node)-[r:SHARE_CONTEXT]-(node2:Chunk)-[:FROM_DOCUMENT]-(doc2:Document)
  WHERE r.score > 0.9

  RETURN { text: node2.text, year: doc2.date_of_issue, source: doc2.path } AS chunk, r.score AS score
}
WITH chunk, score
ORDER BY score DESC
LIMIT toInteger($k * 8)
RETURN collect(chunk) AS combined_chunks
`;

  const records = await graph.query(CYPHER, {
    k: 10,
    ids: docsIds,
    question_embedding: questionEmbedding,
  });

  const finalContext = selectChunksByRecency(records, 15);
  const updatedDocs = finalContext.map((doc) => ({
    text: doc.text,
    metadata: {
      source: doc.source,
      year: doc.year,
    },
  }));

  return {
    question,
    hits: updatedDocs,
  };
}

// Runnable for retrieving unstructured documents for a question
const unstructuredRetrieverRunnable = new RunnableLambda({
  func: retrieveFunc,
});

// Multi-query chain that:
// - formats the prompt,
// - calls creative Google LLM,
// - parses output,
// - extracts multiple questions,
// - batch retrieves context for each question.
const multiQueryChain = multiQueryPrompt
  .pipe(creativeGoogleLlm)
  .pipe(new StringOutputParser())
  .pipe(
    new RunnableLambda({
      func: splitQuestions,
    })
  )
  .pipe(
    new RunnableLambda({
      func: async (questions) => Promise.all(questions.map(retrieveFunc)),
    })
  );

// Pipeline combining standalone retrieval with unstructured retrieval
const p_chain = standaloneChain.pipe(unstructuredRetrieverRunnable);

// Run parallel retrievals and fuse their outputs
const parallelGather = new RunnableMap({
  steps: {
    per_question_docs: multiQueryChain,
    plain_retrieval: p_chain,
  },
});

const fuseRunnable = new RunnableLambda({
  func: async (data) => fuseParallelSummaryOutputs(data, { k: 60 }),
});

const t_chain = parallelGather.pipe(fuseRunnable);

const parallelInputs = new RunnableMap({
  steps: {
    context: t_chain, // t_chain,
    question: new RunnablePassthrough(),
  },
});

// Final chain to generate response using OpenAI GPT-4.1-mini
const finalCommunityChain = parallelInputs
  .pipe(finalPrompt)
  .pipe(openAiLlm)
  .pipe(new StringOutputParser());

export { finalCommunityChain };
