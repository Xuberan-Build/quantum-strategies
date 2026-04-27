import time
from tenacity import retry, stop_after_attempt, wait_exponential
from config import openai_client, EMBED_MODEL, EMBED_DIMENSIONS, EMBED_BATCH_SIZE


@retry(stop=stop_after_attempt(4), wait=wait_exponential(multiplier=1, min=2, max=30))
def _embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=texts,
        dimensions=EMBED_DIMENSIONS,
    )
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


def embed_chunks(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts in batches. Returns embeddings in same order."""
    all_embeddings = []
    for i in range(0, len(texts), EMBED_BATCH_SIZE):
        batch = texts[i : i + EMBED_BATCH_SIZE]
        embeddings = _embed_batch(batch)
        all_embeddings.extend(embeddings)
        if i + EMBED_BATCH_SIZE < len(texts):
            time.sleep(0.5)
    return all_embeddings
