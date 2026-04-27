"""
Gamma Coherence in Meditators — Lutz et al. 2004 PNAS
"Long-term meditators self-induce high-amplitude gamma synchrony during mental practice"
PMC: PMC526201
"""
from scrapers.base import BaseIngester
from chunk_utils import split_long_text
from scrapers.science._pmc_utils import fetch_pmc, extract_sections

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC526201/"

THEMES = [
    "gamma_synchrony", "meditation", "EEG", "neural_oscillations",
    "neuroscience", "consciousness", "long_term_meditators", "mental_training",
]
CROSS_TAGS = ["consciousness", "meditation", "transformation", "sacred_practice"]


class GammaCoherenceIngester(BaseIngester):
    tradition = "science"
    text_name = "gamma_coherence"
    display_name = "Gamma Coherence in Meditators — Lutz et al. 2004"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC526201...")
        soup = fetch_pmc(PMC_URL)
        sections = extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Lutz A, Greischar LL, Rawlings NB, Ricard M, Davidson RJ",
                    "translator": "",
                    "date_composed": "2004",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"Gamma Coherence in Meditators — {title}\n"
                        f"Lutz A et al., PNAS 2004\n\n{part}"
                    ),
                    "priority": 1,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1073/pnas.0407401101",
                        "journal": "PNAS",
                        "year": 2004,
                        "pmc": "PMC526201",
                        "section_idx": idx,
                    },
                })
        return chunks
