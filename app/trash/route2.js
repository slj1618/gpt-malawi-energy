import { NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import serverSupabase from "../../lib/supabase.mjs";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

// Initialize your LLM
const llm = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-4o", // Or your preferred model
  temperature: 0.7,
});

export async function POST(req) {
  try {
    const { message, conversationId: clientConversationId } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // --- 1. Authentication (Optional, but highly recommended for user-specific chats) ---
    // Get user ID from the authenticated session (e.g., from a cookie, or token in header)
    // const { data: { session } } = await serverSupabase.auth.getSession();
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }
    // const userId = session.user.id;

    let conversationId = clientConversationId;
    // If no conversationId, create a new one and potentially record it
    if (!conversationId) {
      conversationId = crypto.randomUUID(); // Requires Node.js 15.0+ or polyfill for older versions
      // Optional: Record new conversation in a 'conversations' table
      // await serverSupabase.from('conversations').insert({ id: conversationId, user_id: userId });
    }

    // --- 2. Fetch Chat History from Supabase ---
    let chatHistory = [];
    const { data: history, error: historyError } = await serverSupabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      // .eq('user_id', userId) // Important for RLS and user-specific history
      .order("created_at", { ascending: true });

    if (historyError) {
      console.error("Error fetching chat history:", historyError);
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      );
    }

    // Format history for Langchain
    chatHistory = history.map((msg) =>
      msg.role === "human"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );

    // --- 3. Define Langchain Chain/Agent ---
    const chatPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "You are a helpful AI assistant. Keep your responses concise and to the point.",
      ],
      // new MessagesPlaceholder("chat_history"), // Dynamic history
      ["human", "{input}"],
    ]);

    const chain = RunnableSequence.from([
      {
        // Pass the fetched history to the chain's input
        // chat_history: (input) => input.chat_history,
        input: (input) => input.message,
      },
      chatPrompt,
      llm,
      new StringOutputParser(),
    ]);

    // --- 4. Invoke the Langchain Chain ---
    const botResponse = await chain.invoke({
      message: message,
      // chat_history: [] // chatHistory,
      conversationId: conversationId, // Not directly used by this simple chain, but useful for context
    });

    // --- 5. Store Current Interaction in Supabase ---
    const messagesToInsert = [
      {
        // conversation_id: conversationId,
        // user_id: userId, // Important for RLS and user-specific history
        role: "human",
        content: message,
      },
      {
        // conversation_id: conversationId,
        // user_id: userId, // Important for RLS and user-specific history
        role: "ai",
        content: botResponse,
      },
    ];

    const { error: insertError } = await serverSupabase
      .from("chat_messages")
      .insert(messagesToInsert);

    if (insertError) {
      console.error("Error saving messages to DB:", insertError);
      // Log the error but don't fail the user request if response was generated
    }

    // --- 6. Send Response to Frontend ---
    return NextResponse.json({ reply: botResponse, conversationId });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
