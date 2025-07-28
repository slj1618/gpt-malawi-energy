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

export async function POST(req) {
  try {
    const { message, conversationId: clientCid, model } = await req.json();
    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Generate a new conversation ID if one is not provided by the client
    let conversationId = clientCid || crypto.randomUUID();

    // 1️⃣  Pull full rows from Supabase for the current conversation
    // This retrieves the chat history to build the memory
    const { data: rows, error } = await serverSupabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Supabase fetch error:", error);
      throw error;
    }

    // 2️⃣  Create / load the summary memory
    // Initialize ConversationSummaryMemory with the LLM for summarization
    const summariser = new ConversationSummaryMemory({
      llm: llmSummary,
      memoryKey: "chat_history", // The key under which the summary will be stored
    });

    let pendingHumanContent = ""; // Temporarily holds human message content until its AI reply is found

    // Iterate through historical messages to build the summary memory
    for (const row of rows) {
      if (row.role === "human") {
        // If a human message is found, store its content
        pendingHumanContent = row.content;
      } else if (row.role === "ai") {
        // If an AI message is found, and there's a preceding human message,
        // then save this complete turn (human input + AI output) to the summarizer.
        if (pendingHumanContent !== "") {
          // Crucial check: Only save if human input exists
          await summariser.saveContext(
            { input: pendingHumanContent },
            { output: row.content }
          );
          pendingHumanContent = ""; // Reset for the next human-AI pair
        }
        // If pendingHumanContent is empty here, it means this AI message
        // doesn't have a direct preceding human message in the current sequence
        // (e.g., first message is AI, or multiple AI messages in a row).
        // In such cases, we skip saving context for this AI message alone.
      }
    }

    // If the loop ends with a pending human message (i.e., the last message
    // in history was a human message without an AI reply yet),
    // push it into memory so the model "remembers" the last question.
    if (pendingHumanContent !== "") {
      // Crucial check: Only save if human input exists
      await summariser.saveContext(
        { input: pendingHumanContent },
        { output: "" }
      );
    }

    // Retrieve the summarized chat history from the memory
    const { chat_history: chatHistory } = await summariser.loadMemoryVariables(
      {}
    );

    /* 3️⃣  Call the RAG chain – give it both the current question and the previous messages */
    const t0 = Date.now();
    let botReply;
    console.log("Selected model: ", model);

    const modelChains = {
      flash: answerChainModelFlash,
      heavy: answerChain,
      hulk: finalChain,
      von: finalCommunityChain,
    };

    // Default to 'heavy' if model not matched
    const chain = modelChains[model] || answerChain;

    botReply = await chain.invoke({
      question: message,
      chat_history: chatHistory,
    });

    const t1 = Date.now();
    console.log(`Time taken to answer: ${(t1 - t0) / 1000} seconds`);

    /* 4️⃣  Persist both turns (human input and AI reply) to Supabase */
    const { error: insertErr } = await serverSupabase
      .from("chat_messages")
      .insert([
        { conversation_id: conversationId, role: "human", content: message },
        { conversation_id: conversationId, role: "ai", content: botReply },
      ]);
    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
    }
    const t2 = Date.now();
    console.log(`Time taken to insert: ${(t2 - t1) / 1000} seconds`);

    // Return the AI's reply and the conversation ID
    return NextResponse.json({ reply: botReply, conversationId });
  } catch (err) {
    console.error("Chat API caught error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
