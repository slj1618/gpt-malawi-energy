import { Neo4jGraph } from "@langchain/community/graph_store";

export class NoApocGraph extends Neo4jGraph {
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
