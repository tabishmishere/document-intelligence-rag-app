import type { RequestHandler } from "express";
import { getChatCompletion, getEmbeddings } from "./lib/gemini.js";
import { searchSimilarChunks } from "./lib/supabase.js";

export const chatHandler: RequestHandler = async (req, res) => {
  const body: unknown = req.body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("question" in body) ||
    typeof body.question !== "string" ||
    body.question.trim().length === 0
  ) {
    res.status(400).json({ error: "A non-empty question is required." });
    return;
  }

  try {
    const question = body.question.trim();
    const [queryEmbedding] = await getEmbeddings([question], "query");
    if (!queryEmbedding) {
      throw new Error("Failed to create an embedding for the question.");
    }

    const matches = await searchSimilarChunks(queryEmbedding);
    if (matches.length === 0) {
      res.json({
        answer: "I could not find relevant information in the provided documents.",
        sources: [],
      });
      return;
    }

    const context = matches
      .map((match, index) => `[${index + 1}] Source: ${match.source}\n${match.chunk}`)
      .join("\n\n");
    const answer = await getChatCompletion(question, context);

    res.json({
      answer,
      sources: matches.map(({ source, similarity }) => ({ source, similarity })),
    });
  } catch (error) {
    console.error("Error answering chat request:", error);
    res.status(500).json({ error: "Failed to answer the question." });
  }
};