// Fetches species data from Wikipedia and writes src/data/bugs.json.
// Usage: npm run fetch-bugs
// Uses batched action-API queries (20 titles per request) to stay well within rate limits.
import { writeFile } from 'node:fs/promises';
import { SPECIES } from './species.mjs';

const OUT = new URL('../src/data/bugs.json', import.meta.url);
const HEADERS = { 'User-Agent': 'BugGardenGame/1.0 (educational game; build-time data fetch)' };
const API = 'https://en.wikipedia.org/w/api.php';
const BATCH = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(params) {
  const url = `${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', ...params })}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    const retryAfter = Number(res.headers.get('retry-after')) * 1000;
    const wait = Math.max(retryAfter || 0, Math.min(60000, 3000 * 2 ** attempt));
    console.warn(`HTTP ${res.status}, retrying in ${Math.round(wait / 1000)}s…`);
    await sleep(wait);
  }
  throw new Error(`Failed: ${url}`);
}

// Maps each requested title to the final page title (after normalisation + redirects).
function resolveTitles(data, titles) {
  const map = new Map(titles.map((t) => [t, t]));
  for (const n of data.query?.normalized ?? []) for (const [k, v] of map) if (v === n.from) map.set(k, n.to);
  for (const r of data.query?.redirects ?? []) for (const [k, v] of map) if (v === r.from) map.set(k, r.to);
  return map;
}

// Pull `| status = XX` and `| status_system = YY` out of the taxobox.
function parseStatus(text) {
  const field = (key) => {
    const m = text.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n}<]*)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const raw = field('status').toUpperCase().replace(/\s+/g, '');
  const system = field('status_system').toUpperCase().replace(/\s+/g, '');
  if (!raw) return { status: 'NE', system: '', raw: '' };

  if (system.startsWith('IUCN') || !system) {
    const iucn = {
      EX: 'EX', EW: 'EW', CR: 'CR', 'CR(PE)': 'CR', PE: 'CR', EN: 'EN', VU: 'VU', NT: 'NT', LC: 'LC',
      DD: 'DD', NE: 'NE', 'LR/CD': 'NT', 'LR/NT': 'NT', 'LR/LC': 'LC', CD: 'NT',
    };
    if (iucn[raw]) return { status: iucn[raw], system, raw };
  }
  if (system.startsWith('TNC') || /^[GT]\d|^GX|^GH/.test(raw)) {
    const g = raw.replace(/^T/, 'G');
    if (/^GX/.test(g)) return { status: 'EX', system, raw };
    if (/^GH/.test(g)) return { status: 'CR', system, raw };
    const n = parseInt(g.slice(1), 10);
    const byRank = { 1: 'CR', 2: 'EN', 3: 'VU', 4: 'LC', 5: 'LC' };
    if (byRank[n]) return { status: byRank[n], system, raw };
  }
  if (raw === 'SECURE' || raw === 'NOTTHREATENED') return { status: 'LC', system, raw };
  if (raw.includes('EXTINCT')) return { status: 'EX', system, raw };
  return { status: 'NE', system, raw };
}

async function fetchBatch(entries) {
  const titles = entries.map(([, [sci]]) => sci);
  const joined = titles.join('|');
  const content = await query({ prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: joined });
  await sleep(1500);
  const meta = await query({
    prop: 'extracts|pageimages|info',
    exintro: '1', explaintext: '1', exlimit: 'max',
    piprop: 'thumbnail', pithumbsize: '480', pilimit: 'max',
    inprop: 'url', titles: joined,
  });
  await sleep(1500);

  const titleMap = resolveTitles(content, titles);
  const byTitle = (data) => new Map((data.query?.pages ?? []).map((p) => [p.title, p]));
  const contentPages = byTitle(content);
  const metaPages = byTitle(meta);

  return entries.map(([order, [sci, common]]) => {
    const title = titleMap.get(sci);
    const page = contentPages.get(title);
    const info = metaPages.get(title);
    if (!page || page.missing || !info) return { error: `${sci} (${order}): no article` };
    const text = page.revisions?.[0]?.slots?.main?.content ?? '';
    const { status, system, raw } = parseStatus(text);
    return {
      bug: {
        id: sci.toLowerCase().replace(/[^a-z]+/g, '-'),
        scientificName: sci,
        commonName: common ?? sci,
        order,
        status,
        statusSystem: system || (raw ? 'IUCN3.1' : ''),
        statusRaw: raw,
        description: (info.extract ?? '').replace(/\s+/g, ' ').trim(),
        image: info.thumbnail?.source ?? null,
        wikiTitle: title,
        wikiUrl: info.fullurl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      },
    };
  });
}

async function main() {
  const jobs = Object.entries(SPECIES).flatMap(([order, list]) => list.map((s) => [order, s]));
  const bugs = [];
  const failures = [];
  for (let i = 0; i < jobs.length; i += BATCH) {
    for (const r of await fetchBatch(jobs.slice(i, i + BATCH))) {
      if (r.bug) bugs.push(r.bug);
      else failures.push(r.error);
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  const orderIndex = Object.keys(SPECIES);
  bugs.sort((a, b) => orderIndex.indexOf(a.order) - orderIndex.indexOf(b.order) || a.scientificName.localeCompare(b.scientificName));
  await writeFile(OUT, JSON.stringify(bugs, null, 2) + '\n');

  const counts = {};
  for (const b of bugs) counts[b.status] = (counts[b.status] ?? 0) + 1;
  console.log(`Wrote ${bugs.length} species. Status counts:`, counts);
  if (failures.length) console.log('Skipped:\n  ' + failures.join('\n  '));
}

main();
