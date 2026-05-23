/**
 * DB accuracy validation: compares calculator output against AI-extracted placements
 * from confirmed user uploads.
 *
 * Strategy:
 * 1. Fetch all users with placements_confirmed = true from Supabase
 * 2. List their uploaded files from storage
 * 3. Extract birth data from:
 *    a. astro-seek filenames (URL params / filename patterns)
 *    b. cafeastrology / astrolabe PDF text (pdfParse)
 *    c. GPT-4 vision on images as fallback
 * 4. Run calculator for each resolved birth data set
 * 5. Compare sun/moon/rising sign and HD type/profile against stored placements
 * 6. Print accuracy report
 *
 * Usage:
 *   npx tsx scripts/calculator/validate-db.ts
 *   npx tsx scripts/calculator/validate-db.ts --vision   # enable GPT-4 vision for images
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import { find as getTimezone } from 'geo-tz';
import { calculateChart } from './index';
import type { BirthData } from './types';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_KEY = process.env.OPENAI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const USE_VISION = process.argv.includes('--vision');

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredUser {
  id: string;
  email: string;
  placements: {
    astrology?: Record<string, string>;
    human_design?: Record<string, string | number[] | object>;
  };
}

interface ResolvedBirthData {
  userId: string;
  email: string;
  birthData: BirthData;
  source: string; // how we got birth data
}

interface ValidationResult {
  userId: string;
  email: string;
  source: string;
  checks: Array<{ field: string; expected: string; computed: string; match: boolean }>;
  passCount: number;
  totalCount: number;
}

// ─── Birth data parsers ───────────────────────────────────────────────────────

/** Parse astro-seek URL-encoded filenames like:
 *  ...narozeni_den=22&narozeni_mesic=4&narozeni_rok=1993&narozeni_hodina=08&narozeni_minuta=36&narozeni_city=Edina,+USA,+Mi...
 */
function parseAstroSeekUrl(filename: string): { day: number; month: number; year: number; hour: number; minute: number; city: string } | null {
  const den = filename.match(/narozeni_den=(\d+)/)?.[1];
  const mesic = filename.match(/narozeni_mesic=(\d+)/)?.[1];
  const rok = filename.match(/narozeni_rok=(\d+)/)?.[1];
  const hodina = filename.match(/narozeni_hodina=(\d+)/)?.[1];
  const minuta = filename.match(/narozeni_minuta=(\d+)/)?.[1];
  const cityRaw = filename.match(/narozeni_city=([^&\n]+)/)?.[1];
  if (!den || !mesic || !rok || !hodina || !minuta) return null;
  return {
    day: parseInt(den),
    month: parseInt(mesic),
    year: parseInt(rok),
    hour: parseInt(hodina),
    minute: parseInt(minuta),
    city: cityRaw ? decodeURIComponent(cityRaw.replace(/\+/g, ' ')).split(',')[0].trim() : '',
  };
}

/** Parse astro-seek export filenames like:
 *  horoscope_natal_22-1-1997_00-19_astroseek_v4.png
 */
function parseAstroSeekFilename(filename: string): { day: number; month: number; year: number; hour: number; minute: number } | null {
  const m = filename.match(/horoscope_natal_(\d+)-(\d+)-(\d+)_(\d+)-(\d+)_astroseek/);
  if (!m) return null;
  return {
    day: parseInt(m[1]),
    month: parseInt(m[2]),
    year: parseInt(m[3]),
    hour: parseInt(m[4]),
    minute: parseInt(m[5]),
  };
}

/** Geocode a city name to lat/lng using a small hardcoded table + OpenAI fallback */
const CITY_COORDS: Record<string, { lat: number; lng: number; tz: string }> = {
  'Edina': { lat: 44.8797, lng: -93.3497, tz: 'America/Chicago' },
  'Minneapolis': { lat: 44.9778, lng: -93.2650, tz: 'America/Chicago' },
  'Chicago': { lat: 41.8781, lng: -87.6298, tz: 'America/Chicago' },
  'New York': { lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  'Brooklyn': { lat: 40.6782, lng: -73.9442, tz: 'America/New_York' },
  'Jersey City': { lat: 40.7282, lng: -74.0776, tz: 'America/New_York' },
  'Newark': { lat: 40.7357, lng: -74.1724, tz: 'America/New_York' },
  'Los Angeles': { lat: 34.0522, lng: -118.2437, tz: 'America/Los_Angeles' },
  'London': { lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  'Toronto': { lat: 43.6532, lng: -79.3832, tz: 'America/Toronto' },
  'Atlanta': { lat: 33.7490, lng: -84.3880, tz: 'America/New_York' },
  'Houston': { lat: 29.7604, lng: -95.3698, tz: 'America/Chicago' },
  'Miami': { lat: 25.7617, lng: -80.1918, tz: 'America/New_York' },
  'Dallas': { lat: 32.7767, lng: -96.7970, tz: 'America/Chicago' },
  'Denver': { lat: 39.7392, lng: -104.9903, tz: 'America/Denver' },
  'Seattle': { lat: 47.6062, lng: -122.3321, tz: 'America/Los_Angeles' },
  'San Francisco': { lat: 37.7749, lng: -122.4194, tz: 'America/Los_Angeles' },
  'Pittsburg': { lat: 37.9277, lng: -121.8847, tz: 'America/Los_Angeles' },  // Pittsburg CA (not Pittsburgh PA)
  'Pittsburgh': { lat: 40.4406, lng: -79.9959, tz: 'America/New_York' },     // Pittsburgh PA
  'Oakland': { lat: 37.8044, lng: -122.2711, tz: 'America/Los_Angeles' },
  'Antioch': { lat: 37.9963, lng: -121.8058, tz: 'America/Los_Angeles' },
  'Boston': { lat: 42.3601, lng: -71.0589, tz: 'America/New_York' },
  'Philadelphia': { lat: 39.9526, lng: -75.1652, tz: 'America/New_York' },
  'Phoenix': { lat: 33.4484, lng: -112.0740, tz: 'America/Phoenix' },
  'Washington': { lat: 38.9072, lng: -77.0369, tz: 'America/New_York' },
  'Detroit': { lat: 42.3314, lng: -83.0458, tz: 'America/Detroit' },
  'Charlotte': { lat: 35.2271, lng: -80.8431, tz: 'America/New_York' },
  'Baltimore': { lat: 39.2904, lng: -76.6122, tz: 'America/New_York' },
  'Las Vegas': { lat: 36.1699, lng: -115.1398, tz: 'America/Los_Angeles' },
  'Sacramento': { lat: 38.5816, lng: -121.4944, tz: 'America/Los_Angeles' },
  'San Diego': { lat: 32.7157, lng: -117.1611, tz: 'America/Los_Angeles' },
  'Portland': { lat: 45.5051, lng: -122.6750, tz: 'America/Los_Angeles' },
  'Nashville': { lat: 36.1627, lng: -86.7816, tz: 'America/Chicago' },
  'Memphis': { lat: 35.1495, lng: -90.0490, tz: 'America/Chicago' },
  'Columbus': { lat: 39.9612, lng: -82.9988, tz: 'America/New_York' },
  'Indianapolis': { lat: 39.7684, lng: -86.1581, tz: 'America/Indiana/Indianapolis' },
  'Lagos': { lat: 6.5244, lng: 3.3792, tz: 'Africa/Lagos' },
  'Nairobi': { lat: -1.2921, lng: 36.8219, tz: 'Africa/Nairobi' },
  'Dubai': { lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  'Tehran': { lat: 35.6892, lng: 51.3890, tz: 'Asia/Tehran' },
};

async function geocodeCity(city: string): Promise<{ lat: number; lng: number; tz: string } | null> {
  // Direct lookup
  for (const [key, val] of Object.entries(CITY_COORDS)) {
    if (city.toLowerCase().includes(key.toLowerCase())) return val;
  }
  // GPT-4 fallback
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Return JSON only: {"lat": <number>, "lng": <number>, "tz": "<IANA timezone>"} for the city: "${city}". No commentary.`
      }],
      response_format: { type: 'json_object' },
      max_tokens: 100,
    });
    const parsed = JSON.parse(res.choices[0].message.content || '{}');
    if (parsed.lat && parsed.lng && parsed.tz) return parsed;
  } catch {}
  return null;
}

/** Extract birth data from cafeastrology PDF text.
 *  Format: "City, State Country MM/DD/YYYY HH:MM"
 */
async function parseCafeAstrologyText(text: string): Promise<{ date: string; time: string; lat: number; lng: number; tz: string } | null> {
  // Pattern: "Los Angeles, CA United States 03/30/1985 22:30"
  const m = text.match(/([A-Za-z\s]+,\s*[A-Z]{2})[^\n]*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;

  const city = m[1].trim().split(',')[0].trim();
  const month = parseInt(m[2]);
  const day = parseInt(m[3]);
  const year = parseInt(m[4]);
  const hour = parseInt(m[5]);
  const minute = parseInt(m[6]);

  const date = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const time = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

  const coords = await geocodeCity(city);
  if (!coords) return null;

  return { date, time, lat: coords.lat, lng: coords.lng, tz: coords.tz };
}

/** Extract birth data from Astrolabe PDF text.
 *  Format:
 *    "August 9 1999"
 *    "11:54 PM Time Zone is EDT"
 *    "Jersey City, NJ"
 */
async function parseAstrolabeText(text: string): Promise<{ date: string; time: string; lat: number; lng: number; tz: string } | null> {
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const dateMatch = text.match(/([A-Z][a-z]+)\s+(\d{1,2})\s+(\d{4})/);
  const timeMatch = text.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  // "Jersey City, NJ" or "New York, NY" style city line
  const cityMatch = text.match(/([A-Za-z\s]+),\s*([A-Z]{2})\s*(?:\n|$)/m);

  if (!dateMatch || !timeMatch) return null;

  const monthNum = MONTH_NAMES.findIndex(mn => mn.toLowerCase() === dateMatch[1].toLowerCase()) + 1;
  if (monthNum === 0) return null;

  let hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);
  const ampm = timeMatch[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = `${dateMatch[3]}-${String(monthNum).padStart(2,'0')}-${String(parseInt(dateMatch[2])).padStart(2,'0')}`;
  const time = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;

  const city = cityMatch ? cityMatch[1].trim() : '';
  const coords = city ? await geocodeCity(city) : null;
  if (!coords) return null;

  return { date, time, lat: coords.lat, lng: coords.lng, tz: coords.tz };
}

/** Use GPT-4 vision to extract birth data from a chart image */
async function extractBirthDataVision(signedUrl: string, email: string): Promise<{ date: string; time: string; lat?: number; lng?: number; city?: string } | null> {
  if (!openai) return null;
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract birth data from this astrology chart image. Return JSON only:\n{"date": "YYYY-MM-DD", "time": "HH:MM", "city": "<city name>", "lat": <number or null>, "lng": <number or null>}\nIf any field is not visible, use null. Never guess.`
          },
          { type: 'image_url', image_url: { url: signedUrl } }
        ]
      }],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0,
    });
    return JSON.parse(res.choices[0].message.content || 'null');
  } catch (e) {
    console.warn(`    Vision extraction failed for ${email}: ${e}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function normalizeSign(raw: string): string {
  // Extract just the sign name from strings like "Taurus 12th house" or "Gemini"
  const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  for (const s of signs) {
    if (raw.toLowerCase().includes(s.toLowerCase())) return s;
  }
  return raw.split(' ')[0]; // fallback: first word
}

function normalizeHdType(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes('manifesting generator') || r.includes('mani gen')) return 'Manifesting Generator';
  if (r.includes('manifestor')) return 'Manifestor';
  if (r.includes('generator')) return 'Generator';
  if (r.includes('projector')) return 'Projector';
  if (r.includes('reflector')) return 'Reflector';
  return raw;
}

function normalizeProfile(raw: string): string {
  const m = raw.match(/(\d+)\/(\d+)/);
  return m ? `${m[1]}/${m[2]}` : raw;
}

async function main() {
  console.log('=== Calculator DB Validation ===\n');

  // 1. Fetch users with confirmed placements
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, email, placements')
    .eq('placements_confirmed', true)
    .not('placements', 'is', null);

  if (usersErr || !users) {
    console.error('Failed to fetch users:', usersErr);
    process.exit(1);
  }
  console.log(`Found ${users.length} users with confirmed placements\n`);

  // 2. For each user, list their uploaded files
  const { data: allFiles, error: filesErr } = await supabase
    .storage
    .from('user-uploads')
    .list('', { limit: 1000 });

  // Storage list('') only shows top-level folders (user IDs). Need to list each.
  const resolvedUsers: ResolvedBirthData[] = [];

  for (const user of users as StoredUser[]) {
    console.log(`Processing: ${user.email} (${user.id})`);

    // List files for this user — recurse two levels deep (profile/, <session-id>/)
    const { data: userFiles } = await supabase
      .storage
      .from('user-uploads')
      .list(user.id, { limit: 200 });

    if (!userFiles || userFiles.length === 0) {
      console.log('  No files found\n');
      continue;
    }

    const allPaths: string[] = [];
    for (const entry of userFiles) {
      const entryPath = `${user.id}/${entry.name}`;
      if (!entry.metadata) {
        // It's a folder — list its contents
        const { data: subFiles } = await supabase
          .storage
          .from('user-uploads')
          .list(entryPath, { limit: 200 });
        if (subFiles) {
          for (const f of subFiles) {
            if (!f.metadata) {
              // Another level deep
              const { data: deep } = await supabase
                .storage
                .from('user-uploads')
                .list(`${entryPath}/${f.name}`, { limit: 100 });
              if (deep) deep.forEach(d => allPaths.push(`${entryPath}/${f.name}/${d.name}`));
            } else {
              allPaths.push(`${entryPath}/${f.name}`);
            }
          }
        }
      } else {
        allPaths.push(entryPath);
      }
    }

    console.log(`  Files: ${allPaths.length}`);

    // Try to extract birth data
    let resolved: ResolvedBirthData | null = null;

    for (const filePath of allPaths) {
      const filename = path.basename(filePath);

      // Try astro-seek URL params
      const seekUrl = parseAstroSeekUrl(filename);
      if (seekUrl) {
        const city = seekUrl.city || 'Unknown';
        const coords = await geocodeCity(city);
        if (coords) {
          const date = `${seekUrl.year}-${String(seekUrl.month).padStart(2,'0')}-${String(seekUrl.day).padStart(2,'0')}`;
          const time = `${String(seekUrl.hour).padStart(2,'0')}:${String(seekUrl.minute).padStart(2,'0')}`;
          resolved = {
            userId: user.id, email: user.email, source: `astro-seek URL params (${filename.slice(0,40)}...)`,
            birthData: { birthDate: date, birthTime: time, timezone: coords.tz, lat: coords.lat, lng: coords.lng }
          };
          console.log(`  Source: astro-seek URL → ${date} ${time} ${city}`);
          break;
        }
      }

      // Try astro-seek filename pattern
      const seekFile = parseAstroSeekFilename(filename);
      if (seekFile) {
        const date = `${seekFile.year}-${String(seekFile.month).padStart(2,'0')}-${String(seekFile.day).padStart(2,'0')}`;
        const time = `${String(seekFile.hour).padStart(2,'0')}:${String(seekFile.minute).padStart(2,'0')}`;
        // No city info — try to infer from user's other files or default
        // For now: skip without coords; will fall through to PDF/vision
        console.log(`  Filename hint: ${date} ${time} (no city — trying PDF/vision)`);
        // Store as candidate; will finalize after PDF check
      }
    }

    if (resolved) {
      resolvedUsers.push(resolved);
      console.log();
      continue;
    }

    // Try PDF extraction
    for (const filePath of allPaths) {
      const filename = path.basename(filePath).toLowerCase();
      if (!filename.endsWith('.pdf')) continue;
      if (filename.includes('humandesign') || filename.includes('human-design') || filename.includes('human_design') || filename.includes('resume')) continue;

      console.log(`  Trying PDF: ${path.basename(filePath)}`);

      const { data: pdfData, error: dlErr } = await supabase
        .storage
        .from('user-uploads')
        .download(filePath);

      if (dlErr || !pdfData) {
        console.warn(`    Download failed: ${dlErr?.message}`);
        continue;
      }

      const buffer = Buffer.from(await pdfData.arrayBuffer());
      let text = '';
      try {
        const parsed = await pdfParse(buffer);
        text = parsed.text || '';
      } catch {
        continue;
      }

      // Try cafeastrology
      const cafeResult = await parseCafeAstrologyText(text);
      if (cafeResult && cafeResult.lat && cafeResult.lng) {
        resolved = {
          userId: user.id, email: user.email, source: `cafeastrology PDF (${path.basename(filePath)})`,
          birthData: { birthDate: cafeResult.date, birthTime: cafeResult.time, timezone: cafeResult.tz, lat: cafeResult.lat, lng: cafeResult.lng }
        };
        console.log(`  Source: cafeastrology → ${cafeResult.date} ${cafeResult.time}`);
        break;
      }

      // Try astrolabe
      const astrolabeResult = await parseAstrolabeText(text);
      if (astrolabeResult && astrolabeResult.lat && astrolabeResult.lng) {
        resolved = {
          userId: user.id, email: user.email, source: `astrolabe PDF (${path.basename(filePath)})`,
          birthData: { birthDate: astrolabeResult.date, birthTime: astrolabeResult.time, timezone: astrolabeResult.tz, lat: astrolabeResult.lat, lng: astrolabeResult.lng }
        };
        console.log(`  Source: astrolabe → ${astrolabeResult.date} ${astrolabeResult.time}`);
        break;
      }
    }

    if (resolved) {
      resolvedUsers.push(resolved);
      console.log();
      continue;
    }

    // GPT-4 vision fallback for images
    if (USE_VISION) {
      for (const filePath of allPaths) {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
        const filename = path.basename(filePath).toLowerCase();
        if (filename.includes('humandesign') || filename.includes('human-design') || filename.includes('bodygraph')) continue;

        console.log(`  Vision: ${path.basename(filePath)}`);

        const { data: signedData } = await supabase
          .storage
          .from('user-uploads')
          .createSignedUrl(filePath, 60 * 5);

        if (!signedData?.signedUrl) continue;

        const visionResult = await extractBirthDataVision(signedData.signedUrl, user.email);
        if (visionResult?.date && visionResult?.time) {
          let lat = visionResult.lat || 0;
          let lng = visionResult.lng || 0;
          let tz = 'America/New_York';
          if (!lat && visionResult.city) {
            const coords = await geocodeCity(visionResult.city);
            if (coords) { lat = coords.lat; lng = coords.lng; tz = coords.tz; }
          } else if (lat && lng) {
            const tzCandidates = getTimezone(lat, lng);
            tz = tzCandidates[0] || tz;
          }
          if (lat && lng) {
            resolved = {
              userId: user.id, email: user.email, source: `GPT-4 vision (${path.basename(filePath)})`,
              birthData: { birthDate: visionResult.date, birthTime: visionResult.time, timezone: tz, lat, lng }
            };
            console.log(`  Vision extracted: ${visionResult.date} ${visionResult.time}`);
            break;
          }
        }
      }
    }

    if (resolved) {
      resolvedUsers.push(resolved);
    } else {
      console.log(`  Could not extract birth data${USE_VISION ? '' : ' (try --vision for image extraction)'}`);
    }
    console.log();
  }

  if (resolvedUsers.length === 0) {
    console.log('No birth data could be resolved for any user. Try running with --vision');
    process.exit(0);
  }

  // 3. Run calculator + compare
  console.log(`\n=== Running Calculator for ${resolvedUsers.length} users ===\n`);

  const results: ValidationResult[] = [];

  for (const resolved of resolvedUsers) {
    console.log(`Calculating: ${resolved.email}`);
    console.log(`  Birth: ${resolved.birthData.birthDate} ${resolved.birthData.birthTime} ${resolved.birthData.timezone} (${resolved.birthData.lat}, ${resolved.birthData.lng})`);

    let chart;
    try {
      chart = await calculateChart(resolved.birthData);
    } catch (e) {
      console.error(`  Calculator error: ${e}`);
      continue;
    }

    // Get stored placements for this user
    const user = (users as StoredUser[]).find(u => u.id === resolved.userId)!;
    const stored = user.placements;
    const astro = stored.astrology || {};
    const hd = stored.human_design || {};

    const checks: ValidationResult['checks'] = [];

    // Sun sign
    const storedSun = normalizeSign(astro.sun || '');
    const computedSun = chart.western.planets.sun?.sign || '';
    if (storedSun && computedSun) {
      checks.push({ field: 'Sun sign', expected: storedSun, computed: computedSun, match: storedSun === computedSun });
    }

    // Moon sign
    const storedMoon = normalizeSign(astro.moon || '');
    const computedMoon = chart.western.planets.moon?.sign || '';
    if (storedMoon && computedMoon) {
      checks.push({ field: 'Moon sign', expected: storedMoon, computed: computedMoon, match: storedMoon === computedMoon });
    }

    // Rising sign
    const storedRising = normalizeSign(astro.rising || '');
    const computedRising = chart.western.planets.sun ? (() => {
      // ASC is in houses[0] (whole sign, so house 1 cusp sign = ASC sign)
      const ascDeg = chart.western.houses[0];
      const signs = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
      return signs[Math.floor(ascDeg / 30)];
    })() : '';
    if (storedRising && computedRising) {
      checks.push({ field: 'Rising sign', expected: storedRising, computed: computedRising, match: storedRising === computedRising });
    }

    // HD Type
    const storedType = normalizeHdType(String(hd.type || ''));
    const computedType = chart.humanDesign.type;
    if (storedType) {
      checks.push({ field: 'HD Type', expected: storedType, computed: computedType, match: storedType === computedType });
    }

    // HD Profile
    const storedProfile = normalizeProfile(String(hd.profile || ''));
    const computedProfile = chart.humanDesign.profile;
    if (storedProfile && storedProfile.includes('/')) {
      checks.push({ field: 'HD Profile', expected: storedProfile, computed: computedProfile, match: storedProfile === computedProfile });
    }

    // HD Authority (normalize)
    const storedAuth = String(hd.authority || '').toLowerCase();
    const computedAuth = chart.humanDesign.authority.toLowerCase();
    if (storedAuth && !storedAuth.includes('unknown')) {
      const match = storedAuth.includes(computedAuth) || computedAuth.includes(storedAuth.split(' ')[0]);
      checks.push({ field: 'HD Authority', expected: String(hd.authority), computed: chart.humanDesign.authority, match });
    }

    const passCount = checks.filter(c => c.match).length;
    const totalCount = checks.length;

    results.push({
      userId: resolved.userId,
      email: resolved.email,
      source: resolved.source,
      checks,
      passCount,
      totalCount,
    });

    for (const c of checks) {
      const icon = c.match ? '✓' : '✗';
      console.log(`  ${icon} ${c.field}: expected "${c.expected}", got "${c.computed}"`);
    }
    console.log(`  Score: ${passCount}/${totalCount}\n`);
  }

  // 4. Summary
  console.log('\n=== Accuracy Report ===\n');
  console.log(`Users validated: ${results.length}`);

  const totalPass = results.reduce((s, r) => s + r.passCount, 0);
  const totalChecks = results.reduce((s, r) => s + r.totalCount, 0);
  console.log(`Overall: ${totalPass}/${totalChecks} (${totalChecks ? ((totalPass/totalChecks)*100).toFixed(1) : 0}%)\n`);

  // Per-field breakdown
  const fieldStats: Record<string, { pass: number; total: number }> = {};
  for (const r of results) {
    for (const c of r.checks) {
      if (!fieldStats[c.field]) fieldStats[c.field] = { pass: 0, total: 0 };
      fieldStats[c.field].pass += c.match ? 1 : 0;
      fieldStats[c.field].total += 1;
    }
  }
  console.log('Per-field accuracy:');
  for (const [field, stat] of Object.entries(fieldStats)) {
    const pct = ((stat.pass / stat.total) * 100).toFixed(0);
    console.log(`  ${field}: ${stat.pass}/${stat.total} (${pct}%)`);
  }

  // Failures
  const failures = results.flatMap(r => r.checks.filter(c => !c.match).map(c => ({ email: r.email, ...c })));
  if (failures.length > 0) {
    console.log('\nMismatches:');
    for (const f of failures) {
      console.log(`  ${f.email} — ${f.field}: expected "${f.expected}", got "${f.computed}"`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
