"""Shared PMC HTML parsing helpers for science scrapers."""
import time
import requests
from bs4 import BeautifulSoup
from chunk_utils import clean_text
from config import SCRAPE_DELAY

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0; research corpus ingestion)"}

# PMC UI elements that are not article content
_PMC_NAV = {
    "actions", "pdf", "cite", "collections", "permalink",
    "similar articles", "cited by", "related information",
    "linkout", "references", "figures", "tables",
    "supplementary material", "associated data", "footnotes",
}


def fetch_pmc(pmc_url: str) -> BeautifulSoup:
    time.sleep(SCRAPE_DELAY)
    r = requests.get(pmc_url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "lxml")


def extract_sections(soup: BeautifulSoup) -> list[tuple[str, str]]:
    """Extract (title, body) tuples from a PMC article page.

    Uses leaf-only div.sec elements to avoid duplicating parent+child text.
    Falls back to <section> tags and finally the abstract if nothing found.
    """
    sections = []

    # Abstract first
    for ab in soup.find_all(["div", "section"], class_=lambda c: c and "abstract" in c):
        text = clean_text(ab.get_text(separator=" "))
        if len(text) > 100:
            sections.append(("Abstract", text))
            break

    # Leaf div.sec — sections with no nested div.sec children
    leaf_secs = [
        s for s in soup.find_all("div", class_="sec")
        if not s.find("div", class_="sec")
    ]

    if leaf_secs:
        for sec in leaf_secs:
            h = sec.find(["h2", "h3", "h4", "h5"])
            title = h.get_text(strip=True) if h else "Section"
            if title.lower() in _PMC_NAV:
                continue
            body = clean_text(sec.get_text(separator=" "))
            if len(body) < 200:
                continue
            sections.append((title[:80], body))
    else:
        # Fallback: <section> tags
        for sec in soup.find_all("section"):
            if sec.find("section"):
                continue  # skip parent sections
            h = sec.find(["h2", "h3"])
            title = h.get_text(strip=True) if h else "Section"
            if title.lower() in _PMC_NAV:
                continue
            body = clean_text(sec.get_text(separator=" "))
            if len(body) < 200:
                continue
            sections.append((title[:80], body))

    return sections
