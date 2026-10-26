/**
 * The match key shared by Search Console queries, the topical map's phrasings and Keyword Planner rows.
 *
 * Same normalisation as kpKey() in scripts/brain/lib/topical-map/keyword-planner.ts (a test pins them equal):
 * lowercase, accents stripped, "&" read as "and", every run of non [a-z0-9] characters one space. Kept here so
 * app code does not import from scripts/ (which pulls node:fs into the route bundle).
 */
export function keywordKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
