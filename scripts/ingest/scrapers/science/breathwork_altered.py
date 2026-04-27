"""
Breathwork & Altered States — Zaccaro et al. 2018 Frontiers in Human Neuroscience
"How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological
Correlates of Slow Breathing"
PMC: PMC6137615
"""
from scrapers.base import BaseIngester
from chunk_utils import split_long_text
from scrapers.science._pmc_utils import fetch_pmc, extract_sections

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6137615/"

THEMES = [
    "breathwork", "pranayama", "slow_breathing", "consciousness", "altered_states",
    "autonomic_nervous_system", "HRV", "meditation", "mindfulness",
    "psychophysiology", "vagal_tone",
]
CROSS_TAGS = [
    "consciousness", "transformation", "meditation", "sacred_practice",
    "altered_states", "self_awareness",
]


class BreathworkAlteredIngester(BaseIngester):
    tradition = "science"
    text_name = "breathwork_altered"
    display_name = "Breathwork & Altered States — Zaccaro et al. 2018"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC6137615 (Breathwork Slow Breathing Review)...")
        soup = fetch_pmc(PMC_URL)
        sections = extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Zaccaro A, Piarulli A, Laurino M, Garbella E, Menicucci D, Neri B, Gemignani A",
                    "translator": "",
                    "date_composed": "2018",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"Breathwork & Altered States — {title}\n"
                        f"Zaccaro A et al., Frontiers in Human Neuroscience 2018\n\n{part}"
                    ),
                    "priority": 2,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.3389/fnhum.2018.00353",
                        "journal": "Frontiers in Human Neuroscience",
                        "year": 2018,
                        "pmc": "PMC6137615",
                        "section_idx": idx,
                    },
                })
        return chunks
