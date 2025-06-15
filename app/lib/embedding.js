// utils/indexing.js  (ESM style)
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
config({ path: ".env.local" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(
  __dirname,
  "../data/M300-AES-Compact-Malawi.extraction.md"
);

try {
  const text = await readFile(filePath, "utf8");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    separators: ["\n\n", "\n", " ", "", "#", "##", "###", "####", "#####"],
    chunkOverlap: 100,
  });

  const output = await splitter.createDocuments([text]);

  const openAIApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

  const sbApiKey = process.env.NEXT_PUBLIC_SUPABASE_API_KEY;
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_LC_CHATBOT;

  const client = createClient(sbUrl, sbApiKey);

  await SupabaseVectorStore.fromDocuments(
    output,
    new OpenAIEmbeddings({ openAIApiKey: openAIApiKey }),
    {
      client,
      tableName: "documents_compact",
    }
  );
} catch (err) {
  console.error(err);
}
