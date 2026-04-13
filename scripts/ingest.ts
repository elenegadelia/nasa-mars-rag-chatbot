/**
 * PDF ingestion script — run once to populate Supabase with document chunks.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts               # full ingest
 *   npx tsx scripts/ingest.ts --dry-run     # parse + chunk + preview, no DB writes
 *
 * Reads PDFs from the directory set in NASA_PDF_DIR (.env.local).
 * Requires .env.local to be present with Supabase credentials.
 */

// Load .env.local first (dotenv/config only loads .env by default)
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import fs from "fs";
import path from "path";
// pdf-parse v1 exports a single function via CJS — require() is the reliable import path
const pdfParse: (buffer: Buffer, options?: any) => Promise<any> =
  require("pdf-parse");
import { chunkDocument, type DocumentChunk } from "@/lib/rag/chunker";
import { embedBatch } from "@/lib/rag/embedder";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

// ── Config ─────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 16; // chunks per embedding + insert batch
const PREVIEW_CHUNKS = 3; // how many chunks to print in dry-run

// ── PDF parsing ────────────────────────────────────────────────────────────

/**
 * Extract text from each page of a PDF.
 * Returns an array where index 0 = page 1, index 1 = page 2, etc.
 *
 * Uses the pagerender hook to capture per-page text before pdf-parse
 * concatenates everything. item.hasEOL marks line breaks within PDF streams.
 */
async function extractPages(buffer: Buffer): Promise<string[]> {
  const pages: string[] = [];

  await pdfParse(buffer, {
    pagerender: (pageData: any) => {
      return pageData.getTextContent().then((content: any) => {
        let text = "";
        for (const item of content.items as any[]) {
          text += item.str;
          if (item.hasEOL) text += "\n";
        }
        pages.push(text);
        return text;
      });
    },
  });

  return pages;
}

// ── Supabase insertion ─────────────────────────────────────────────────────

/**
 * Insert a batch of chunks (with their embeddings) into Supabase.
 * Uses upsert with ignoreDuplicates so re-running the script is safe.
 */
async function insertChunks(
  chunks: DocumentChunk[],
  embeddings: number[][]
): Promise<void> {
  const supabase = getSupabaseServerClient();

  const rows = chunks.map((chunk, i) => ({
    content: chunk.content,
    metadata: chunk.metadata,
    embedding: embeddings[i],
  }));

  const { error } = await supabase.from("documents").insert(rows);

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

// ── Logging helpers ────────────────────────────────────────────────────────

function printChunkPreview(chunks: DocumentChunk[], count: number): void {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  CHUNK PREVIEW (first ${count})`);
  console.log("─".repeat(60));

  for (const chunk of chunks.slice(0, count)) {
    const m = chunk.metadata;
    console.log(`\n[Chunk ${m.chunk_index}]`);
    console.log(`  page:          ${m.page_number}`);
    console.log(`  type:          ${m.chunk_type}`);
    console.log(`  section:       ${m.section_title ?? "(none)"}`);
    console.log(`  token_est:     ${m.token_estimate}`);
    console.log(`  chars:         ${m.char_start}–${m.char_end}`);
    console.log(`  content:       ${chunk.content.slice(0, 200).replace(/\n/g, " ")}${chunk.content.length > 200 ? "…" : ""}`);
  }
  console.log("\n" + "─".repeat(60));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function ingest(): Promise<void> {
  const pdfDir = path.resolve(env.nasaPdfDir);

  console.log(`\nNASA Mars RAG — Ingestion${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log(`PDF directory: ${pdfDir}`);
  console.log(`Batch size:    ${BATCH_SIZE} chunks`);
  console.log(`Mode:          ${DRY_RUN ? "dry-run (no DB writes)" : "live"}\n`);

  // Find all PDF files in the directory
  if (!fs.existsSync(pdfDir)) {
    throw new Error(`PDF directory not found: ${pdfDir}\nSet NASA_PDF_DIR in .env.local`);
  }

  const pdfFiles = fs
    .readdirSync(pdfDir)
    .filter((f) => f.toLowerCase().endsWith(".pdf"))
    .map((f) => path.join(pdfDir, f));

  if (pdfFiles.length === 0) {
    throw new Error(`No PDF files found in ${pdfDir}`);
  }

  console.log(`Found ${pdfFiles.length} PDF file(s):`);
  pdfFiles.forEach((f) => console.log(`  • ${path.basename(f)}`));

  let totalChunks = 0;

  // ── Process each PDF ──────────────────────────────────────────────────────
  for (const filePath of pdfFiles) {
    const fileName = path.basename(filePath);
    console.log(`\n${"═".repeat(60)}`);
    console.log(`Processing: ${fileName}`);

    const buffer = fs.readFileSync(filePath);

    // 1. Parse pages
    console.log("  Parsing pages...");
    const pages = await extractPages(buffer);
    const nonEmptyPages = pages.filter((p) => p.trim().length > 0);
    console.log(`  Pages found: ${pages.length} (${nonEmptyPages.length} non-empty)`);

    // 2. Chunk
    console.log("  Chunking...");
    const chunks = chunkDocument(pages, filePath);
    console.log(`  Chunks created: ${chunks.length}`);

    // Chunk quality summary
    const byType = chunks.reduce<Record<string, number>>((acc, c) => {
      acc[c.metadata.chunk_type] = (acc[c.metadata.chunk_type] ?? 0) + 1;
      return acc;
    }, {});
    console.log("  Chunk types:", byType);

    const avgTokens =
      chunks.reduce((sum, c) => sum + c.metadata.token_estimate, 0) /
      (chunks.length || 1);
    console.log(`  Avg tokens/chunk: ${Math.round(avgTokens)}`);

    // Preview
    if (DRY_RUN) {
      printChunkPreview(chunks, PREVIEW_CHUNKS);
      totalChunks += chunks.length;
      continue;
    }

    // 3. Embed in batches
    console.log("  Embedding chunks...");
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const texts = batch.map((c) => c.content);
      const embeddings = await embedBatch(texts);
      allEmbeddings.push(...embeddings);

      const progress = Math.min(i + BATCH_SIZE, chunks.length);
      process.stdout.write(`\r  Embedded: ${progress}/${chunks.length}`);
    }
    console.log(); // newline after progress

    // Quick sanity check on embedding dimensions
    if (allEmbeddings[0]?.length !== 384) {
      throw new Error(
        `Embedding dimension mismatch: expected 384, got ${allEmbeddings[0]?.length}`
      );
    }

    // 4. Insert in batches
    console.log("  Inserting into Supabase...");
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = allEmbeddings.slice(i, i + BATCH_SIZE);
      await insertChunks(batchChunks, batchEmbeddings);

      const progress = Math.min(i + BATCH_SIZE, chunks.length);
      process.stdout.write(`\r  Inserted:  ${progress}/${chunks.length}`);
    }
    console.log();
    console.log(`  ✓ ${fileName} complete`);
    totalChunks += chunks.length;
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(
    DRY_RUN
      ? `Dry run complete. ${totalChunks} chunks would be inserted (no DB writes made).`
      : `Ingestion complete. ${totalChunks} chunks inserted into Supabase.`
  );
}

ingest().catch((err) => {
  console.error("\nIngestion failed:", err.message);
  process.exit(1);
});
