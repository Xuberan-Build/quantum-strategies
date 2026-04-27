"""
Heart Sutra (Prajnaparamita-hrdaya Sutra, Taisho 251)
Translation by Thich Nhat Hanh, "The Insight that Brings Us to the Other Shore"
Source: plumvillage.org (CC BY-NC 4.0)
Strategy: single HTTP fetch, extract main content, treat as 1-2 chunks.
"""
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY
import time

SOURCE_URL = "https://plumvillage.org/mindfulness-practice/the-heart-sutra"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

THEMES = [
    "emptiness", "form", "consciousness", "skandhas",
    "prajnaparamita", "bodhisattva", "enlightenment", "mantra",
]
CROSS_TAGS = [
    "emptiness_void", "transformation", "consciousness",
    "divine_union", "transcendence",
]


def _fetch_and_parse() -> str:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(SOURCE_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    # plumvillage.org wraps content in <main>
    main = soup.find("main")
    if not main:
        main = soup.find("article") or soup.find("div", class_=lambda c: c and "content" in c.lower())

    if not main:
        raise ValueError("Could not find main content element on page")

    # Remove nav/header/footer noise if present
    for tag in main.find_all(["nav", "header", "footer", "script", "style"]):
        tag.decompose()

    text = main.get_text(separator="\n", strip=True)
    return text


class HeartSutraIngester(BaseIngester):
    tradition = "tantra"
    text_name = "heart_sutra"
    display_name = "Heart Sutra"
    source_url = SOURCE_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching from plumvillage.org...")
        raw_text = _fetch_and_parse()

        # Strip page navigation noise (breadcrumbs, audio player labels, etc.)
        SKIP_LINES = {"Play", "Pause", "Download Audio", "Sutras", "/"}
        lines = raw_text.split("\n")
        body_lines = []
        in_body = False
        for line in lines:
            stripped = line.strip()
            if not in_body:
                # Start collecting after we hit the first real sutra line
                if "Avalokiteshvara" in stripped or "Prajñāpāramitā" in stripped:
                    in_body = True
                    if stripped in SKIP_LINES:
                        continue
            if in_body:
                # Skip audio player noise and page footer
                if stripped in SKIP_LINES:
                    continue
                if stripped.startswith("©") or "plumvillage" in stripped.lower():
                    break
                body_lines.append(line)

        body = "\n".join(body_lines)
        body = clean_text(body)

        if len(body) < 100:
            raise ValueError(f"Heart Sutra body too short: {len(body)} chars")

        header = "Heart Sutra (Prajnaparamita-hrdaya Sutra)\nTranslation by Thich Nhat Hanh"
        all_chunks = []

        for i, part in enumerate(split_long_text(body)):
            labeled = f"{header}\n\n{part}"
            all_chunks.append({
                "tradition": self.tradition,
                "text_name": self.text_name,
                "author": "Unknown (Mahayana tradition)",
                "translator": "Thich Nhat Hanh",
                "date_composed": "~1st–2nd century CE",
                "book": "1",
                "chapter": "1",
                "verse": "1",
                "section": "full_text",
                "content": labeled,
                "priority": 2,
                "content_type": "primary_canon",
                "source_url": SOURCE_URL,
                "language": "english",
                "themes": THEMES,
                "cross_tradition_tags": CROSS_TAGS,
                "metadata": {"license": "CC BY-NC 4.0"},
            })

        return all_chunks
