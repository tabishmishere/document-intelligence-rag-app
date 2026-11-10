# PDF RAG API

A practice project that turns text-based PDFs into searchable chunks and answers questions using the matching content.

## How it works

1. `POST /ingest` extracts text from a PDF and splits it into overlapping chunks.
2. OpenAI creates an embedding for each chunk.
3. Supabase stores the chunks and embeddings for vector search.
4. `POST /chat` searches for relevant chunks and asks OpenAI to answer using them.

## Requirements

- Node.js 20 or later
- An OpenAI API key
- A Supabase project with the `vector` extension enabled

## Setup

Install dependencies:

```sh
npm install
```

Create a `.env` file in the project root:

```env
OPEN_AI_API_KEY=your-openai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-secret-key
PORT=3000
```

Run this SQL in the Supabase SQL Editor:

```sql
create extension if not exists vector with schema extensions;

create table if not exists public.embeddings (
  id bigint generated always as identity primary key,
  source text not null,
  chunk text not null,
  embedding extensions.vector(1536) not null
);

create index if not exists embeddings_embedding_idx
  on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create or replace function public.match_embeddings(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int
)
returns table (source text, chunk text, similarity float)
language sql
stable
set search_path = public, extensions
as $$
  select
    source,
    chunk,
    1 - (embedding <=> query_embedding) as similarity
  from public.embeddings
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

Start the API:

```sh
npm start
```

The server listens at `http://localhost:3000` by default. Set `PORT` in `.env` to use another port.

## API

### Health check

`GET /health`

Returns `{"status":"ok"}` when the server is running.

### Ingest a PDF

`POST /ingest`

In Postman, choose **Body → form-data**, add a field named `file`, set its type to **File**, and select a PDF. The maximum file size is 10 MB.

Example response:

```json
{
  "source": "guide.pdf",
  "chunks": 8
}
```

### Ask a question

`POST /chat`

Send **Body → raw → JSON** with `Content-Type: application/json`:

```json
{
  "question": "What is this document about?"
}
```

The response includes an answer and the matching sources:

```json
{
  "answer": "The document is about ...",
  "sources": [
    {
      "source": "guide.pdf",
      "similarity": 0.72
    }
  ]
}
```

## Development

```sh
npm run check
npm test
```

`npm test` builds the TypeScript and runs the chunking test.

## Notes

- Re-ingesting a PDF with the same filename replaces its previous chunks.
- Scanned PDFs require OCR; OCR is not included.
- This practice API has no authentication. Do not expose it publicly as-is.
- Keep API keys in `.env` and never commit them. Uploaded text is sent to OpenAI for embeddings and answer generation.
