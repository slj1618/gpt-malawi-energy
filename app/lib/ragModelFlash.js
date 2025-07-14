import { PromptTemplate } from "@langchain/core/prompts";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { config } from "dotenv";
import { retriever } from "./retriever.js";
import { RunnableSequence } from "@langchain/core/runnables";
config({ path: ".env.local" });

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-001",
  temperature: 0,
  googleApiKey: process.env.GOOGLE_API_KEY,
});

// llmSummary is removed as it was redundant. 'llm' will be used for both chains.

const standAloneQuestionTemplate =
  "Given a question and the chat history, convert it to a standalone question.\nQuestion: {question}\nChat History: {chat_history}";

const standAloneQuestionPrompt = PromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);

const questionTemplate = `You are **GME**, a friendly and concise assistant.

───────────────────────────
GUIDELINES
1. **Ground your answer strictly in the “Context” block.**  
   • Cite or paraphrase only what is given.  
2. **If the context is insufficient** to answer fully:
   • Just say "I don't know"
3. Never invent facts or speculate beyond step 2.  
4. Keep the tone warm and approachable.  
5. Aim for clarity in ≤ 200 words unless more detail is essential.
6. Format the output as a Markdown style (emphasize key words or group of words by making them BOLD)
7. Be precise, structure and concise.
8. Don't be repetitive
9. Never mention 'context' in your answer
───────────────────────────

### QUESTION
{question}

### CONTEXT  
{context}

───────────────────────────
**YOUR ANSWER**
<Write the answer here, following the guidelines above>`;

const questionPrompt = PromptTemplate.fromTemplate(questionTemplate);

const standaloneChain = RunnableSequence.from([
  {
    question: (input) => input.question,
    chat_history: (input) => input.chat_history,
  },
  standAloneQuestionPrompt,
  llm, // Using 'llm' instead of 'llmSummary'
  new StringOutputParser(),
]);

const retrieveChain = RunnableSequence.from([standaloneChain, retriever]);

const answerChainModelFlash = RunnableSequence.from([
  {
    context: retrieveChain,
    question: (input) => input.question,
  },
  questionPrompt,
  llm,
  new StringOutputParser(),
]);

export { answerChainModelFlash }; // llmSummary is no longer exported
