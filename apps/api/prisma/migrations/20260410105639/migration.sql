/*
  Warnings:

  - You are about to alter the column `embedding` on the `issue_embeddings` table. The data in that column could be lost. The data in that column will be cast from `Text` to `Unsupported("vector(1536)")`.

*/
-- NOTE (Electron / plain-Postgres build):
-- pgvector is NOT available on stock PostgreSQL 16, so the CREATE EXTENSION and the
-- vector(1536) column conversion below have been neutralized. The `embedding` column
-- stays as TEXT (defined in migration 20260202091006). Nothing in the runtime requires
-- the vector type. To re-enable pgvector, uncomment the two guarded statements below and
-- run against a Postgres image that ships the `vector` extension.
--
-- Ensure pgvector extension is available
-- CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable (guarded: only runs if the `vector` type actually exists in this database)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    ALTER TABLE "issue_embeddings" ALTER COLUMN "embedding" TYPE vector(1536) USING ("embedding"::vector(1536));
  END IF;
END $$;

