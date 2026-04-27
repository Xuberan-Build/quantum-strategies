"""
Integrated Information Theory 3.0 — Oizumi, Albantakis, Tononi 2014
"From the Phenomenology to the Mechanisms of Consciousness: Integrated Information Theory 3.0"
PLOS Computational Biology — PMC: PMC4014402
"""
from scrapers.base import BaseIngester
from chunk_utils import split_long_text
from scrapers.science._pmc_utils import fetch_pmc, extract_sections

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4014402/"

THEMES = [
    "integrated_information_theory", "consciousness", "phi", "qualia",
    "neuroscience", "information_theory", "phenomenology", "intrinsic_causation",
]
CROSS_TAGS = [
    "consciousness", "unity_of_experience", "self_awareness", "transformation",
]


class IitIngester(BaseIngester):
    tradition = "science"
    text_name = "iit"
    display_name = "Integrated Information Theory 3.0 — Oizumi, Albantakis, Tononi 2014"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC4014402 (IIT 3.0)...")
        soup = fetch_pmc(PMC_URL)
        sections = extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Oizumi M, Albantakis L, Tononi G",
                    "translator": "",
                    "date_composed": "2014",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"Integrated Information Theory 3.0 — {title}\n"
                        f"Oizumi M, Albantakis L, Tononi G, PLOS Computational Biology 2014\n\n{part}"
                    ),
                    "priority": 2,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1371/journal.pcbi.1003588",
                        "journal": "PLOS Computational Biology",
                        "year": 2014,
                        "pmc": "PMC4014402",
                        "section_idx": idx,
                    },
                })
        return chunks
