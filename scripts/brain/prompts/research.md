# Task: digest the latest research sweep and write the briefing

New YouTube research is in the raw cache directories listed under **Run context**. Each
`<creator>.json` has the channel stats, `median_views`, `recent_uploads` (with an `outlier` score =
views ÷ channel median) and `picks`: the top outliers, each with a `transcript` (`ok` + timed
segments) and the most-liked `comments`. This cache is **input only**. Never copy it into the brain.

## Steps
1. Orient yourself: read `README.md`, `content/taxonomy.md`, `content/hooks-and-titles.md`,
   `research/transcripts/README.md`, `research/conversation/youtube-comments.md`, the relevant
   `research/creators/*.md` dossiers and `strategy/cult-os-blueprint.md` (section 1, the Laws of Life).
2. **Transcript breakdowns.** For every pick with `transcript.ok == true` that doesn't already have
   a note in `research/transcripts/` (match on video title or id), write
   `research/transcripts/<creator-key>-<short-slug>.md`. Follow the structure of the existing notes
   exactly (hook → credibility → moves → CTA with timestamps, mechanism and honesty check, why it
   works, what QS does differently, steal-able lines, top-comment signal) and their tag line. Add a
   row to the index table in `research/transcripts/README.md`, keeping it sorted by outlier, and
   update the cross-video patterns there if the new videos change them.
3. **Comments.** Update `research/conversation/youtube-comments.md` with any new signal from
   the comments: pains, desires, objections and language. Keep its rules: no usernames, short
   verbatim quotes only, and likes show attention, not representativeness.
4. **Creators.** In each swept creator's `research/creators/<key>.md`, add or refresh a
   `## Sweep <date>` section: follower count, median views, the top outliers and what changed
   since the last sweep. Create a dossier only for a creator that has none, matching the siblings.
5. **Briefing.** Write `briefings/<today>.md` (create `briefings/` and a `briefings/README.md`
   index if missing, and add `briefings/` to the root `README.md` structure list). It follows
   `content/briefing-standard.md` (read it first; the snapshot stage turns this file into the deck
   Austin reads). Open with **What this means for Austin:** two to four plain sentences on what changed
   for his goals (his thought leadership, the Rites, the quiz, revenue) and the one move it points to.
   Every point below gives context before the number (who the creator is, what the video is, when),
   a baseline (vs the last sweep or the channel median, written as "31.6 times his median views"),
   the so-what for Austin and an evidence grade (strong / medium / thin). Creators are context for his
   move; follower drift that changes nothing he does is left out. No internal codes without a gloss.
   - **What's new:** the videos, numbers and outliers since the last briefing (read the previous
     briefing if one exists), each with what it means for Austin
   - **Patterns:** hooks, formats and mechanisms that recur across creators, with evidence
   - **Contradictions:** where the sphere's claims conflict with the Laws of Life in
     `strategy/cult-os-blueprint.md`, and whether that's an attack angle or a warning for us
   - **Top 5 content angles,** each placed in the taxonomy tree as
     `Rite → Pillar → Topic → Angle → Format`, with a Domain tag, the hook pattern it uses and the
     evidence behind it (file links). Mark any topic that isn't in the taxonomy yet as **(proposed)**.
   - **Next moves:** what Austin or the build should do, each asset marked LIVE or TO BUILD
     (check `strategy/live-vs-build.md`)
   - **Pipeline health** (last, and the only place for plumbing): transcript, comment and upload fetch
     counts, blocks and failures in plain words ("YouTube blocked our IP address", never a raw error
     code), whether any insight was lost, and what is being done about each (owner or "unassigned").
     Picks whose transcripts are still missing are listed here as such, never guessed at
6. Short quotes only: under 25 words each, a handful per video. Never paste transcript passages.
