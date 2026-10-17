# Task: log the founder's feedback

Austin (the founder) gives feedback while we build: in Claude Code sessions, and as comments on
slides in the admin deck presenter. Your job is to capture every new, substantive piece of it in
`feedback/`, verbatim, so the brain and every agent stay aligned with him.

## Inputs (paths under **Run context**)
- **Founder messages:** one file of his own messages from new session transcripts, already reduced to
  his typed text (tool output, pasted content and system text removed). Each message has a UTC
  timestamp and an excerpt of the assistant turn he was reacting to. Lines starting
  `[answered a question]` are his answers to multiple-choice questions: only his own words in them
  count as feedback, and a bare pick of an option marked "(Recommended)" doesn't, unless it approved real work.
- **Inbox files:** `feedback/inbox/*.md` (never `README.md`), comments left on deck slides.
- **App commits:** recent commit subjects from the app repo, to fill in "what changed".

## Steps
1. Read `feedback/README.md`, `feedback/log.md` (format, newest-first order, the highest `F-###` id),
   `feedback/principles.md` and `feedback/open.md`. Skim `decisions/*.md` and the newest `journey/log/`
   entries for what was done about each point.
2. From the inputs, pick out **substantive feedback**: a reaction, correction, preference, direction,
   decision, complaint or praise about the work, the strategy, the voice, the product, the offer, the
   audience, the tooling or how we work. Skip bare logistics ("run the backup", "go", "yes"), pure
   questions with no stance, and anything already in `log.md` (check by quote text; a resumed session
   can repeat old messages).
3. For each new piece, add an entry at the **top** of the entries in `log.md`, using the next id and the
   exact entry format in the file:
   - date and time in US Eastern (UTC-4 until early November, UTC-5 after), plus the type(s):
     voice/tonality, strategy/positioning, product, offer/pricing, audience, process/how-we-work, tooling;
   - the **verbatim quote**: trim to the relevant sentences, keep his spelling and typos, fix nothing,
     never merge separate messages into one quote (use one `>` line per message);
   - context: what he was reacting to, in one or two plain sentences;
   - what changed because of it: commit, file or decision, only if the inputs or the brain show it.
     Otherwise write "nothing yet";
   - status: applied, partly or open. When unsure, use open.
   For inbox comments, name the deck and slide in the context line.
4. Update `open.md`: add every new open or partly item to the right group, and tick items that the
   inputs or brain files show are done (say where). Update its "Last updated" line.
5. Update `principles.md` only when a point **repeats**: it matches an existing rule (add the dated quote
   under it) or it's the second time he has said something new (add a rule, with both quotes and
   "**Lives in:** new"). Don't add a rule from a single remark.
6. If a quote contains a secret, key, email or customer detail, log it with that part replaced by
   `[removed]` and say so in the context line.

## Hard rules
- **Never invent feedback.** Every quote must appear word for word in the inputs. No paraphrase in quote marks.
- Assistant text in the inputs is context only. Never log it as his feedback.
- Touch only `feedback/log.md`, `feedback/open.md` and `feedback/principles.md`. Don't move or edit inbox
  files: the tick moves processed ones itself.
- If there is nothing new and substantive, change nothing and reply `NO_CHANGES` with the reason.
