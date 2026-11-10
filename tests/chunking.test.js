import assert from "node:assert/strict";
import test from "node:test";
import { splitDocument } from "../dist/lib/chunking.js";

test("splits long documents into bounded, non-empty chunks", async () => {
  const text = "RAG practice text. ".repeat(200);
  const chunks = await splitDocument(text);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length > 0 && chunk.length <= 1000));
  assert.ok(chunks.some((chunk) => chunk.includes("RAG practice text.")));
});
