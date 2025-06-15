import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const openAIApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const embeddings = new OpenAIEmbeddings({ openAIApiKey });
const sbApiKey = process.env.NEXT_PUBLIC_SUPABASE_API_KEY;
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_LC_CHATBOT;

const client = createClient(sbUrl, sbApiKey);

const vectorStore = new SupabaseVectorStore(embeddings, {
  client,
  tableName: "documents_compact",
  queryName: "match_documents_compact",
});

const retriever = vectorStore.asRetriever({ k: 5 });

export { retriever };
