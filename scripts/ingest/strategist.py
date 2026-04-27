"""
Quantum Strategies — Strategy Intelligence CLI

Analyzes content coverage vs product coverage across all 5 pillars,
detects PLG gaps, and proactively recommends + drafts products.

Usage:
  python strategist.py              # interactive strategy session
  python strategist.py --analyze    # run gap analysis, save suggestions, exit
  python strategist.py --gaps       # print gap matrix and exit
  python strategist.py --sync       # sync product PLG metadata interactively
"""
import sys
import os
import json
import argparse
sys.path.insert(0, os.path.dirname(__file__))

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown
from rich.columns import Columns
from rich import box
from config import supabase, openai_client

console = Console()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

PLG_STAGES = ["awareness", "interest", "consideration", "conversion", "expansion"]

PLG_DESCRIPTIONS = {
    "awareness":     "Free content — articles, social, video. No product needed.",
    "interest":      "Lead magnets — whitepapers, diagnostics, free tools. Email capture.",
    "consideration": "Entry products — $7–97, self-serve, immediate value.",
    "conversion":    "Core offers — $297–1997, full transformation, Rites + courses.",
    "expansion":     "High-ticket — coaching, consulting, masterminds, partnerships.",
}

QS_IDENTITY = """
Quantum Strategies (QS) is a mystical consciousness and business strategy company.

MISSION: Help founders and practitioners align consciousness, strategy, and systems
so that their business becomes an expression of who they actually are.

CORE FRAMEWORK: The Three Rites (Perception → Declaration → Alignment) + Quantum
Business Framework (QBF). Waveform physics and ancient mystical wisdom are applied
as literal strategic tools — not metaphor.

KEY INSIGHT: The self is the signal. Before any tactic works, the founder must
clear their perception, declare their true offering, and align their systems.
Strategy built on misaligned identity produces hollow brands and stuck funnels.

DIFFERENTIATION: QS is the only platform that fuses Sufi annihilation, Hermetic
pattern literacy, Taoist wu wei, and neuroscience (REBUS, DMN, IIT) into a
practical business operating system. Every framework has both a philosophical root
and a tactical expression.

PRODUCT PHILOSOPHY: Products should initiate, not just inform. Each QS offer
creates a shift in perception, not just knowledge transfer.
"""


# ── Context loading ────────────────────────────────────────────────────────

def load_context() -> dict:
    """Load full QS context from Supabase."""
    console.print("[dim]Loading context...[/dim]", end="\r")

    pillars = supabase.table("content_pillars").select("*").order("created_at").execute().data or []
    topics  = supabase.table("content_topics").select("*").order("pillar_id").execute().data or []
    angles  = supabase.table("content_angles").select(
        "id, title, status, topic_id, format, audience, goal"
    ).execute().data or []
    pieces  = supabase.table("content_pieces").select(
        "id, piece_type, status, angle_id"
    ).execute().data or []
    products = supabase.table("product_definitions").select(
        "id, product_slug, name, description, price, plg_stage, pillar_id, is_active, is_purchasable"
    ).eq("is_active", True).execute().data or []
    suggestions = supabase.table("product_suggestions").select(
        "id, pillar_id, funnel_stage, title, status, tagline"
    ).in_("status", ["pending", "drafted"]).execute().data or []

    # Build pillar index
    pillar_map = {p["id"]: p for p in pillars}
    topic_map  = {t["id"]: t for t in topics}

    # Count content per pillar
    topic_by_pillar: dict[str, list] = {}
    for t in topics:
        topic_by_pillar.setdefault(t["pillar_id"], []).append(t)

    angle_by_topic: dict[str, list] = {}
    for a in angles:
        if a.get("topic_id"):
            angle_by_topic.setdefault(a["topic_id"], []).append(a)

    # Count pieces per angle
    pieces_by_angle: dict[str, list] = {}
    for p in pieces:
        if p.get("angle_id"):
            pieces_by_angle.setdefault(p["angle_id"], []).append(p)

    # Products by pillar and stage
    products_by_pillar_stage: dict[str, dict[str, list]] = {}
    for prod in products:
        pid = prod.get("pillar_id") or "unlinked"
        stage = prod.get("plg_stage") or "unknown"
        products_by_pillar_stage.setdefault(pid, {}).setdefault(stage, []).append(prod)

    # Pending suggestions by pillar
    suggestions_by_pillar: dict[str, list] = {}
    for s in suggestions:
        suggestions_by_pillar.setdefault(s.get("pillar_id") or "none", []).append(s)

    console.print(" " * 40, end="\r")  # clear loading line

    return {
        "pillars": pillars,
        "pillar_map": pillar_map,
        "topics": topics,
        "topic_map": topic_map,
        "angles": angles,
        "pieces": pieces,
        "products": products,
        "suggestions": suggestions,
        "topic_by_pillar": topic_by_pillar,
        "angle_by_topic": angle_by_topic,
        "pieces_by_angle": pieces_by_angle,
        "products_by_pillar_stage": products_by_pillar_stage,
        "suggestions_by_pillar": suggestions_by_pillar,
    }


def build_context_string(ctx: dict) -> str:
    """Build a concise context string for GPT."""
    lines = [QS_IDENTITY, "\n\n── CONTENT MAP ─────────────────────────────────\n"]

    for pillar in ctx["pillars"]:
        pid = pillar["id"]
        topics = ctx["topic_by_pillar"].get(pid, [])
        total_angles = sum(
            len(ctx["angle_by_topic"].get(t["id"], []))
            for t in topics
        )
        orphan_angles = [a for a in ctx["angles"] if not a.get("topic_id")]
        total_pieces  = sum(
            len(ctx["pieces_by_angle"].get(a["id"], []))
            for a in ctx["angles"]
            if a.get("topic_id") and any(t["id"] == a["topic_id"] for t in topics)
        )
        lines.append(
            f"PILLAR: {pillar['title']}\n"
            f"  Traditions: {', '.join(pillar.get('tradition_affinity') or [])}\n"
            f"  Topics: {len(topics)} | Angles: {total_angles} | Pieces distributed: {total_pieces}\n"
        )
        for t in topics[:5]:  # cap for context length
            a_count = len(ctx["angle_by_topic"].get(t["id"], []))
            lines.append(f"    Topic: {t['title']} ({a_count} angles)")
        lines.append("")

    if any(not a.get("topic_id") for a in ctx["angles"]):
        n = len([a for a in ctx["angles"] if not a.get("topic_id")])
        lines.append(f"  [Orphan angles not yet assigned to topics: {n}]\n")

    lines.append("\n── PRODUCT CATALOG ─────────────────────────────\n")
    lines.append("PLG Stage    │ Product                              │ Price")
    lines.append("─────────────┼──────────────────────────────────────┼──────")
    for prod in sorted(ctx["products"], key=lambda p: PLG_STAGES.index(p.get("plg_stage") or "awareness") if p.get("plg_stage") in PLG_STAGES else 99):
        stage = (prod.get("plg_stage") or "unknown").ljust(12)
        name  = prod["name"][:38].ljust(38)
        price = f"${prod['price']:.0f}" if prod.get("price") else "free"
        linked = " [pillar linked]" if prod.get("pillar_id") else ""
        lines.append(f"{stage} │ {name} │ {price}{linked}")

    lines.append("\n── PLG FUNNEL STAGES ───────────────────────────\n")
    for stage, desc in PLG_DESCRIPTIONS.items():
        lines.append(f"{stage.upper():15} {desc}")

    return "\n".join(lines)


# ── Gap matrix ─────────────────────────────────────────────────────────────

def print_gap_matrix(ctx: dict):
    table = Table(title="PLG Coverage Matrix", box=box.ROUNDED, show_lines=True)
    table.add_column("Pillar", style="bold", width=24)
    for stage in PLG_STAGES:
        table.add_column(stage.capitalize(), justify="center", width=14)

    for pillar in ctx["pillars"]:
        pid = pillar["id"]
        topics = ctx["topic_by_pillar"].get(pid, [])
        has_content = len(topics) > 0 or any(
            a.get("topic_id") and any(t["id"] == a["topic_id"] for t in topics)
            for a in ctx["angles"]
        )
        prod_by_stage = ctx["products_by_pillar_stage"].get(pid, {})
        unlinked_prods = ctx["products_by_pillar_stage"].get("unlinked", {})

        cells = []
        for stage in PLG_STAGES:
            has_prod = bool(prod_by_stage.get(stage) or unlinked_prods.get(stage))
            if stage == "awareness":
                cells.append("[green]● content[/green]" if has_content else "[dim]○ none[/dim]")
            elif has_content and has_prod:
                cells.append("[green]● covered[/green]")
            elif has_content and not has_prod:
                cells.append("[yellow]⚡ gap[/yellow]")
            elif not has_content and has_prod:
                cells.append("[blue]○ no content[/blue]")
            else:
                cells.append("[dim]○ empty[/dim]")

        short = pillar["title"][:22]
        table.add_row(short, *cells)

    console.print(table)
    console.print(
        "\n[green]●[/green] covered  [yellow]⚡[/yellow] content exists, no product  "
        "[blue]○[/blue] product exists, no content  [dim]○[/dim] neither\n"
    )


# ── Gap analysis via GPT ───────────────────────────────────────────────────

def run_gap_analysis(ctx: dict, context_str: str, save: bool = True) -> dict:
    console.print("[dim]Running gap analysis...[/dim]")

    prompt = f"""{context_str}

── TASK ─────────────────────────────────────────────────────────────────────

You are the strategic intelligence for Quantum Strategies.

Analyze the content-to-product coverage matrix above and return a JSON object with:

{{
  "narrative": "2-3 paragraph strategic assessment of where QS is strong, where the biggest PLG gaps are, and the single highest-leverage move right now",
  "top_suggestions": [
    {{
      "pillar_title": "...",
      "funnel_stage": "interest|consideration|conversion|expansion",
      "title": "Product name",
      "tagline": "One-line value proposition",
      "rationale": "Why this gap matters now and how it connects to the content + corpus",
      "format": "whitepaper|ebook|mini-course|diagnostic|gpt-tool|workshop|consulting-offer",
      "corpus_themes": ["theme1", "theme2"],
      "price_suggestion": 0,
      "quick_win": true
    }}
  ],
  "content_gaps": [
    {{
      "product_name": "...",
      "missing": "What content is needed to drive awareness and consideration to this product"
    }}
  ]
}}

Return ONLY valid JSON. Be specific, grounded in QS philosophy, and prioritize by business impact.
Generate exactly 5 product suggestions, ranked by PLG leverage."""

    resp = openai_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=2000,
        temperature=0.6,
    )

    try:
        result = json.loads(resp.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        console.print("[red]Failed to parse analysis[/red]")
        return {}

    if save and result.get("top_suggestions"):
        _save_suggestions(ctx, result["top_suggestions"])

    return result


def _save_suggestions(ctx: dict, suggestions: list):
    pillar_by_title = {p["title"]: p["id"] for p in ctx["pillars"]}
    rows = []
    for s in suggestions:
        pid = pillar_by_title.get(s.get("pillar_title", ""), None)
        rows.append({
            "pillar_id": pid,
            "funnel_stage": s.get("funnel_stage", "consideration"),
            "title": s.get("title", "Untitled"),
            "tagline": s.get("tagline"),
            "rationale": s.get("rationale"),
            "format": s.get("format"),
            "corpus_themes": s.get("corpus_themes", []),
            "generated_brief": s,
            "status": "pending",
        })
    if rows:
        supabase.table("product_suggestions").insert(rows).execute()
        console.print(f"[green]Saved {len(rows)} suggestions to database[/green]")


# ── Draft product from suggestion ─────────────────────────────────────────

def draft_product(ctx: dict, context_str: str, suggestion: dict) -> dict | None:
    pillar_title = suggestion.get("pillar_title") or ""
    console.print(f"\n[bold]Drafting product: {suggestion['title']}[/bold]")

    prompt = f"""{context_str}

── DRAFT PRODUCT DEFINITION ─────────────────────────────────────────────────

Draft a complete product definition for this QS product:

Title: {suggestion['title']}
Tagline: {suggestion.get('tagline', '')}
Format: {suggestion.get('format', '')}
Funnel stage: {suggestion.get('funnel_stage', '')}
Pillar: {pillar_title}
Rationale: {suggestion.get('rationale', '')}
Target price: ${suggestion.get('price_suggestion', 0) or 'TBD'}

Return JSON:
{{
  "product_slug": "kebab-case-slug",
  "name": "Full product name",
  "description": "2-3 sentence description for product page",
  "price": 0.00,
  "estimated_duration": "X minutes",
  "system_prompt": "Full GPT system prompt (300-500 words) grounded in QS philosophy and corpus themes. Must feel initiatory, not just informational.",
  "final_deliverable_prompt": "Prompt that generates the final output/deliverable for the user",
  "steps": [
    {{"step": 1, "title": "...", "description": "...", "prompt": "..."}}
  ],
  "plg_stage": "...",
  "suggested_content_angle": "A one-sentence angle for a blog post that would drive traffic to this product"
}}

Return ONLY valid JSON."""

    resp = openai_client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        max_completion_tokens=2500,
        temperature=0.7,
    )

    try:
        draft = json.loads(resp.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        console.print("[red]Failed to parse product draft[/red]")
        return None

    return draft


def save_product_draft(draft: dict, ctx: dict, suggestion_id: str | None = None) -> bool:
    """Save a drafted product to product_definitions."""
    pillar_map_by_title = {p["title"]: p["id"] for p in ctx["pillars"]}

    row = {
        "product_slug": draft["product_slug"],
        "name": draft["name"],
        "description": draft.get("description"),
        "price": draft.get("price", 0),
        "system_prompt": draft.get("system_prompt", ""),
        "final_deliverable_prompt": draft.get("final_deliverable_prompt", ""),
        "steps": json.dumps(draft.get("steps", [])),
        "total_steps": len(draft.get("steps", [])),
        "estimated_duration": draft.get("estimated_duration"),
        "plg_stage": draft.get("plg_stage"),
        "is_active": False,  # draft — needs review before activating
        "is_purchasable": False,
    }

    try:
        result = supabase.table("product_definitions").insert(row).execute()
        pid = result.data[0]["id"] if result.data else None

        if suggestion_id and pid:
            supabase.table("product_suggestions").update({
                "status": "created",
                "linked_product_id": pid,
            }).eq("id", suggestion_id).execute()

        console.print(f"[green]Product draft saved: {draft['product_slug']}[/green]")
        console.print("[dim]Status: inactive — review in /admin/products before activating[/dim]")
        return True
    except Exception as e:
        console.print(f"[red]Failed to save: {e}[/red]")
        return False


# ── Interactive session ────────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """You are the Strategic Intelligence for Quantum Strategies — a consciousness and business strategy company.

{qs_identity}

You have full context of QS's content map, product catalog, and corpus of sacred texts + science papers.
You think in terms of PLG funnels, content-to-product gaps, and the QS philosophical framework.

When asked strategic questions:
- Ground your analysis in the QS pillars and corpus traditions
- Always consider PLG stage (awareness → interest → consideration → conversion → expansion)
- Flag content-to-product gaps proactively
- Suggest specific, actionable product ideas with pricing and format

When asked to create a product:
- Return structured JSON with all fields needed for product_definitions
- Make the system_prompt initiatory, not just informational

FULL QS CONTEXT:
{context}
"""


def interactive_session(ctx: dict, context_str: str, initial_analysis: dict | None = None):
    system = SYSTEM_PROMPT_TEMPLATE.format(
        qs_identity=QS_IDENTITY,
        context=context_str,
    )
    history = []

    console.print(Panel.fit(
        "[bold]Quantum Strategies — Strategy Intelligence[/bold]\n"
        "[dim]Commands: /analyze  /gaps  /suggest [topic]  /draft [title]  /sync  /exit[/dim]",
        border_style="dim"
    ))

    if initial_analysis:
        console.print("\n" + "─" * 60)
        console.print(Markdown(initial_analysis.get("narrative", "")))
        console.print("─" * 60 + "\n")

        if initial_analysis.get("top_suggestions"):
            console.print("[bold]Top product opportunities:[/bold]\n")
            for i, s in enumerate(initial_analysis["top_suggestions"][:3], 1):
                console.print(
                    f"  [yellow]{i}.[/yellow] [bold]{s['title']}[/bold]  "
                    f"[dim]{s.get('funnel_stage','?')} · {s.get('format','?')}[/dim]\n"
                    f"     {s.get('tagline','')}"
                )
            console.print()

    while True:
        try:
            user_input = Prompt.ask("\n[bold cyan]>[/bold cyan]").strip()
        except (KeyboardInterrupt, EOFError):
            break

        if not user_input:
            continue

        # Slash commands
        if user_input.lower() in ("/exit", "/quit", "exit", "quit"):
            break

        if user_input.lower() == "/gaps":
            print_gap_matrix(ctx)
            continue

        if user_input.lower() == "/analyze":
            ctx2 = load_context()
            ctx.update(ctx2)
            context_str2 = build_context_string(ctx2)
            result = run_gap_analysis(ctx2, context_str2, save=True)
            if result.get("narrative"):
                console.print(Markdown(result["narrative"]))
            continue

        if user_input.lower().startswith("/draft"):
            parts = user_input.split(" ", 1)
            title = parts[1].strip() if len(parts) > 1 else None

            # Find pending suggestion by title or let GPT draft from scratch
            suggestion = {}
            if title:
                matches = [s for s in ctx.get("suggestions", []) if title.lower() in s.get("title", "").lower()]
                if matches:
                    suggestion = matches[0]
                    suggestion["pillar_title"] = (ctx["pillar_map"].get(suggestion.get("pillar_id") or "", {}) or {}).get("title", "")
                else:
                    # Build minimal suggestion from the title
                    suggestion = {"title": title, "funnel_stage": "consideration"}

            if not suggestion.get("title"):
                console.print("[dim]Usage: /draft <product title>[/dim]")
                continue

            draft = draft_product(ctx, context_str, suggestion)
            if draft:
                console.print(Panel(
                    f"[bold]{draft.get('name')}[/bold]\n"
                    f"Slug: {draft.get('product_slug')}\n"
                    f"Price: ${draft.get('price', 0)}\n"
                    f"Steps: {len(draft.get('steps', []))}\n\n"
                    f"[dim]{draft.get('description', '')}[/dim]",
                    title="Product Draft",
                    border_style="green"
                ))
                save_it = Prompt.ask("Save to database?", choices=["y", "n"], default="n")
                if save_it == "y":
                    sid = suggestion.get("id")
                    save_product_draft(draft, ctx, suggestion_id=sid)
            continue

        if user_input.lower() == "/sync":
            _sync_product_pillars(ctx)
            continue

        # Regular conversation
        history.append({"role": "user", "content": user_input})

        resp = openai_client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": system}] + history[-12:],
            max_completion_tokens=1200,
            temperature=0.7,
        )
        reply = resp.choices[0].message.content or ""
        history.append({"role": "assistant", "content": reply})
        console.print(Markdown(reply))


def _sync_product_pillars(ctx: dict):
    """Interactively assign pillar_id and plg_stage to unlinked products."""
    unlinked = [p for p in ctx["products"] if not p.get("pillar_id")]
    if not unlinked:
        console.print("[green]All products are pillar-linked.[/green]")
        return

    console.print(f"\n[bold]{len(unlinked)} unlinked products[/bold]\n")
    pillars = ctx["pillars"]

    for prod in unlinked:
        console.print(f"[bold]{prod['name']}[/bold]  [dim]{prod['product_slug']}  ${prod.get('price',0)}[/dim]")

        console.print("Pillars:")
        for i, p in enumerate(pillars, 1):
            console.print(f"  {i}. {p['title']}")

        choice = Prompt.ask("Pillar # (or skip)", default="skip")
        if choice == "skip":
            continue

        try:
            idx = int(choice) - 1
            pillar_id = pillars[idx]["id"]
        except (ValueError, IndexError):
            continue

        stage = Prompt.ask(
            "PLG stage",
            choices=PLG_STAGES + ["skip"],
            default=prod.get("plg_stage") or "consideration",
        )
        if stage == "skip":
            continue

        supabase.table("product_definitions").update({
            "pillar_id": pillar_id,
            "plg_stage": stage,
        }).eq("id", prod["id"]).execute()

        console.print(f"[green]Updated {prod['product_slug']}[/green]\n")


# ── Entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="QS Strategy Intelligence")
    parser.add_argument("--analyze", action="store_true", help="Run gap analysis and exit")
    parser.add_argument("--gaps",    action="store_true", help="Print gap matrix and exit")
    parser.add_argument("--sync",    action="store_true", help="Sync product PLG metadata")
    args = parser.parse_args()

    ctx = load_context()
    context_str = build_context_string(ctx)

    if args.gaps:
        print_gap_matrix(ctx)
        return

    if args.sync:
        _sync_product_pillars(ctx)
        return

    if args.analyze:
        result = run_gap_analysis(ctx, context_str, save=True)
        if result.get("narrative"):
            console.print(Markdown(result["narrative"]))
        if result.get("top_suggestions"):
            console.print("\n[bold]Suggestions saved to /admin/strategy[/bold]")
        print_gap_matrix(ctx)
        return

    # Default: full interactive session with initial analysis
    console.print("[dim]Running initial analysis...[/dim]")
    initial = run_gap_analysis(ctx, context_str, save=True)
    interactive_session(ctx, context_str, initial_analysis=initial)


if __name__ == "__main__":
    main()
