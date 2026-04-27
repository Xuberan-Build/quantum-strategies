"""
REBUS Model — Carhart-Harris & Friston 2019
"REBUS and the Anarchic Brain: Toward a Unified Model of the Brain Action of Psychedelics"
PMC: PMC6588209
"""
from scrapers.base import BaseIngester
from chunk_utils import split_long_text
from scrapers.science._pmc_utils import fetch_pmc, extract_sections

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6588209/"

THEMES = [
    "psychedelics", "predictive_coding", "free_energy_principle", "consciousness",
    "default_mode_network", "neuroscience", "altered_states", "entropy",
    "serotonin", "5HT2A", "mystical_experience",
]
CROSS_TAGS = [
    "consciousness", "altered_states", "ego_dissolution", "transformation",
    "mystical_experience", "void",
]


class RebusModelIngester(BaseIngester):
    tradition = "science"
    text_name = "rebus_model"
    display_name = "REBUS Model — Carhart-Harris & Friston 2019"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC6588209...")
        soup = fetch_pmc(PMC_URL)
        sections = extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Carhart-Harris R, Friston KJ",
                    "translator": "",
                    "date_composed": "2019",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"REBUS and the Anarchic Brain — {title}\n"
                        f"Carhart-Harris R, Friston KJ, Pharmacological Reviews 2019\n\n{part}"
                    ),
                    "priority": 1,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1124/pr.118.017160",
                        "journal": "Pharmacological Reviews",
                        "year": 2019,
                        "pmc": "PMC6588209",
                        "section_idx": idx,
                    },
                })
        return chunks
