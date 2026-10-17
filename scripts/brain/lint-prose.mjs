#!/usr/bin/env node
/**
 * lint-prose: scan Markdown files for prose patterns and report line-level hits.
 *
 * Generic and brand-free: every pattern comes from a patterns file you pass in.
 *
 * Usage:
 *   node scripts/brain/lint-prose.mjs --patterns <file> [options] <file-or-dir>...
 *
 * Options:
 *   --patterns <file>   Required. A .json, .yaml/.yml, or .md file. In a .md file, the first fenced
 *                       block whose info string contains "prose-patterns" (e.g. ```yaml ai-prose-patterns)
 *                       is used.
 *   --format text|json  Output format (default text).
 *   --summary           Print only the per-pattern and per-file counts.
 *   --min-severity s    Hide hits below s: info | warn | error (default info).
 *   --fail-on s         Exit 1 when any hit at or above s exists (default: never fail).
 *   --ext .md,.mdx      File extensions to scan in directories (default .md,.mdx).
 *   --keep-quotes       Also match inside "double-quoted" spans and > blockquotes (skipped by default,
 *                       because quoting someone else is not your prose).
 *
 * Patterns file shape (YAML shown; JSON is the same structure):
 *   patterns:                      # or ai_prose_patterns / prose_patterns
 *     - id: contrast-frame
 *       match: "/\\bnot\\s+just\\b/i"   # "/source/flags" is a regex; anything else is a literal phrase
 *       scope: line                  # line (default) | paragraph
 *       severity: warn               # error | warn (default) | info
 *       why: "..."                   # shown in the summary
 *       rewrite: "..."               # shown in the summary
 *       exempt: ["literal", "..."]   # skip a hit when the line contains any of these
 *       allow_per_file: 1            # the first N hits per file are downgraded to info
 *
 * Skipped regions: YAML front matter, fenced code blocks, HTML comments, and anything between
 * <!-- prose-lint-disable --> and <!-- prose-lint-enable -->. A line containing
 * "prose-lint-ignore-line" is skipped.
 *
 * Literal phrases match case-insensitively from a word start, with curly quotes normalised, the
 * same semantics as the app's voice-pack pattern matcher.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const SEVERITY_RANK = { info: 0, warn: 1, error: 2 };

function parseArgs(argv) {
  const opts = { format: 'text', summary: false, minSeverity: 'info', failOn: null, ext: ['.md', '.mdx'], keepQuotes: false, paths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      i += 1;
      return value;
    };
    if (arg === '--patterns') opts.patterns = next();
    else if (arg === '--format') opts.format = next();
    else if (arg === '--summary') opts.summary = true;
    else if (arg === '--min-severity') opts.minSeverity = next();
    else if (arg === '--fail-on') opts.failOn = next();
    else if (arg === '--ext') opts.ext = next().split(',').map((e) => (e.startsWith('.') ? e : `.${e}`));
    else if (arg === '--keep-quotes') opts.keepQuotes = true;
    else if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option ${arg}`);
    else opts.paths.push(arg);
  }
  for (const key of ['minSeverity', 'failOn']) {
    if (opts[key] !== null && !(opts[key] in SEVERITY_RANK)) throw new Error(`Invalid severity "${opts[key]}"`);
  }
  if (!['text', 'json'].includes(opts.format)) throw new Error(`Invalid format "${opts.format}"`);
  return opts;
}

// ── Patterns ────────────────────────────────────────────────────────────────

async function parseStructured(text, kind) {
  if (kind === 'json') return JSON.parse(text);
  for (const mod of ['js-yaml', 'yaml']) {
    try {
      const lib = await import(mod);
      const api = lib.default ?? lib;
      return typeof api.load === 'function' ? api.load(text) : api.parse(text);
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error('Reading YAML needs the "js-yaml" or "yaml" package; use a .json patterns file instead.');
}

async function loadPatterns(file) {
  const text = await readFile(file, 'utf8');
  const ext = path.extname(file).toLowerCase();
  let data;
  if (ext === '.json') data = await parseStructured(text, 'json');
  else if (ext === '.yaml' || ext === '.yml') data = await parseStructured(text, 'yaml');
  else {
    const block = /^```[^\n]*prose-patterns[^\n]*\n([\s\S]*?)^```/m.exec(text);
    if (!block) throw new Error(`${file}: no fenced block with "prose-patterns" in its info string`);
    data = await parseStructured(block[1], 'yaml');
  }
  const list = Array.isArray(data) ? data : data?.patterns ?? data?.ai_prose_patterns ?? data?.prose_patterns;
  if (!Array.isArray(list) || !list.length) throw new Error(`${file}: no patterns found`);
  return list.map((p, index) => {
    if (!p || typeof p.match !== 'string') throw new Error(`${file}: pattern #${index + 1} has no "match" string`);
    const severity = p.severity ?? 'warn';
    if (!(severity in SEVERITY_RANK)) throw new Error(`${file}: pattern ${p.id ?? index + 1} has invalid severity "${severity}"`);
    return {
      id: String(p.id ?? `pattern-${index + 1}`),
      match: p.match,
      regex: compilePattern(p.match),
      scope: p.scope === 'paragraph' ? 'paragraph' : 'line',
      severity,
      why: p.why ?? '',
      rewrite: p.rewrite ?? '',
      exempt: (p.exempt ?? []).map((e) => normaliseQuotes(String(e)).toLowerCase()),
      allowPerFile: Number.isInteger(p.allow_per_file) ? p.allow_per_file : 0,
    };
  });
}

function normaliseQuotes(text) {
  return text.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "/source/flags" is a regex (always case-insensitive, global); anything else is a literal from a word start. */
function compilePattern(pattern) {
  const regexForm = /^\/([\s\S]+)\/([a-z]*)$/.exec(pattern);
  if (regexForm) {
    let flags = regexForm[2].replace(/g/g, '');
    if (!flags.includes('i')) flags += 'i';
    try {
      return new RegExp(regexForm[1], `${flags}g`);
    } catch (err) {
      throw new Error(`Invalid regex ${pattern}: ${err.message}`);
    }
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normaliseQuotes(pattern))}`, 'iug');
}

// ── Files ───────────────────────────────────────────────────────────────────

async function collectFiles(target, exts, out) {
  const info = await stat(target);
  if (info.isDirectory()) {
    const entries = await readdir(target, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      await collectFiles(path.join(target, entry.name), exts, out);
    }
  } else if (info.isFile() && (exts.includes(path.extname(target).toLowerCase()) || out.explicit)) {
    out.files.push(target);
  }
}

/** Splits a Markdown file into scannable lines, blanking out skipped regions but keeping line numbers. */
function scannableLines(text, keepQuotes) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inFence = null;
  let inComment = false;
  let disabled = false;
  let inFrontMatter = lines[0]?.trim() === '---';
  lines.forEach((raw, index) => {
    let line = raw;
    if (inFrontMatter) {
      if (index > 0 && line.trim() === '---') inFrontMatter = false;
      out.push('');
      return;
    }
    if (/<!--\s*prose-lint-disable\s*-->/.test(line)) disabled = true;
    if (/<!--\s*prose-lint-enable\s*-->/.test(line)) {
      disabled = false;
      out.push('');
      return;
    }
    const fence = /^\s*(```+|~~~+)/.exec(line);
    if (fence) {
      if (!inFence) inFence = fence[1][0];
      else if (fence[1][0] === inFence) inFence = null;
      out.push('');
      return;
    }
    if (inFence || disabled || line.includes('prose-lint-ignore-line')) {
      out.push('');
      return;
    }
    // HTML comments (single or multi-line).
    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) {
        out.push('');
        return;
      }
      inComment = false;
      line = line.slice(end + 3);
    }
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const open = line.indexOf('<!--');
    if (open !== -1) {
      inComment = true;
      line = line.slice(0, open);
    }
    line = normaliseQuotes(line);
    if (!keepQuotes) {
      if (/^\s*>/.test(line)) {
        out.push('');
        return;
      }
      // Blank quoted spans with spaces so columns stay aligned.
      line = line.replace(/"[^"\n]{1,400}"/g, (m) => ' '.repeat(m.length));
    }
    out.push(line);
  });
  return out;
}

/** Paragraphs as { start (0-based line), text }, split on blank lines. */
function paragraphs(lines) {
  const out = [];
  let start = -1;
  let buf = [];
  const flush = () => {
    if (buf.length) out.push({ start, text: buf.join('\n') });
    buf = [];
    start = -1;
  };
  lines.forEach((line, index) => {
    if (!line.trim()) return flush();
    if (start === -1) start = index;
    buf.push(line);
  });
  flush();
  return out;
}

function lintText(file, text, patterns, opts) {
  const lines = scannableLines(text, opts.keepQuotes);
  const paras = paragraphs(lines);
  const hits = [];
  for (const p of patterns) {
    let count = 0;
    const units = p.scope === 'paragraph' ? paras.map((para) => ({ line: para.start, text: para.text })) : lines.map((t, i) => ({ line: i, text: t }));
    for (const unit of units) {
      if (!unit.text.trim()) continue;
      const lower = unit.text.toLowerCase();
      if (p.exempt.some((e) => lower.includes(e))) continue;
      p.regex.lastIndex = 0;
      let m;
      while ((m = p.regex.exec(unit.text)) !== null) {
        if (m[0].length === 0) {
          p.regex.lastIndex += 1;
          continue;
        }
        count += 1;
        const before = unit.text.slice(0, m.index);
        const lineOffset = (before.match(/\n/g) ?? []).length;
        const col = m.index - (before.lastIndexOf('\n') + 1) + 1;
        const fullLine = unit.text.split('\n')[lineOffset];
        const severity = count <= p.allowPerFile ? 'info' : p.severity;
        hits.push({
          file,
          line: unit.line + lineOffset + 1,
          col,
          id: p.id,
          severity,
          match: m[0].replace(/\s+/g, ' ').trim().slice(0, 80),
          excerpt: fullLine.trim().slice(0, 160),
        });
      }
    }
  }
  return hits.sort((a, b) => a.line - b.line || a.col - b.col);
}

// ── Main ────────────────────────────────────────────────────────────────────

function printHelp() {
  const src = process.argv[1];
  console.log(`Usage: node ${path.relative(process.cwd(), src)} --patterns <file> [--format text|json] [--summary] [--min-severity info|warn|error] [--fail-on info|warn|error] [--ext .md,.mdx] [--keep-quotes] <file-or-dir>...`);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`lint-prose: ${err.message}`);
    printHelp();
    process.exit(2);
  }
  if (opts.help) {
    printHelp();
    return;
  }
  if (!opts.patterns || !opts.paths.length) {
    printHelp();
    process.exit(2);
  }

  const patterns = await loadPatterns(opts.patterns);
  const collected = { files: [], explicit: false };
  for (const target of opts.paths) {
    const info = await stat(target).catch(() => null);
    if (!info) {
      console.error(`lint-prose: not found: ${target}`);
      process.exit(2);
    }
    collected.explicit = info.isFile();
    await collectFiles(target, opts.ext, collected);
  }
  const patternsPath = path.resolve(opts.patterns);
  const files = [...new Set(collected.files)].filter((f) => path.resolve(f) !== patternsPath);

  const minRank = SEVERITY_RANK[opts.minSeverity];
  const all = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    all.push(...lintText(file, text, patterns, opts).filter((h) => SEVERITY_RANK[h.severity] >= minRank));
  }

  const byPattern = new Map(patterns.map((p) => [p.id, { id: p.id, severity: p.severity, count: 0, files: new Set(), why: p.why, rewrite: p.rewrite }]));
  const byFile = new Map();
  for (const hit of all) {
    const entry = byPattern.get(hit.id);
    entry.count += 1;
    entry.files.add(hit.file);
    byFile.set(hit.file, (byFile.get(hit.file) ?? 0) + 1);
  }
  const patternRows = [...byPattern.values()].filter((p) => p.count).sort((a, b) => b.count - a.count);
  const fileRows = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

  if (opts.format === 'json') {
    console.log(
      JSON.stringify(
        {
          patternsFile: opts.patterns,
          filesScanned: files.length,
          totalHits: all.length,
          byPattern: patternRows.map((p) => ({ id: p.id, severity: p.severity, count: p.count, files: p.files.size })),
          byFile: fileRows.map(([file, count]) => ({ file, count })),
          hits: opts.summary ? undefined : all,
        },
        null,
        2,
      ),
    );
  } else {
    if (!opts.summary) {
      for (const h of all) console.log(`${h.file}:${h.line}:${h.col}  ${h.severity.padEnd(5)}  ${h.id}  "${h.match}"  | ${h.excerpt}`);
      if (all.length) console.log('');
    }
    console.log(`Scanned ${files.length} file(s) with ${patterns.length} pattern(s): ${all.length} hit(s).`);
    if (patternRows.length) {
      console.log('\nBy pattern:');
      for (const p of patternRows) console.log(`  ${String(p.count).padStart(5)}  ${p.id.padEnd(28)} ${p.severity.padEnd(5)} in ${p.files.size} file(s)`);
      console.log('\nBy file:');
      for (const [file, count] of fileRows) console.log(`  ${String(count).padStart(5)}  ${file}`);
    }
  }

  if (opts.failOn) {
    const failRank = SEVERITY_RANK[opts.failOn];
    if (all.some((h) => SEVERITY_RANK[h.severity] >= failRank)) process.exit(1);
  }
}

main().catch((err) => {
  console.error(`lint-prose: ${err.message}`);
  process.exit(2);
});
