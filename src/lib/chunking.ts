import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

export async function splitDocument(text: string): Promise<string[]> {
  return splitter.splitText(text);
}
