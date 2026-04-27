"""
RAS & Consciousness — Jain et al. 2024, Science Translational Medicine
"Multimodal MRI reveals brainstem connections that sustain wakefulness in human consciousness"
PMC: PMC11870092
DOI: 10.1126/scitranslmed.adj4303

Maps the ascending arousal network (AAN) — the structural connectivity from brainstem
nuclei (ARAS/RAS) through thalamus to cortex — underlying arousal and wakefulness.
"""
from scrapers.base import BaseIngester
from chunk_utils import clean_text, split_long_text
from scrapers.science._pmc_utils import fetch_pmc

PMC_URL = "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11870092/"

THEMES = [
    "reticular_activating_system", "brainstem_arousal", "ascending_arousal_network",
    "wakefulness", "consciousness", "thalamus", "thalamocortical",
    "neuroscience", "MRI", "connectome", "disorders_of_consciousness",
]
CROSS_TAGS = [
    "consciousness", "altered_states", "meditation", "self_awareness",
    "transformation", "void",
]

# Known PMC nav / boilerplate section titles to skip
_SKIP = {
    "actions", "pdf", "cite", "collections", "permalink", "footnotes",
    "supplementary material", "associated data", "author contributions",
    "competing interests", "acknowledgments", "funding", "data availability",
    "editor's summary:", "references",
}


def _extract_sections(soup) -> list[tuple[str, str]]:
    sections = []

    # Abstract
    for ab in soup.find_all(["div", "section"], class_=lambda c: c and "abstract" in str(c).lower()):
        text = clean_text(ab.get_text(separator=" "))
        if len(text) > 100:
            sections.append(("Abstract", text))
            break

    # Leaf div.sec — no duplicate parent text
    leaf_secs = [s for s in soup.find_all("div", class_="sec") if not s.find("div", class_="sec")]

    seen_titles: set[str] = set()
    for sec in leaf_secs:
        h = sec.find(["h2", "h3", "h4", "h5"])
        title = h.get_text(strip=True) if h else "Section"
        if title.lower().rstrip(":") in _SKIP:
            continue
        if title in seen_titles:
            continue
        body = clean_text(sec.get_text(separator=" "))
        if len(body) < 200:
            continue
        sections.append((title[:80], body))
        seen_titles.add(title)

    # Fallback: named <section> elements
    if len(sections) <= 1:
        for sec in soup.find_all("section"):
            if sec.find("section"):
                continue
            h = sec.find(["h2", "h3"])
            title = h.get_text(strip=True) if h else "Section"
            if title.lower().rstrip(":") in _SKIP:
                continue
            body = clean_text(sec.get_text(separator=" "))
            if len(body) < 200:
                continue
            sections.append((title[:80], body))

    return sections


class RasConsciousnessIngester(BaseIngester):
    tradition = "science"
    text_name = "ras_consciousness"
    display_name = "RAS & Consciousness — Jain et al. 2024"
    source_url = PMC_URL

    def get_chunks(self) -> list[dict]:
        print("    Fetching PMC11870092 (RAS/brainstem arousal)...")
        soup = fetch_pmc(PMC_URL)
        sections = _extract_sections(soup)
        print(f"    Found {len(sections)} sections")

        chunks = []
        for idx, (title, body) in enumerate(sections):
            for part in split_long_text(body):
                chunks.append({
                    "tradition": self.tradition,
                    "text_name": self.text_name,
                    "author": "Jain A et al.",
                    "translator": "",
                    "date_composed": "2024",
                    "book": "1",
                    "chapter": "1",
                    "section": title[:80],
                    "content": (
                        f"RAS & Consciousness (Brainstem Arousal Network) — {title}\n"
                        f"Jain A et al., Science Translational Medicine 2024\n\n{part}"
                    ),
                    "priority": 1,
                    "content_type": "science_paper",
                    "source_url": self.source_url,
                    "language": "english",
                    "themes": THEMES,
                    "cross_tradition_tags": CROSS_TAGS,
                    "metadata": {
                        "doi": "10.1126/scitranslmed.adj4303",
                        "journal": "Science Translational Medicine",
                        "year": 2024,
                        "pmc": "PMC11870092",
                        "section_idx": idx,
                    },
                })
        return chunks
