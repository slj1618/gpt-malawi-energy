import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { config } from "dotenv";
import { retriever } from "./retriever.js";
import {
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { splitQuestions } from "./function.js";
config({ path: ".env.local" });

const openAIApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const llm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0,
  openAIApiKey: openAIApiKey,
});

const creativeLlm = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.9,
  openAIApiKey: openAIApiKey,
});

const standAloneQuestionTemplate =
  "Given a question, convert it to a standalone question.\nQuestion: {question}";

const standAloneQuestionPrompt = PromptTemplate.fromTemplate(
  standAloneQuestionTemplate
);

const questionTemplate = `You are **ChatMind AI**, a friendly and concise assistant.

───────────────────────────
GUIDELINES
1. **Ground your answer strictly in the “Context” block.**  
   • Cite or paraphrase only what is given.  
2. **If the context is insufficient** to answer fully:  
   • Begin with a brief apology (“I’m sorry, but…”)  
   • State that you’ll draw on general knowledge to help.  
3. Never invent facts or speculate beyond step 2.  
4. Keep the tone warm and approachable.  
5. Aim for clarity in ≤ 200 words unless more detail is essential.
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
  new RunnablePassthrough(),
  standAloneQuestionPrompt,
  llm,
  new StringOutputParser(),
]);

const multiQueryTemplate = `You are a helpful assistant that generates multiple sub-questions related to an input question. \n
The goal is to break down the input into a set of sub-problems / sub-questions that can be answers in isolation. \n
Generate multiple search queries related to: {question} \n
Output (3 queries):`;

const multiQueryPrompt = PromptTemplate.fromTemplate(multiQueryTemplate);
const multiQueryChain = RunnableSequence.from([
  { question: standaloneChain },
  multiQueryPrompt,
  creativeLlm,
  new StringOutputParser(),
  splitQuestions,
]);

const retrieveChain = RunnableSequence.from([
  new RunnablePassthrough(),
  retriever,
]);

const retrieveDocs = new RunnableLambda({
  name: "retrieveDocsForQuestions",
  func: async (questions) => {
    const fusedScores = {};
    const k = 60;
    const results = await Promise.all(
      questions.map((q) => retrieveChain.invoke(q))
    );
    for (const docs of results) {
      // iterate over each document and track its rank (index)
      docs.forEach((doc, rank) => {
        // doc  → the current document
        // rank → its position in the docs array (0-based)
        const docStr = JSON.stringify(doc.pageContent);
        if (!(docStr in fusedScores)) {
          fusedScores[docStr] = 0;
        }
        const previousScore = fusedScores[docStr];
        fusedScores[docStr] = previousScore + 1 / (rank + k);
      });
    }
    const rerankedResults = Object.entries(fusedScores) // → [ [docStr, score], ... ]
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA) // sort descending by score
      .map(([docStr, score]) => [JSON.parse(docStr), score]);

    return rerankedResults;
  },
});

const retrieveDocsForQuestionsChain = RunnableSequence.from([
  multiQueryChain,
  retrieveDocs,
]);

const answerChain = RunnableSequence.from([
  {
    context: retrieveDocsForQuestionsChain,
    question: (input) => input.question,
  },
  questionPrompt,
  llm,
  new StringOutputParser(),
]);

export { answerChain };

// const question = "what problem is stated and what methodology was used?";

// const response = await answerChain.invoke({
//   question: question,
// });
