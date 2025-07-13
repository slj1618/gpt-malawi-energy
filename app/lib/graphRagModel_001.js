import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { config } from "dotenv";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
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
  database: "neo4j",
});

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

const chain = GraphCypherQAChain.fromLLM({ llm: llm, graph });

const t0 = new Date();
const result = await chain.run(
  "what are the projects funded by the world bank?"
);
const t1 = new Date();

console.log(`Time taken: ${(t1 - t0) / 1000} seconds`);
console.log(result);
