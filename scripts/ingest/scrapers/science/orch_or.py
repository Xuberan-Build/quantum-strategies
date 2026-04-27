"""
Orchestrated Objective Reduction (Orch-OR) — Hameroff & Penrose
Source: quantumconsciousness.org/content/consciousness-universe (Hameroff's site)
Original paper: "Consciousness in the universe: A review of the 'Orch OR' theory"
Penrose & Hameroff, Physics of Life Reviews 11(1):39-78, 2014
DOI: 10.1016/j.plrev.2013.08.002 (paywalled; text sourced from hameroff.arizona.edu)
"""
import time
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from config import SCRAPE_DELAY

ARTICLE_URL = "https://www.quantumconsciousness.org/content/consciousness-universe"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; QuantumStrategiesRAG/1.0; research corpus ingestion)"}

THEMES = [
    "orch_or", "quantum_consciousness", "microtubules", "objective_reduction",
    "penrose_hameroff", "spacetime", "consciousness", "quantum_biology",
    "anesthesia", "gamma_oscillations",
]
CROSS_TAGS = [
    "consciousness", "quantum_reality", "transformation", "ego_dissolution",
    "void", "unity_of_experience",
]


class OrchOrIngester(BaseIngester):
    tradition = "science"
    text_name = "orch_or"
    display_name = "Orchestrated Objective Reduction (Orch-OR) — Hameroff & Penrose"
    source_url = ARTICLE_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching Orch-OR article from quantumconsciousness.org...")
        time.sleep(SCRAPE_DELAY)
        r = requests.get(ARTICLE_URL, headers=HEADERS, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        # Main article body
        body_el = (
            soup.find("div", class_="field-body")
            or soup.find("article")
            or soup.find("main")
        )
        if not body_el:
            raise ValueError("Could not locate article body on quantumconsciousness.org")

        sections = []
        current_title = "Introduction"
        current_paras: list[str] = []

        for el in body_el.find_all(["h1", "h2", "h3", "h4", "p"]):
            tag = el.name
            text = clean_text(el.get_text(separator=" "))
            if not text:
                continue
            if tag in ("h1", "h2", "h3", "h4"):
                if current_paras:
                    block = "\n\n".join(current_paras).strip()
                    if len(block) >= 150:
                        sections.append((current_title, block))
                current_title = text[:80]
                current_paras = []
            else:
                if len(text) > 40:
                    current_paras.append(text)

        if current_paras:
            block = "\n\n".join(current_paras).strip()
            if len(block) >= 150:
                sections.append((current_title, block))

        # If no heading-based sections found, fall back to full-text split
        if not sections:
            full_text = clean_text(body_el.get_text(separator="\n"))
            if len(full_text) >= 200:
                sections = [("Orch-OR Theory Overview", full_text)]

        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Hameroff SR, Penrose R",
                    "translator": "",
                    "date_composed": "2014",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"Orchestrated Objective Reduction (Orch-OR) — {title}\n"
                        f"Hameroff SR, Penrose R — quantumconsciousness.org\n\n{part}"
                    ),
                    "priority": 2,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1016/j.plrev.2013.08.002",
                        "journal": "Physics of Life Reviews (original paper)",
                        "year": 2014,
                        "note": "Text sourced from quantumconsciousness.org; original paper paywalled",
                        "section_idx": idx,
                    },
                })
        return chunks
