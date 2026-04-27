"""
python ingest.py [tradition] [--refresh]

Examples:
  python ingest.py                          # run all pending sources
  python ingest.py taoism                   # run all taoism sources
  python ingest.py taoism/tao_te_ching      # run one specific source
  python ingest.py --refresh taoism         # re-ingest even if already done
  python ingest.py --status                 # just show status table

All scrapers live in scrapers/<tradition>/<text_name>.py
Each exports a class ending in 'Ingester'.
"""
import sys
import os
import importlib
import inspect
import argparse
sys.path.insert(0, os.path.dirname(__file__))

from rich.console import Console
from scrapers.base import BaseIngester
import status as status_module

console = Console()

# Registry: (tradition, text_name) → module path
# Add new scrapers here as they're built.
REGISTRY: list[tuple[str, str, str]] = [
    # (tradition, text_name, module_path)
    ("taoism", "tao_te_ching",   "scrapers.taoism.tao_te_ching"),
    ("taoism", "zhuangzi",       "scrapers.taoism.zhuangzi"),
    ("taoism", "neiye",          "scrapers.taoism.neiye"),
    ("taoism", "i_ching",        "scrapers.taoism.i_ching"),
    ("taoism", "zhuangzi_outer", "scrapers.taoism.zhuangzi_outer"),
    ("taoism", "liezi",          "scrapers.taoism.liezi"),
    ("kabbalah", "sefer_yetzirah",          "scrapers.kabbalah.sefer_yetzirah"),
    ("kabbalah", "sefer_yetzirah_westcott", "scrapers.kabbalah.sefer_yetzirah_westcott"),
    ("kabbalah", "zohar",                   "scrapers.kabbalah.zohar"),
    # ("kabbalah", "bahir",        "scrapers.kabbalah.bahir"),   # no English via Sefaria API
    # ("kabbalah", "shaarei_orah", "scrapers.kabbalah.shaarei_orah"),  # no PD English translation (Weinstein 1994 not PD)
    ("tantra", "mahanirvana_tantra", "scrapers.tantra.mahanirvana_tantra"),
    ("tantra", "vijnana_bhairava_tantra", "scrapers.tantra.vbt"),
    ("tantra", "heart_sutra",    "scrapers.tantra.heart_sutra"),
    ("tantra", "kularnava_tantra", "scrapers.tantra.kularnava_tantra"),
    # ("tantra", "shiva_sutras",   "scrapers.tantra.shiva_sutras"),  # no free English text found
    ("sufism", "masnavi",        "scrapers.sufism.masnavi"),
    ("sufism", "conference_of_the_birds","scrapers.sufism.conference_of_the_birds"),
    ("sufism", "fusus_al_hikam", "scrapers.sufism.fusus_al_hikam"),
    ("sufism", "divan_e_shams",      "scrapers.sufism.divan_e_shams"),
    ("sufism", "ghazali_confessions","scrapers.sufism.ghazali_confessions"),
    ("sufism", "mystics_of_islam",   "scrapers.sufism.mystics_of_islam"),
    ("sufism", "quran_passages",    "scrapers.sufism.quran_passages"),
    # ("sufism", "risala_qushayri",  ...),  # no PD English translation (Knysh 2007 under copyright)
    ("christian_mysticism", "cloud_of_unknowing", "scrapers.christian_mysticism.cloud_of_unknowing"),
    ("christian_mysticism", "ascent_of_mount_carmel", "scrapers.christian_mysticism.ascent_of_mount_carmel"),
    ("christian_mysticism", "interior_castle", "scrapers.christian_mysticism.interior_castle"),
    ("christian_mysticism", "eckhart_sermons", "scrapers.christian_mysticism.eckhart_sermons"),
    ("christian_mysticism", "dark_night_of_the_soul", "scrapers.christian_mysticism.dark_night_of_the_soul"),
    ("christian_mysticism", "showings",               "scrapers.christian_mysticism.showings"),
    ("christian_mysticism", "practice_of_presence",   "scrapers.christian_mysticism.practice_of_presence"),
    ("christian_mysticism", "spiritual_canticle",     "scrapers.christian_mysticism.spiritual_canticle"),
    ("christian_mysticism", "mystical_theology","scrapers.christian_mysticism.mystical_theology"),
    ("christian_mysticism", "bible_passages",  "scrapers.christian_mysticism.bible_passages"),
    ("hermeticism", "corpus_hermeticum", "scrapers.hermeticism.corpus_hermeticum"),
    ("hermeticism", "kybalion",          "scrapers.hermeticism.kybalion"),
    ("hermeticism", "asclepius",        "scrapers.hermeticism.asclepius"),
    ("hermeticism", "emerald_tablet",   "scrapers.hermeticism.emerald_tablet"),
    ("rosicrucianism", "fama_fraternitatis",         "scrapers.rosicrucianism.fama_fraternitatis"),
    ("rosicrucianism", "confessio_fraternitatis",    "scrapers.rosicrucianism.confessio_fraternitatis"),
    ("rosicrucianism", "chymical_wedding",            "scrapers.rosicrucianism.chymical_wedding"),
    ("rosicrucianism", "real_history_rosicrucians",   "scrapers.rosicrucianism.real_history_rosicrucians"),
    ("rosicrucianism", "secret_symbols_rosicrucians", "scrapers.rosicrucianism.secret_symbols_rosicrucians"),
    ("rosicrucianism", "themis_aurea",                "scrapers.rosicrucianism.themis_aurea"),
    ("rosicrucianism", "rosicrucian_enlightenment",   "scrapers.rosicrucianism.rosicrucian_enlightenment"),
    # ("rosicrucianism", "atalanta_fugiens", ...),  # SKIPPED: only PD file is mellon48atalanta (PDF, no text);
    #   Godwin 1989 translation (atalantafugiense0000maie) is © 1989 — not PD.
    # ("tantra", "tantraloka", ...),  # SKIPPED: No public domain English translation exists.
    #   tantralokaofabhi03abhiuoft DjVuTXT is garbage OCR (Sanskrit → unreadable Latin).
    #   Tantrasara (H.N. Chakravarty, Rudra Press 2012) is copyright © 2012 — not PD.
    #   Revisit if a pre-1928 English translation surfaces on archive.org.
    ("hinduism", "bhagavad_gita",     "scrapers.hinduism.bhagavad_gita"),
    ("hinduism", "upanishads_core",   "scrapers.hinduism.upanishads_core"),
    ("buddhism", "dhammapada",        "scrapers.buddhism.dhammapada"),
    ("science", "dmn_meditation",    "scrapers.science.dmn_meditation"),
    ("science", "gamma_coherence",   "scrapers.science.gamma_coherence"),
    ("science", "rebus_model",       "scrapers.science.rebus_model"),
    ("science", "iit",               "scrapers.science.iit"),
    ("science", "orch_or",           "scrapers.science.orch_or"),
    ("science", "breathwork_altered",  "scrapers.science.breathwork_altered"),
    ("science", "ras_consciousness",   "scrapers.science.ras_consciousness"),
    ("science", "qs_canonical_references",    "scrapers.science.qs_canonical_references"),
    ("science", "qs_darkness_void_synthesis", "scrapers.science.qs_darkness_void_synthesis"),
    # ("science", "qs_science_overlay",         "scrapers.science.qs_science_overlay"),           # pending
    # ("science", "qs_tradition_venn_overlay",  "scrapers.science.qs_tradition_venn_overlay"),    # pending
]


def load_ingester(module_path: str) -> BaseIngester:
    mod = importlib.import_module(module_path)
    for name, cls in inspect.getmembers(mod, inspect.isclass):
        if issubclass(cls, BaseIngester) and cls is not BaseIngester:
            return cls()
    raise ValueError(f"No BaseIngester subclass found in {module_path}")


def main():
    parser = argparse.ArgumentParser(description="Ingest sacred knowledge corpus into Supabase")
    parser.add_argument("target", nargs="?", default=None,
                        help="tradition or tradition/text_name to run (default: all pending)")
    parser.add_argument("--refresh", action="store_true",
                        help="Re-ingest sources even if already marked 'ingested'")
    parser.add_argument("--status", action="store_true",
                        help="Show status table and exit")
    args = parser.parse_args()

    if args.status:
        status_module.main()
        return

    # Filter registry by target
    to_run = REGISTRY
    if args.target:
        parts = args.target.split("/")
        if len(parts) == 2:
            to_run = [(t, n, m) for t, n, m in REGISTRY if t == parts[0] and n == parts[1]]
        else:
            to_run = [(t, n, m) for t, n, m in REGISTRY if t == parts[0]]

    if not to_run:
        console.print(f"[red]No scrapers matched '{args.target}'[/red]")
        console.print("Available:", [f"{t}/{n}" for t, n, _ in REGISTRY])
        return

    # Skip already-ingested unless --refresh
    if not args.refresh:
        from db import get_ingestion_status
        done = {(r["tradition"], r["text_name"]) for r in get_ingestion_status() if r["status"] == "ingested"}
        skipped = [(t, n, m) for t, n, m in to_run if (t, n) in done]
        to_run = [(t, n, m) for t, n, m in to_run if (t, n) not in done]
        if skipped:
            console.print(f"[dim]Skipping {len(skipped)} already-ingested source(s). Use --refresh to re-ingest.[/dim]")

    if not to_run:
        console.print("[green]All selected sources already ingested.[/green]")
        status_module.main()
        return

    console.print(f"\n[bold]Running {len(to_run)} source(s)...[/bold]")
    success, failed = 0, 0

    for tradition, text_name, module_path in to_run:
        try:
            ingester = load_ingester(module_path)
            ingester.run(refresh=args.refresh)
            success += 1
        except Exception:
            failed += 1

    console.print(f"\n[bold]Done: {success} succeeded, {failed} failed[/bold]")
    status_module.main()


if __name__ == "__main__":
    main()
