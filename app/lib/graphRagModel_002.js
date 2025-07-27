// Summary Entry

import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  embeddings,
  retrieverUnstructured,
  vectorSummaryStore,
} from "./graphRetriever";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  filterDocsByScore,
  // fuseParallelOutputs,
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

class NoApocGraph extends Neo4jGraph {
  /** Skip APOC schema discovery completely */
  async refreshSchema() {
    /* noop */
  }

  /**
   * Drop-in replacement for Neo4jinitialize that
   * returns a NoApocGraph instance **without** touching APOC.
   */
  static async initialize(config) {
    const graph = new NoApocGraph(config); // ← instantiate THIS class
    await graph.verifyConnectivity(); // still a good idea
    // DO NOT call graph.refreshSchema(); we just disabled it
    return graph;
  }
}

const graph = await NoApocGraph.initialize({
  url: process.env.NEO4J_URI,
  username: process.env.NEO4J_USERNAME,
  password: process.env.NEO4J_PASSWORD,
  database: process.env.NEO4J_DATABASE,
});

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

const llmOpenAI = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
  googleApiKey: process.env.OPENAI_API_KEY,
});

const creativeLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0.35,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

async function retriever(question, k = 10) {
  const unstructuredDocs = await Promise.all([
    retrieverUnstructured(question, k),
  ]);

  return {
    question,
    unstructured: unstructuredDocs.map((d) => ({
      text: d.pageContent,
      metadata: {
        source: d.metadata?.source,
        year: d.metadata?.date_of_issue,
      },
    })),
  };
}

const standAloneQuestionPrompt = ChatPromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);

const standaloneChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) => input.chat_history,
  },
  standAloneQuestionPrompt,
  llm,
  new StringOutputParser(),
]);

const multiQueryPrompt = ChatPromptTemplate.fromTemplate(
  multiQueryGraphTemplate
);

const relationshipsRunnable = new RunnableLambda({
  func: async (input) => {
    const question = typeof input === "string" ? input : input.question;
    return retriever(question);
  },
});

const relationshipsComposed = standaloneChain.pipe(relationshipsRunnable);

const assembleInputs = new RunnableMap({
  steps: {
    relationships: relationshipsComposed, // passes original input by default
    question: standaloneChain, // new RunnablePassthrough()
  },
});

//  Extract questions
const extractQuestionsRunnable = new RunnableLambda({
  func: async (raw) => {
    const splits = splitQuestions(raw);
    return splits;
  },
});

const unstructuredRetrieverRunnable = new RunnableLambda({
  func: async (singleQuestion) => {
    // community path
    const questionEmbedding = await embeddings.embedQuery(singleQuestion);
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

  // Return the chunks from 'node' side
  RETURN { text: node.text, year: doc.date_of_issue, source: doc.path } AS chunk, score

  UNION ALL

  // Now separately match context-sharing neighbors
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
    const updatedDocs = finalContext.map((doc) => {
      return {
        text: doc.text,
        metadata: {
          // chunk_id: doc.metadata.element_id,
          source: doc.source,
          year: doc.year,
        },
      };
      return doc; // Return original doc if no matching metadata found
    });

    // return {
    //   hits: finalContext.map((d) => ({
    //     text: d.text,
    //     source: d.source,
    //     year: d.year,
    //   })),
    // };
    return {
      question: singleQuestion,
      hits: updatedDocs.map((d) => ({
        text: d.text,
        metadata: d.metadata,
      })),
    };
  },
});

const multiQueryChain = assembleInputs
  .pipe(multiQueryPrompt) // format prompt
  .pipe(creativeLlm) // call LLM
  .pipe(new StringOutputParser()) // to raw string
  .pipe(extractQuestionsRunnable) // array<string>
  .pipe(unstructuredRetrieverRunnable.map()); // array<{question, hits}>

const p_chain = standaloneChain.pipe(unstructuredRetrieverRunnable);

const parallelGather = new RunnableMap({
  steps: {
    per_question_docs: multiQueryChain,
    plain_retrieval: p_chain,
  },
});

const fuseRunnable = new RunnableLambda({
  func: async (data) => {
    // Optionally: adjust k
    return fuseParallelSummaryOutputs(data, { k: 60 });
  },
});

const t_chain = parallelGather.pipe(fuseRunnable);

const finalPromt = ChatPromptTemplate.fromTemplate(finalGraphTemplate);

const parallelInputs = new RunnableMap({
  steps: {
    context: t_chain,
    question: new RunnablePassthrough(),
  },
});

const finalCommunityChain = parallelInputs
  .pipe(finalPromt)
  .pipe(llmOpenAI)
  .pipe(new StringOutputParser());

export { finalCommunityChain };
