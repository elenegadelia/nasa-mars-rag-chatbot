/**
 * Semantic document chunker for NASA PDF text.
 *
 * Strategy (in priority order):
 *  1. Split pages into blocks at blank-line boundaries (paragraph-level units).
 *  2. Classify each block: heading | list | paragraph.
 *  3. Merge adjacent non-heading blocks greedily until the size limit.
 *     Headings always flush the current buffer and start a fresh chunk.
 *  4. If a single block is still too large after merging, split by sentence
 *     (fixed-size split is only a last-resort fallback within that step).
 *
 * This preserves document structure where PDF text allows it, and keeps
 * headings with their content for better retrieval relevance.
 */

import path from "path";
import { config } from "@/lib/config";

// ── Types ──────────────────────────────────────────────────────────────────

export type BlockType = "heading" | "list" | "paragraph";

export type ChunkType =
  | "heading_section" // heading text merged with immediate content
  | "paragraph"       // one or more merged paragraph blocks
  | "list"            // one or more list blocks
  | "mixed"           // mix of block types merged together
  | "overflow";       // produced by sentence-split fallback on oversized blocks

export interface ChunkMetadata {
  source_file: string;       // e.g. "mars_2020_perseverance.pdf"
  document_title: string;    // derived from filename
  page_number: number;       // 1-indexed
  chunk_index: number;       // sequential across the whole document
  chunk_type: ChunkType;
  char_start: number;        // character offset within the page text
  char_end: number;
  section_title: string | null; // nearest heading seen before this chunk
  token_estimate: number;    // rough estimate (~4 chars per token)
  ingested_at: string;       // ISO 8601 timestamp
}

export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

interface TextBlock {
  text: string;
  type: BlockType;
  charStart: number;
  charEnd: number;
}

// ── Text normalization ─────────────────────────────────────────────────────

/**
 * Clean up common PDF text extraction artifacts before chunking.
 */
function normalizePage(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")        // Windows line endings
    .replace(/\r/g, "\n")          // old Mac line endings
    .replace(/[ \t]+/g, " ")       // collapse inline whitespace
    .replace(/\n{3,}/g, "\n\n")    // max one blank line between blocks
    .replace(/ \n/g, "\n")         // trailing spaces before newlines
    .trim();
}

// ── Block classification ───────────────────────────────────────────────────

const LIST_PREFIX = /^(\s*[-•*]|\s*\d+[.)]\s|\s*[a-z][.)]\s)/i;

/**
 * Classify a text block by its visual/structural pattern.
 *
 * Heading heuristics (all must pass):
 *   - 1–2 lines only (headings don't wrap much)
 *   - Under 120 characters total
 *   - Does not end with sentence-terminating punctuation
 *   - Does not start with a common article/preposition (likely mid-sentence)
 */
function classifyBlock(text: string): BlockType {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "paragraph";

  // List: at least half the lines have a bullet/number prefix
  const listLineCount = lines.filter((l) => LIST_PREFIX.test(l)).length;
  if (listLineCount / lines.length >= 0.5) return "list";

  // Heading: short, clean, no terminal punctuation
  const startsWithArticle =
    /^(the|a|an|this|that|these|those|it|in|on|at|for|with|by|and|or)\b/i;
  if (
    lines.length <= 2 &&
    text.length < 120 &&
    !/[.,;:!?]$/.test(text.trim()) &&
    !startsWithArticle.test(text.trim())
  ) {
    return "heading";
  }

  return "paragraph";
}

// ── Block extraction ───────────────────────────────────────────────────────

/**
 * Split a page's normalized text into classified blocks.
 * Blank lines are the primary split boundary.
 */
function extractBlocks(pageText: string): TextBlock[] {
  const normalized = normalizePage(pageText);
  const blocks: TextBlock[] = [];
  let cursor = 0;

  for (const raw of normalized.split(/\n\n+/)) {
    const text = raw.trim();
    if (!text) {
      cursor += raw.length + 2;
      continue;
    }

    const charStart = normalized.indexOf(text, cursor);
    const charEnd = charStart + text.length;

    blocks.push({ text, type: classifyBlock(text), charStart, charEnd });
    cursor = charEnd;
  }

  return blocks;
}

// ── Sentence-split fallback ────────────────────────────────────────────────

/**
 * Split an oversized string at sentence boundaries.
 * Returns the original string in a single-element array if no sentences found.
 */
function splitBySentence(text: string, maxChars: number): string[] {
  // Match sentences ending with . ! ? optionally followed by whitespace
  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.length > 0 ? parts : [text];
}

// ── Main chunking logic ────────────────────────────────────────────────────

/**
 * Chunk a single PDF page into DocumentChunks.
 *
 * @param pageText      Raw text from the PDF page
 * @param pageNumber    1-indexed page number
 * @param sourceFile    Original filename (for metadata)
 * @param documentTitle Derived from filename
 * @param chunkIndexStart Offset so chunk indices are sequential across pages
 * @param sectionTitleIn  Section title carried over from the previous page
 * @param ingestedAt    ISO timestamp shared across all chunks in this run
 */
export function chunkPage(
  pageText: string,
  pageNumber: number,
  sourceFile: string,
  documentTitle: string,
  chunkIndexStart: number,
  sectionTitleIn: string | null,
  ingestedAt: string
): {
  chunks: DocumentChunk[];
  nextChunkIndex: number;
  lastSectionTitle: string | null;
} {
  const blocks = extractBlocks(pageText);
  // ~4 chars per token; multiply config token limit to get char limit
  const maxChars = config.chunking.chunkSize * 4;

  const chunks: DocumentChunk[] = [];
  let chunkIndex = chunkIndexStart;
  let currentSection = sectionTitleIn;
  let buffer: TextBlock[] = [];

  function bufferText(): string {
    return buffer.map((b) => b.text).join("\n\n");
  }

  function flushBuffer(forceType?: ChunkType) {
    if (buffer.length === 0) return;

    const content = bufferText();
    const charStart = buffer[0].charStart;
    const charEnd = buffer[buffer.length - 1].charEnd;

    // Determine chunk type from the mix of block types in the buffer
    const types = new Set(buffer.map((b) => b.type));
    const chunkType: ChunkType =
      forceType ??
      (types.size > 1
        ? "mixed"
        : buffer[0].type === "list"
          ? "list"
          : "paragraph");

    // If the merged content is still too large, split by sentence (fallback)
    if (content.length > maxChars * 1.5) {
      for (const part of splitBySentence(content, maxChars)) {
        chunks.push({
          content: part,
          metadata: {
            source_file: sourceFile,
            document_title: documentTitle,
            page_number: pageNumber,
            chunk_index: chunkIndex++,
            chunk_type: "overflow",
            char_start: charStart,
            char_end: charEnd,
            section_title: currentSection,
            token_estimate: Math.ceil(part.length / 4),
            ingested_at: ingestedAt,
          },
        });
      }
    } else {
      chunks.push({
        content,
        metadata: {
          source_file: sourceFile,
          document_title: documentTitle,
          page_number: pageNumber,
          chunk_index: chunkIndex++,
          chunk_type: chunkType,
          char_start: charStart,
          char_end: charEnd,
          section_title: currentSection,
          token_estimate: Math.ceil(content.length / 4),
          ingested_at: ingestedAt,
        },
      });
    }

    buffer = [];
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      // Headings flush whatever came before, then start the new buffer.
      // The heading text becomes the first line of the next chunk so the
      // content that follows is always co-located with its heading.
      flushBuffer();
      currentSection = block.text;
      buffer.push(block);
      continue;
    }

    // For list and paragraph blocks: flush if adding this block would exceed
    // the size limit, then start fresh.
    if (bufferText().length + block.text.length > maxChars && buffer.length > 0) {
      flushBuffer();
    }

    buffer.push(block);
  }

  // Flush any remaining blocks at end of page
  flushBuffer();

  // If the page's first chunk contains only a heading and the heading is
  // the currentSection, mark it as heading_section
  if (chunks.length > 0 && chunks[0].metadata.chunk_type === "paragraph") {
    const firstBlock = blocks[0];
    if (firstBlock?.type === "heading") {
      chunks[0] = {
        ...chunks[0],
        metadata: { ...chunks[0].metadata, chunk_type: "heading_section" },
      };
    }
  }

  return {
    chunks,
    nextChunkIndex: chunkIndex,
    lastSectionTitle: currentSection,
  };
}

/**
 * Chunk an entire PDF document (array of page texts) into DocumentChunks.
 * Chunk indices are sequential across all pages.
 * Section titles carry over across page boundaries.
 */
export function chunkDocument(
  pages: string[],
  sourceFile: string
): DocumentChunk[] {
  // Derive a readable title from the filename
  const documentTitle = path
    .basename(sourceFile, path.extname(sourceFile))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const ingestedAt = new Date().toISOString();
  const allChunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  let currentSection: string | null = null;

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    if (!pageText?.trim()) continue;

    const { chunks, nextChunkIndex, lastSectionTitle } = chunkPage(
      pageText,
      i + 1, // 1-indexed
      path.basename(sourceFile),
      documentTitle,
      chunkIndex,
      currentSection,
      ingestedAt
    );

    allChunks.push(...chunks);
    chunkIndex = nextChunkIndex;
    currentSection = lastSectionTitle;
  }

  return allChunks;
}
