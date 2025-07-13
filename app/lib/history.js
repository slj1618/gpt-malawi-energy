import { AIMessage, HumanMessage } from "@langchain/core/messages";

export function rowsToMessages(rows = []) {
  return rows.map((r) =>
    r.role === "human" ? new HumanMessage(r.content) : new AIMessage(r.content)
  );
}
