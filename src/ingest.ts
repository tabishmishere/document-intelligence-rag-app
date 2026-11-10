import "dotenv/config";
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { chatHandler } from "./chat.js";
import { splitDocument } from "./lib/chunking.js";
import { getEmbeddings } from "./lib/openai.js";
import { replaceEmbeddingsForSource } from "./lib/supabase.js";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});
const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/ingest", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Upload a PDF in the 'file' field." });
    return;
  }

  if (req.file.mimetype !== "application/pdf") {
    res.status(415).json({ error: "Only PDF files are supported." });
    return;
  }

  let text: string;
  const parser = new PDFParse({ data: req.file.buffer });
  try {
    const result = await parser.getText();
    text = result.text.trim();
  } finally {
    await parser.destroy();
  }

  if (!text) {
    res.status(400).json({ error: "No text could be extracted from the PDF." });
    return;
  }

  try {
    const chunks = await splitDocument(text);
    const embeddings = await getEmbeddings(chunks);
    if (embeddings.length !== chunks.length) {
      throw new Error("The embedding service returned an unexpected result.");
    }

    const source = req.file.originalname;
    await replaceEmbeddingsForSource(source, chunks, embeddings);
    res.status(201).json({ source, chunks: chunks.length });
  } catch (error) {
    console.error("Error ingesting PDF:", error);
    res.status(500).json({ error: "Failed to ingest the PDF." });
  }
});

app.post("/chat", chatHandler);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "PDF must be 10 MB or smaller." });
    return;
  }

  console.error("Unhandled request error:", error);
  res.status(500).json({ error: "An unexpected server error occurred." });
});

app.listen(PORT, () => {
  console.log(`RAG server listening on port ${PORT}.`);
});
