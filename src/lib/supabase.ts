import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey);

export async function upsertEmbedding(
  source: string,
  chunk: string,
  embedding: number[],
) {
  const { data, error } = await supabase.from("embeddings").upsert({
    source,
    chunk,
    embedding,
  });
  if (error) {
    console.error("Error upserting embedding:", error);
    throw error;
  }
  return data;
}

export async function replaceEmbeddingsForSource(
  source: string,
  chunks: string[],
  embeddings: number[][],
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error("The number of chunks must match the number of embeddings.");
  }

  const { error: deleteError } = await supabase
    .from("embeddings")
    .delete()
    .eq("source", source);

  if (deleteError) {
    throw deleteError;
  }

  if (chunks.length === 0) {
    return;
  }

  const rows = chunks.map((chunk, index) => ({
    source,
    chunk,
    embedding: embeddings[index],
  }));
  const { error: insertError } = await supabase.from("embeddings").insert(rows);

  if (insertError) {
    throw insertError;
  }
}

export type RetrievedChunk = {
  source: string;
  chunk: string;
  similarity: number;
};

export async function searchSimilarChunks(
  embedding: number[],
  matchCount = 5,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_embeddings", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: matchCount,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("The match_embeddings RPC returned an invalid response.");
  }

  return data.map((row: unknown) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("source" in row) ||
      typeof row.source !== "string" ||
      !("chunk" in row) ||
      typeof row.chunk !== "string" ||
      !("similarity" in row) ||
      typeof row.similarity !== "number"
    ) {
      throw new Error("The match_embeddings RPC returned an invalid row.");
    }

    return {
      source: row.source,
      chunk: row.chunk,
      similarity: row.similarity,
    };
  });
}