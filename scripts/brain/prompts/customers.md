# Task: refresh the customer voice

The anonymised customer-signal JSON is at the path given under **Run context**. It was
produced by a deterministic read-only script. It holds aggregate counts, score averages and
short, scrubbed free-text excerpts from session insights, step friction, the beta feedback
tables, conversion results and beta participant stages.

## Steps
1. Read `research/conversation/customers.md` and keep its structure, headings, caveat style and
   privacy rules.
2. Update it from the JSON:
   - the date and caveat (sample sizes)
   - the **Sources and row counts** table
   - who is showing up, top pains (re-code the pain clusters from the excerpts, with counts),
     what lands (score tables), where people get stuck, and quotes
   - a short **What changed since last time** section near the top: deltas in counts and scores,
     and new themes
3. Quotes must be under 25 words, with personal specifics removed, and never attributed beyond
   "Beta user" plus the product. Where an excerpt could identify someone even after trimming, paraphrase it instead.
4. If a source table is empty, say so plainly (empty tables are signal too).
5. If the JSON shows an `errors` entry for a table, note that the table couldn't be read this run,
   and keep that table's previous numbers marked "(stale)".
6. Don't touch any other file, except a one-line pointer in `briefings/<today>.md` if it exists.
