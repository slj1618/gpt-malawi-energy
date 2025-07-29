// app/api/chat/route.ts   (✱ Node runtime, not Edge ✱)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { answerChain } from "../../lib/ragModel"; // Assuming this is your "heavy" model chain
import serverSupabase from "../../lib/supabase.mjs";
import { ConversationSummaryMemory } from "langchain/memory";
import { llmSummary } from "../../lib/ragModel"; // Assuming llmSummary is defined here
import { answerChainModelFlash } from "../../lib/ragModelFlash"; // Assuming this is your "flash" model chain
import { finalChain } from "../../lib/graphRagModel_001";
import { finalCommunityChain } from "../../lib/graphRagModel_002";

/* -------------------------------------------------- */

// Model chain map defined once outside to avoid recreation on every request
const modelChains = {
  flash: answerChainModelFlash,
  heavy: answerChain,
  hulk: finalChain,
  von: finalCommunityChain,
};

export async function POST(req) {
  try {
    const { message, conversationId: clientCid, model } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const conversationId = clientCid || crypto.randomUUID();

    // Fetch chat history sorted ascending by creation date
    const { data: rows, error: fetchError } = await serverSupabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Supabase fetch error:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch conversation history" },
        { status: 500 }
      );
    }

    // Initialize summarizer memory with LLM for summarization
    const summariser = new ConversationSummaryMemory({
      llm: llmSummary,
      memoryKey: "chat_history",
    });

    // Build summary memory from conversation history
    let lastHumanMessage = "";
    for (const { role, content } of rows) {
      if (role === "human") {
        lastHumanMessage = content;
      } else if (role === "ai") {
        if (lastHumanMessage) {
          await summariser.saveContext(
            { input: lastHumanMessage },
            { output: content }
          );
          lastHumanMessage = "";
        }
      }
    }

    // If last message was human without AI reply, save it with empty output
    if (lastHumanMessage) {
      await summariser.saveContext({ input: lastHumanMessage }, { output: "" });
    }

    // Load summarized chat history variable for RAG input
    const { chat_history: chatHistory } = await summariser.loadMemoryVariables(
      {}
    );

    // Select chain model, default to 'heavy'
    const chain = modelChains[model] ?? answerChain;

    console.log("Selected model:", model);

    const t0 = Date.now();
    const botReply = await chain.invoke({
      question: message,
      chat_history: chatHistory,
    });
    const t1 = Date.now();

    console.log(`Time taken to answer: ${(t1 - t0) / 1000} seconds`);

    // Insert user message and AI reply to Supabase in a single transaction
    const { error: insertErr } = await serverSupabase
      .from("chat_messages")
      .insert([
        { conversation_id: conversationId, role: "human", content: message },
        { conversation_id: conversationId, role: "ai", content: botReply },
      ]);

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
    } else {
      const t2 = Date.now();
      console.log(`Time taken to insert: ${(t2 - t1) / 1000} seconds`);
    }

    return NextResponse.json({ reply: botReply, conversationId });
  } catch (err) {
    console.error("Chat API caught error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
