import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { retrieverEntity, retrieverUnstructured } from "./graphRetriever";
// import neo4j from "neo4j-driver";
import { structuredRetriever } from "../functions/structuredRetriever";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { fuseParallelOutputs, splitQuestions } from "./function";
import { config } from "dotenv";
import {
  finalGraphTemplate,
  multiQueryGraphTemplate,
  standAloneQuestionTemplate,
} from "../const/templates";
config({ path: ".env.local" });

class NoApocGraph extends Neo4jGraph {
  /** Skip APOC schema discovery completely */
  async refreshSchema() {
    /* noop */
  }

  /**
   * Drop-in replacement for Neo4jGraph.initialize that
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

const creativeLlm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0.35,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

const entityChain = new RunnableLambda({
  func: async (inp) => {
    return retrieverEntity(inp, {
      k: 20,
      threshold: 0.85,
      useScores: false,
    });
  },
});

// const driver = neo4j.driver(
//   process.env.NEO4J_URI,
//   neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
// );

async function retriever(question, k = 20) {
  const [structuredData, unstructuredDocs] = await Promise.all([
    structuredRetriever(question, { entityChain: entityChain }),
    retrieverUnstructured(question, k),
  ]);

  return {
    question,
    structured: structuredData, // string or object (depends on your structuredRetriever)
    unstructured: unstructuredDocs.map((d) => ({
      text: d.pageContent,
      metadata: { source: d.metadata?.source },
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
  func: async (raw) => splitQuestions(raw),
});

const unstructuredRetrieverRunnable = new RunnableLambda({
  func: async (singleQuestion) => {
    const docs = await retrieverUnstructured(singleQuestion, 20);
    return {
      question: singleQuestion,
      hits: docs.map((d) => ({
        text: d.pageContent,
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
    return fuseParallelOutputs(data, { k: 60 });
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

const finalChain = parallelInputs
  .pipe(finalPromt)
  .pipe(creativeLlm)
  .pipe(new StringOutputParser());

export { graph, finalChain };
