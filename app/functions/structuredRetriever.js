// structuredRetriever.js
import { graph } from "../lib/graphRagModel_001.js";
import { generateFullTextQuery } from "./luceneQuery.js";

/**
 * Pass in an object exposing `invoke({question})` => Promise<string[]>
 * (Your JS RunnableLambda / entityChain wrapper).
 * @typedef {{ invoke: (input: {question: string}) => Promise<string[]> }} EntityChain
 */

/**
 * Run a Cypher query and return array of record objects.
 * @param {import('neo4j-driver').Driver} driver
 * @param {string} cypher
 * @param {object} params
 * @returns {Promise<Array<Record<string, any>>>}
 */
// async function runQuery(driver, cypher, params = {}) {
//   const session = driver.session();
//   try {
//     const res = await session.run(cypher, params);
//     console.log("response: ", res);
//     return res.records.map((r) => {
//       // Pull only requested keys; here we know "output" and "score"
//       return {
//         output: r.get("output"),
//         score: r.get("score"),
//       };
//     });
//   } finally {
//     await session.close();
//   }
// }

/**
 * Structured retriever: for each detected entity, fetch its neighborhood edges.
 *
 * @param {string} question
 * @param {object} deps
 * @param {EntityChain} deps.entityChain
 * @param {Set<string>} deps.uniqueNodeIds
 * @param {import('neo4j-driver').Driver} deps.driver
 * @param {number} [deps.limitPerEntity=100]
 * @param {number} [deps.fulltextLimit=2]  // limit of initial full-text matches
 * @returns {Promise<string>} multi-line string of edges
 */
export async function structuredRetriever(question, { entityChain }) {
  const outputs = [];
  const entities = await entityChain.invoke({ question }); // array of entity strings

  const cypher = `
    CALL db.index.fulltext.queryNodes('entity', $query, {limit: 2})
    YIELD node, score
    MATCH (node)-[r]-(neighbor)
    WHERE NOT type(r) IN ['MENTION','MENTIONS','HAS_CHUNK']
    WITH DISTINCT node, r, neighbor, score
    ORDER BY score DESC
    LIMIT 25
    RETURN
    node.id + ' (' + apoc.convert.toJson(apoc.map.removeKeys(properties(node), ['embedding'])) + ') ' +
    '- [' + type(r) + ' (' + apoc.convert.toJson(apoc.map.removeKeys(properties(r), ['embedding'])) + ')] - ' +
    neighbor.id + ' (' + apoc.convert.toJson(apoc.map.removeKeys(properties(neighbor), ['embedding'])) + ')' AS output,
    score;
  `;

  for (const entity of entities) {
    // Skip if the recognized entity is not recognized as an ID you track

    const queryString = generateFullTextQuery(entity);
    if (!queryString) continue;

    // const rows = await runQuery(driver, cypher, {
    //   query: queryString,
    //   //   limitPerEntity,
    //   //   fulltextLimit,
    // });

    try {
      const response = await graph.query(cypher, {
        query: queryString,
      });

      for (const row of response) {
        outputs.push(row.output);
      }
    } catch (error) {
      console.error(error);
    }
  }
  //   console.log("str: ", outputs.join("\n"));

  return outputs.join("\n");
}
