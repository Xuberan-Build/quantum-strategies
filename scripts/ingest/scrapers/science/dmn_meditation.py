"""
DMN & Meditation — Brewer et al. 2011 PNAS
"Meditation experience is associated with differences in default mode network activity and connectivity"
PMC: PMC3250176
"""
from scrapers.base import BaseIngester
from chunk_utils import split_long_text
from scrapers.science._pmc_utils import fetch_pmc, extract_sections

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3250176/"

THEMES = [
    "default_mode_network", "meditation", "neuroscience", "self_referential",
    "mindfulness", "brain_activity", "consciousness", "mind_wandering",
]
CROSS_TAGS = ["consciousness", "meditation", "self_awareness", "transformation"]


class DmnMeditationIngester(BaseIngester):
    tradition = "science"
    text_name = "dmn_meditation"
    display_name = "DMN & Meditation — Brewer et al. 2011"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC3250176...")
        soup = fetch_pmc(PMC_URL)
        sections = extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Brewer JA, Worhunsky PD, Gray JR, Tang YY, Weber J, Kober H",
                    "translator": "",
                    "date_composed": "2011",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"DMN & Meditation — {title}\n"
                        f"Brewer JA et al., PNAS 2011\n\n{part}"
                    ),
                    "priority": 1,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1073/pnas.1112029108",
                        "journal": "PNAS",
                        "year": 2011,
                        "pmc": "PMC3250176",
                        "section_idx": idx,
                    },
                })
        return chunks
