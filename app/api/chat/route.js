// app/api/chat/route.ts   (✱ Node runtime, not Edge ✱)
import { NextResponse } from "next/server";
import { answerChain } from "../../lib/ragModel"; // 👈 NEW
import serverSupabase from "../../lib/supabase.mjs";
import { ConversationSummaryMemory } from "langchain/memory";
import { llmSummary } from "../../lib/ragModel";
// import { rowsToMessages } from "../../lib/history";

/* -------------------------------------------------- */

export async function POST(req) {
  try {
    const { message, conversationId: clientCid } = await req.json();
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let conversationId = clientCid || crypto.randomUUID();

    // 1️⃣  Pull full rows from Supabase
    const { data: rows, error } = await serverSupabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // 2️⃣  Create / load the summary memory (new way)
    // ── build / refresh the running summary ──────────────────────────────
    const summariser = new ConversationSummaryMemory({
      llm: llmSummary,
      memoryKey: "chat_history",
    });

    let pendingHuman = ""; // holds text until we see the AI reply

    for (const row of rows) {
      if (row.role === "human") {
        pendingHuman = row.content;
      } else {
        // row.role === "ai"
        await summariser.saveContext(
          { input: pendingHuman }, // empty string is fine if no human yet
          { output: row.content }
        );
        pendingHuman = ""; // reset for next pair
      }
    }

    // If the log ends with a human message and no AI reply yet,
    // push it into memory so the model "remembers" the last question.
    if (pendingHuman) {
      await summariser.saveContext({ input: pendingHuman }, { output: "" });
    }

    // final summary string
    const { chat_history: chatHistory } = await summariser.loadMemoryVariables(
      {}
    );

    /* 3️⃣  call the RAG chain – give it both the       */
    /*     current question and the previous messages   */
    const t0 = Date.now();
    const botReply = await answerChain.invoke({
      question: message,
      chat_history: chatHistory, // summary of the chat history
    });
    const t1 = Date.now();
    console.log(`Time taken to answer: ${(t1 - t0) / 1000} seconds`);

    /* 4️⃣  persist both turns as before  */
    const { error: insertErr } = await serverSupabase
      .from("chat_messages")
      .insert([
        { conversation_id: conversationId, role: "human", content: message },
        { conversation_id: conversationId, role: "ai", content: botReply },
      ]);
    if (insertErr) console.error(insertErr);
    const t2 = Date.now();
    console.log(`Time taken to insert: ${(t2 - t1) / 1000} seconds`);

    return NextResponse.json({ reply: botReply, conversationId });
  } catch (err) {
    console.error("Chat API:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
