/**
 * Enrich quotes with publication years and eras
 *
 * Sources:
 * - Open Library API for book publication dates
 * - Wikidata API for author birth/death years
 *
 * Usage: npx ts-node --transpile-only scripts/enrich-quotes.ts
 */

const fs = require('fs');
const path = require('path');

interface Quote {
  id: number;
  quote: string;
  author: string;
  book_title: string;
  year?: number;
  era?: string;
}

// Cache for API results to avoid repeated queries
const authorCache: Map<string, number | null> = new Map();
const bookCache: Map<string, number | null> = new Map();

const DELAY_MS = 100; // Be nice to APIs

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function yearToEra(year: number): string {
  if (year < 500) return 'Ancient';
  if (year < 1400) return 'Medieval';
  if (year < 1600) return 'Renaissance';
  if (year < 1800) return 'Enlightenment';
  if (year < 1900) return '19th Century';
  if (year < 2000) return '20th Century';
  return 'Contemporary';
}

/**
 * Query Open Library for book publication year
 */
async function getBookYear(title: string, author: string): Promise<number | null> {
  const cacheKey = `${title}|${author}`;
  if (bookCache.has(cacheKey)) {
    return bookCache.get(cacheKey)!;
  }

  try {
    // Search by title and author
    const query = encodeURIComponent(`${title} ${author}`);
    const url = `https://openlibrary.org/search.json?q=${query}&limit=1&fields=first_publish_year`;

    const response = await fetch(url);
    if (!response.ok) {
      bookCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();
    if (data.docs && data.docs.length > 0 && data.docs[0].first_publish_year) {
      const year = data.docs[0].first_publish_year;
      bookCache.set(cacheKey, year);
      return year;
    }
  } catch (error) {
    // Silently fail
  }

  bookCache.set(cacheKey, null);
  return null;
}

/**
 * Query Wikidata for author's active period (birth year + some offset, or death year)
 */
async function getAuthorYear(author: string): Promise<number | null> {
  if (authorCache.has(author)) {
    return authorCache.get(author)!;
  }

  try {
    // Search Wikidata for the person
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(author)}&language=en&type=item&format=json&origin=*`;

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      authorCache.set(author, null);
      return null;
    }

    const searchData = await searchResponse.json();
    if (!searchData.search || searchData.search.length === 0) {
      authorCache.set(author, null);
      return null;
    }

    const entityId = searchData.search[0].id;

    // Get entity details
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json&origin=*`;

    const entityResponse = await fetch(entityUrl);
    if (!entityResponse.ok) {
      authorCache.set(author, null);
      return null;
    }

    const entityData = await entityResponse.json();
    const entity = entityData.entities[entityId];

    if (!entity || !entity.claims) {
      authorCache.set(author, null);
      return null;
    }

    // Try to get death year (P570) first, then birth year (P569)
    let year: number | null = null;

    // Death date
    if (entity.claims.P570 && entity.claims.P570[0]?.mainsnak?.datavalue?.value?.time) {
      const timeStr = entity.claims.P570[0].mainsnak.datavalue.value.time;
      const match = timeStr.match(/([+-]?\d+)-/);
      if (match) {
        year = parseInt(match[1]);
      }
    }

    // If no death year, use birth year + 40 (approximate active period)
    if (!year && entity.claims.P569 && entity.claims.P569[0]?.mainsnak?.datavalue?.value?.time) {
      const timeStr = entity.claims.P569[0].mainsnak.datavalue.value.time;
      const match = timeStr.match(/([+-]?\d+)-/);
      if (match) {
        year = parseInt(match[1]) + 40; // Approximate when they'd be writing
      }
    }

    authorCache.set(author, year);
    return year;
  } catch (error) {
    // Silently fail
  }

  authorCache.set(author, null);
  return null;
}

async function main() {
  console.log('Enriching quotes with publication years...\n');

  const quotesPath = path.join(__dirname, '..', 'public', 'quotes-cohere.json');
  const quotes: Quote[] = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));

  console.log(`Loaded ${quotes.length} quotes\n`);

  let enrichedCount = 0;
  let bookHits = 0;
  let authorHits = 0;

  for (let i = 0; i < quotes.length; i++) {
    const quote = quotes[i];
    let year: number | null = null;

    // Try book first if available
    if (quote.book_title && quote.book_title.trim()) {
      year = await getBookYear(quote.book_title, quote.author || '');
      if (year) bookHits++;
      await sleep(DELAY_MS);
    }

    // Fall back to author
    if (!year && quote.author && quote.author.trim()) {
      year = await getAuthorYear(quote.author);
      if (year) authorHits++;
      await sleep(DELAY_MS);
    }

    if (year) {
      quote.year = year;
      quote.era = yearToEra(year);
      enrichedCount++;
    }

    // Progress
    if ((i + 1) % 100 === 0 || i === quotes.length - 1) {
      const pct = ((i + 1) / quotes.length * 100).toFixed(1);
      console.log(`Progress: ${i + 1}/${quotes.length} (${pct}%) - Enriched: ${enrichedCount} (${bookHits} from books, ${authorHits} from authors)`);
    }
  }

  // Save enriched data
  fs.writeFileSync(quotesPath, JSON.stringify(quotes));
  console.log(`\nSaved enriched data to ${quotesPath}`);

  // Summary
  const withYear = quotes.filter(q => q.year).length;
  const withoutYear = quotes.length - withYear;
  console.log(`\nSummary:`);
  console.log(`  With year: ${withYear} (${(withYear / quotes.length * 100).toFixed(1)}%)`);
  console.log(`  Without year: ${withoutYear}`);

  // Era distribution
  const eraCount: Record<string, number> = {};
  for (const q of quotes) {
    if (q.era) {
      eraCount[q.era] = (eraCount[q.era] || 0) + 1;
    }
  }
  console.log(`\nEra distribution:`);
  for (const [era, count] of Object.entries(eraCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${era}: ${count}`);
  }
}

main().catch(console.error);
