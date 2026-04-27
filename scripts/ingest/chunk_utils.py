import re
from config import MAX_CHARS


def split_long_text(text: str, max_chars: int = MAX_CHARS, overlap_chars: int = 200) -> list[str]:
    """
    Split a text that exceeds max_chars at natural paragraph breaks.
    Falls back to sentence breaks, then hard split if needed.
    """
    if len(text) <= max_chars:
        return [text]

    chunks = []
    paragraphs = re.split(r"\n\n+", text)
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= max_chars:
            current = (current + "\n\n" + para).strip()
        else:
            if current:
                chunks.append(current)
            # Para itself may be too long — split on sentences
            if len(para) > max_chars:
                sentences = re.split(r"(?<=[.!?])\s+", para)
                current = ""
                for sent in sentences:
                    if len(current) + len(sent) + 1 <= max_chars:
                        current = (current + " " + sent).strip()
                    else:
                        if current:
                            chunks.append(current)
                        current = sent
            else:
                current = para

    if current:
        chunks.append(current)

    return [c for c in chunks if c.strip()]


def clean_text(text: str) -> str:
    """Normalize whitespace and remove junk characters common in scraped HTML."""
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()
    return text
