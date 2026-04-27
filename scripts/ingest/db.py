import time
from datetime import datetime, timezone
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, supabase as _default_client

# Module-level client — replaced on SSL errors
_client = _default_client


def _get_client():
    return _client


def _reconnect():
    global _client
    _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


INSERT_BATCH_SIZE = 50  # rows per Supabase upsert call


def upsert_chunks(chunks: list[dict]) -> int:
    """
    Insert chunks into knowledge_chunks in batches to avoid SSL timeouts.
    Each chunk dict must include 'content' and 'embedding'.
    Returns total count of rows inserted.
    """
    if not chunks:
        return 0

    rows = []
    for c in chunks:
        row = {k: v for k, v in c.items() if v is not None}
        if "embedding" in row and isinstance(row["embedding"], list):
            row["embedding"] = "[" + ",".join(str(x) for x in row["embedding"]) + "]"
        rows.append(row)

    total = 0
    for i in range(0, len(rows), INSERT_BATCH_SIZE):
        batch = rows[i : i + INSERT_BATCH_SIZE]
        # Retry with reconnect on SSL errors
        for attempt in range(3):
            try:
                result = _get_client().table("knowledge_chunks").upsert(batch, on_conflict="id").execute()
                total += len(result.data)
                break
            except Exception as e:
                if attempt < 2 and ("ssl" in str(e).lower() or "SYS" in str(e)):
                    print(f"      SSL error on insert, reconnecting... (attempt {attempt+1})")
                    _reconnect()
                    time.sleep(2)
                else:
                    raise

    return total


def ensure_source_row(tradition: str, text_name: str, display_name: str,
                      source_url: str | None = None, priority: int = 2):
    """Insert a knowledge_sources row if one doesn't already exist."""
    existing = (
        _get_client().table("knowledge_sources")
        .select("id")
        .eq("tradition", tradition)
        .eq("text_name", text_name)
        .execute()
    )
    if existing.data:
        return
    _get_client().table("knowledge_sources").insert({
        "tradition": tradition,
        "text_name": text_name,
        "display_name": display_name,
        "source_url": source_url,
        "priority": priority,
        "status": "pending",
        "format": "html",
    }).execute()


def mark_source_ingested(tradition: str, text_name: str, chunk_count: int, source_url: str | None = None):
    """Update knowledge_sources status to 'ingested' and record chunk count.

    Tries to match by source_url first for specificity. Falls back to
    tradition + text_name so tracking doesn't silently fail when the ingester
    URL differs from what was seeded (e.g. using a .txt mirror vs an .html page).
    """
    payload = {
        "status": "ingested",
        "chunk_count": chunk_count,
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "last_refreshed": datetime.now(timezone.utc).isoformat(),
    }

    # Try exact source_url match first
    if source_url:
        result = (
            _get_client().table("knowledge_sources")
            .update(payload)
            .eq("tradition", tradition)
            .eq("text_name", text_name)
            .eq("source_url", source_url)
            .execute()
        )
        if result.data:
            return

    # Fall back: mark all rows for this tradition + text_name
    (
        _get_client().table("knowledge_sources")
        .update(payload)
        .eq("tradition", tradition)
        .eq("text_name", text_name)
        .execute()
    )


def mark_source_error(tradition: str, text_name: str, notes: str, source_url: str | None = None):
    query = (
        _get_client().table("knowledge_sources")
        .update({"status": "error", "notes": notes})
        .eq("tradition", tradition)
        .eq("text_name", text_name)
    )
    if source_url:
        query = query.eq("source_url", source_url)
    query.execute()


def get_ingestion_status() -> list[dict]:
    result = (
        _get_client().table("knowledge_sources")
        .select("tradition, text_name, display_name, priority, status, chunk_count, ingested_at")
        .order("tradition")
        .order("priority")
        .execute()
    )
    return result.data


def delete_chunks_for_source(tradition: str, text_name: str):
    """Remove existing chunks before re-ingesting a source."""
    _get_client().table("knowledge_chunks").delete().eq("tradition", tradition).eq("text_name", text_name).execute()
