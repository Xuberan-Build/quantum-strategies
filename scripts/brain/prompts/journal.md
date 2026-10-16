# Task: journal one working session

A condensed transcript of one Claude Code working session on the Quantum Strategies app is
at the path given under **Run context**. It holds user and assistant text only; tool
results were dropped, and lines like `[Edit path]` / `[Bash: …]` mark actions that were taken.

## Steps
1. Read `journey/README.md` for the purpose, file list and entry template, and follow them exactly.
2. Read the transcript. Decide whether it's **journal-worthy**: something was built, decided,
   learned, broken or discovered. A session that was only a quick question, a trivial edit or
   an abandoned start is **not**. In that case, write nothing and reply
   `NO_CHANGES: trivial session`.
3. Check `journey/log/` for an existing entry covering the same session (same date and topic).
   If there is one, update it rather than creating a duplicate.
4. Write `journey/log/<session-date>-<short-kebab-slug>.md` using the template in
   `journey/README.md`. Take the date from the transcript timestamps (local date, YYYY-MM-DD).
   Be specific: name files, commits and PRs where the transcript shows them. Record the
   approaches that failed and why. Add `#content` only when there's a genuinely interesting
   build-in-public story.
5. Fold the durable items into the shared files, following each file's existing format and
   ordering. If a file doesn't exist yet, create it with a short header like its siblings and
   list it in `journey/README.md`:
   - `journey/decisions.md`: real decisions with a why and the alternatives rejected
   - `journey/learnings.md`: reusable lessons, grouped by theme, each linking its source log entry
   - `journey/incidents.md`: failures, outages and near-misses, with impact and the guardrail now in place
   - `journey/open-questions.md`: unanswered questions; mark any that this session answered as resolved
   - `journey/timeline.md`: only if a milestone or a new era happened
6. Never copy secrets, env values, keys, customer data or long code blocks from the transcript.
