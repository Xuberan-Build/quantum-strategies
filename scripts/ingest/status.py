"""
python status.py

Shows the current ingestion status of all corpus sources,
grouped by tradition with totals.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from rich.console import Console
from rich.table import Table
from rich import box
from db import get_ingestion_status

STATUS_COLORS = {
    "ingested": "green",
    "error": "red",
    "pending": "yellow",
    "skipped": "dim",
}

STATUS_ICONS = {
    "ingested": "✓",
    "error": "✗",
    "pending": "·",
    "skipped": "–",
}


def main():
    console = Console()
    rows = get_ingestion_status()

    if not rows:
        console.print("[red]No sources found — has the migration run?[/red]")
        return

    # Group by tradition
    by_tradition: dict[str, list[dict]] = {}
    for r in rows:
        by_tradition.setdefault(r["tradition"], []).append(r)

    tradition_order = [
        "taoism", "kabbalah", "hinduism", "tantra", "sufism",
        "christian_mysticism", "hermeticism", "rosicrucianism", "science"
    ]

    total_sources = len(rows)
    total_ingested = sum(1 for r in rows if r["status"] == "ingested")
    total_chunks = sum(r["chunk_count"] or 0 for r in rows)

    console.print()
    console.print("[bold]Quantum Strategies — Sacred Knowledge Corpus[/bold]")
    console.print(f"[dim]{total_ingested}/{total_sources} sources ingested · {total_chunks:,} chunks loaded[/dim]")
    console.print()

    for tradition in tradition_order:
        sources = by_tradition.get(tradition, [])
        if not sources:
            continue

        ingested = sum(1 for s in sources if s["status"] == "ingested")
        chunks = sum(s["chunk_count"] or 0 for s in sources)

        table = Table(
            title=f"{tradition.replace('_', ' ').title()}  [{ingested}/{len(sources)} · {chunks} chunks]",
            box=box.SIMPLE_HEAD,
            show_lines=False,
            title_justify="left",
            title_style="bold",
        )
        table.add_column("P", style="dim", width=2)
        table.add_column("Status", width=10)
        table.add_column("Source", style="white")
        table.add_column("Chunks", justify="right", width=7)
        table.add_column("Ingested", width=12)

        for s in sorted(sources, key=lambda x: (x["priority"], x["display_name"])):
            status = s["status"]
            color = STATUS_COLORS.get(status, "white")
            icon = STATUS_ICONS.get(status, "?")
            ingested_at = ""
            if s.get("ingested_at"):
                ingested_at = s["ingested_at"][:10]  # date only

            table.add_row(
                str(s["priority"]),
                f"[{color}]{icon} {status}[/{color}]",
                s["display_name"],
                str(s["chunk_count"] or "—"),
                ingested_at or "—",
            )

        console.print(table)

    # Error summary
    errors = [r for r in rows if r["status"] == "error"]
    if errors:
        console.print("[bold red]Errors:[/bold red]")
        for e in errors:
            console.print(f"  [red]✗[/red] {e['tradition']} / {e['display_name']}")

    console.print()


if __name__ == "__main__":
    main()
