import time
import requests
from abc import ABC, abstractmethod
from rich.console import Console
from config import SCRAPE_DELAY
from embed import embed_chunks
from db import upsert_chunks, mark_source_ingested, mark_source_error, delete_chunks_for_source, ensure_source_row

console = Console()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0; research corpus ingestion)"
}


class BaseIngester(ABC):
    tradition: str
    text_name: str
    display_name: str
    source_url: str

    def fetch(self, url: str) -> str:
        time.sleep(SCRAPE_DELAY)
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.text

    @abstractmethod
    def get_chunks(self) -> list[dict]:
        """
        Return a list of chunk dicts. Each must include:
          - content (str)
          - tradition (str)
          - text_name (str)
          Plus any location fields: chapter, verse, book, section, etc.
          Do NOT include 'embedding' — that's added here.
        """
        ...

    # Process this many chunks per embed+insert cycle to keep DB connection alive
    PROCESS_BATCH = 100

    def run(self, refresh: bool = False):
        console.print(f"\n[bold cyan]▶ {self.display_name}[/bold cyan]")

        try:
            ensure_source_row(
                self.tradition, self.text_name, self.display_name,
                source_url=getattr(self, "source_url", None),
                priority=getattr(self, "priority", 2),
            )

            if refresh:
                console.print("  Deleting existing chunks for refresh...")
                delete_chunks_for_source(self.tradition, self.text_name)

            console.print("  Scraping...")
            chunks = self.get_chunks()
            console.print(f"  Got [bold]{len(chunks)}[/bold] chunks")

            if not chunks:
                raise ValueError("No chunks produced — check scraper logic")

            # Interleave embed + insert in batches to keep Supabase connection alive
            total_inserted = 0
            for i in range(0, len(chunks), self.PROCESS_BATCH):
                batch = chunks[i : i + self.PROCESS_BATCH]
                batch_num = i // self.PROCESS_BATCH + 1
                total_batches = (len(chunks) + self.PROCESS_BATCH - 1) // self.PROCESS_BATCH

                if total_batches > 1:
                    console.print(f"  Batch {batch_num}/{total_batches} — embedding...")
                else:
                    console.print("  Generating embeddings...")

                embeddings = embed_chunks([c["content"] for c in batch])
                for chunk, emb in zip(batch, embeddings):
                    chunk["embedding"] = emb

                if total_batches > 1:
                    console.print(f"  Batch {batch_num}/{total_batches} — inserting {len(batch)} chunks...")
                else:
                    console.print("  Inserting into Supabase...")

                total_inserted += upsert_chunks(batch)

            mark_source_ingested(
                self.tradition, self.text_name, len(chunks),
                source_url=getattr(self, "source_url", None)
            )
            console.print(f"  [green]✓ Done — {total_inserted} chunks ingested[/green]")
            return len(chunks)

        except Exception as e:
            err = str(e)
            console.print(f"  [red]✗ Error: {err}[/red]")
            mark_source_error(self.tradition, self.text_name, err,
                              source_url=getattr(self, "source_url", None))
            raise
