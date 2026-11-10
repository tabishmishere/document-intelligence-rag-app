# PDF RAG practice app

This project provides a small Express API that extracts text from uploaded PDFs, splits it into overlapping chunks, stores OpenAI embeddings in Supabase, and answers questions using the nearest matching chunks.

## Setup

Set these server-side values in `.env`:

```env
OPEN_AI_API_KEY=your-openai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-secret-key
PORT=3000
```

In the Supabase SQL editor, create the vector extension, table, and search function:

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
    embeddings.source,
    embeddings.chunk,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from public.embeddings
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
  order by embeddings.embedding <=> query_embedding
  limit match_count;
$$;
```

Install dependencies, then run:

```sh
npm test
npm start
```

`npm test` builds the TypeScript and runs the local chunking test. `npm run check` only type-checks the code.

## API

- `GET /health` checks that the server is running.
- `POST /ingest` accepts a multipart PDF upload in the `file` field (maximum 10 MB).
- `POST /chat` accepts JSON such as `{"question":"What does the document say?"}`.

Ingesting a file with the same filename replaces its previous chunks. The current example is intended for local practice; protect the API and keep the Supabase secret key server-side before deploying it publicly. Scanned PDFs need OCR, which is not included.
