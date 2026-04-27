"""
Ingest a .docx document into the knowledge corpus.

Usage:
  python ingest_docx.py <path/to/file.docx> \
    --tradition qs_doctrine \
    --text-name cult_os_blueprint \
    --display-name "QS Cult OS Blueprint" \
    [--refresh]

The document is split by Heading 1 / Heading 2 into sections.
Each section becomes one or more chunks with contextual headers.
"""
import sys
import os
import argparse
import textwrap

sys.path.insert(0, os.path.dirname(__file__))

import docx
from rich.console import Console
from embed import embed_chunks
from db import upsert_chunks, ensure_source_row, mark_source_ingested, \
               mark_source_error, delete_chunks_for_source
from chunk_utils import split_long_text, clean_text
from config import MAX_CHARS

console = Console()

PROCESS_BATCH = 50


def extract_sections(path: str) -> list[dict]:
    """
    Walk the docx paragraphs and group into sections keyed by
    Heading 1 + Heading 2 context. Returns list of:
      { section, subsection, content, order }
    """
    doc = docx.Document(path)

    sections = []
    current_h1 = ""
    current_h2 = ""
    buffer: list[str] = []

    def flush(order: int):
        text = clean_text("\n\n".join(buffer))
        if text:
            sections.append({
                "section": current_h1,
                "subsection": current_h2 if current_h2 != current_h1 else None,
                "content": text,
                "order": order,
            })
        buffer.clear()

    order = 0
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue

        style = para.style.name if para.style else ""

        if "Heading 1" in style:
            flush(order); order += 1
            current_h1 = text
            current_h2 = ""
        elif "Heading 2" in style:
            flush(order); order += 1
            current_h2 = text
        else:
            buffer.append(text)

    flush(order)
    return sections


def sections_to_chunks(
    sections: list[dict],
    tradition: str,
    text_name: str,
    display_name: str,
) -> list[dict]:
    """Convert sections into knowledge_chunk dicts, splitting long ones."""
    chunks = []

    for sec in sections:
        # Build context prefix
        parts = [p for p in [sec["section"], sec["subsection"]] if p]
        prefix = " › ".join(parts)

        # Include prefix in the chunk text so the embedding carries context
        full_content = f"{prefix}\n\n{sec['content']}" if prefix else sec["content"]

        # Split if too long
        sub_texts = split_long_text(full_content, max_chars=MAX_CHARS)

        for i, sub_text in enumerate(sub_texts):
            chunk: dict = {
                "tradition":  tradition,
                "text_name":  text_name,
                "author":     display_name,
                "section":    sec["section"] or None,
                "chapter":    sec["subsection"] or None,
                "content":    sub_text,
                "themes":     [],
                "priority":   1,
            }
            chunks.append(chunk)

    return chunks


def run(
    docx_path: str,
    tradition: str,
    text_name: str,
    display_name: str,
    refresh: bool = False,
):
    console.print(f"\n[bold cyan]▶ Ingesting {os.path.basename(docx_path)}[/bold cyan]")
    console.print(f"  tradition=[bold]{tradition}[/bold]  text_name=[bold]{text_name}[/bold]")

    ensure_source_row(tradition, text_name, display_name, priority=1)

    if refresh:
        console.print("  Deleting existing chunks...")
        delete_chunks_for_source(tradition, text_name)

    console.print("  Parsing document...")
    sections = extract_sections(docx_path)
    console.print(f"  Extracted [bold]{len(sections)}[/bold] sections")

    chunks = sections_to_chunks(sections, tradition, text_name, display_name)
    console.print(f"  Produced [bold]{len(chunks)}[/bold] chunks")

    total_inserted = 0
    for i in range(0, len(chunks), PROCESS_BATCH):
        batch = chunks[i : i + PROCESS_BATCH]
        batch_num = i // PROCESS_BATCH + 1
        total_batches = (len(chunks) + PROCESS_BATCH - 1) // PROCESS_BATCH

        if total_batches > 1:
            console.print(f"  Batch {batch_num}/{total_batches} — embedding {len(batch)} chunks...")
        else:
            console.print("  Embedding...")

        embeddings = embed_chunks([c["content"] for c in batch])
        for chunk, emb in zip(batch, embeddings):
            chunk["embedding"] = emb

        total_inserted += upsert_chunks(batch)

    mark_source_ingested(tradition, text_name, len(chunks))
    console.print(f"\n  [green]✓ Done — {total_inserted} chunks ingested[/green]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest a .docx into the knowledge corpus")
    parser.add_argument("path", help="Path to the .docx file")
    parser.add_argument("--tradition",    default="qs_doctrine")
    parser.add_argument("--text-name",    default=None)
    parser.add_argument("--display-name", default=None)
    parser.add_argument("--refresh",      action="store_true")
    args = parser.parse_args()

    docx_path = os.path.expanduser(args.path)
    if not os.path.exists(docx_path):
        print(f"Error: file not found: {docx_path}")
        sys.exit(1)

    base = os.path.splitext(os.path.basename(docx_path))[0]
    text_name    = args.text_name    or base.lower().replace(" ", "_").replace("-", "_")
    display_name = args.display_name or base.replace("-", " ").replace("_", " ").title()

    run(
        docx_path    = docx_path,
        tradition    = args.tradition,
        text_name    = text_name,
        display_name = display_name,
        refresh      = args.refresh,
    )
