/**
 * Embed texts using Cohere embed-v4 on AWS Bedrock
 *
 * Rate limits:
 * - 2,000 requests per minute
 * - 300,000 tokens per minute
 *
 * Usage: npx ts-node --transpile-only scripts/embed-cohere.ts [quotes|bible|all]
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const EMBEDDING_DIM = 1024; // Cohere embed-v4 dimension
const BATCH_SIZE = 50; // Texts per request (conservative)
const REQUESTS_PER_MINUTE = 1800; // Stay under 2000 limit
const DELAY_BETWEEN_BATCHES = (60 * 1000) / REQUESTS_PER_MINUTE; // ~33ms
const MAX_TEXT_LENGTH = 2000; // Cohere max is 2048, leave some buffer

const client = new BedrockRuntimeClient({ region: 'us-west-2' });

interface QuoteRow {
  Quote: string;
  Author: string;
  'Book Title': string;
}

interface VerseRow {
  Book: string;
  Chapter: string;
  Verse: string;
  Text: string;
}

interface EmbeddedItem {
  id: number;
  text: string;
  metadata: Record<string, string>;
  embedding?: number[];
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH - 3) + '...';
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  // Truncate long texts
  const truncatedTexts = texts.map(truncateText);

  const payload = {
    texts: truncatedTexts,
    input_type: 'search_document',
    embedding_types: ['float'],
  };

  const command = new InvokeModelCommand({
    modelId: 'cohere.embed-multilingual-v3',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return responseBody.embeddings.float;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function embedItems(items: EmbeddedItem[], name: string): Promise<EmbeddedItem[]> {
  const total = items.length;
  const batches = Math.ceil(total / BATCH_SIZE);

  console.log(`Embedding ${total} ${name} in ${batches} batches...`);

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, total);
    const batch = items.slice(start, end);
    const texts = batch.map(item => item.text);

    try {
      const embeddings = await embedBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        items[start + j].embedding = embeddings[j];
      }

      const progress = ((i + 1) / batches * 100).toFixed(1);
      console.log(`  Batch ${i + 1}/${batches} (${progress}%) - ${end}/${total} items`);

      // Rate limiting
      if (i < batches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    } catch (error: any) {
      console.error(`Error in batch ${i + 1}:`, error.message);
      // Track retries
      const retryKey = `batch_${i}`;
      const retries = (global as any).retryCount || {};
      retries[retryKey] = (retries[retryKey] || 0) + 1;
      (global as any).retryCount = retries;

      if (retries[retryKey] <= 3) {
        console.log(`  Retrying batch ${i + 1} (attempt ${retries[retryKey]}/3)...`);
        await sleep(5000);
        i--; // Retry this batch
      } else {
        console.error(`  Skipping batch ${i + 1} after 3 failed attempts`);
        // Fill with zeros for failed batches
        for (let j = 0; j < batch.length; j++) {
          items[start + j].embedding = new Array(EMBEDDING_DIM).fill(0);
        }
      }
    }
  }

  return items;
}

async function processQuotes(): Promise<void> {
  console.log('\n=== Processing Quotes ===\n');

  const csvPath = path.join(__dirname, '..', 'quotes.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const parsed = Papa.parse<QuoteRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  // Filter to only rows with valid quotes
  const items: EmbeddedItem[] = parsed.data
    .filter((row: QuoteRow) => row.Quote && row.Quote.trim().length > 0)
    .map((row: QuoteRow, index: number) => ({
      id: index,
      text: row.Quote,
      metadata: {
        author: row.Author || '',
        book_title: row['Book Title'] || '',
      },
    }));

  console.log(`Found ${items.length} quotes`);

  const embedded = await embedItems(items, 'quotes');

  // Save results
  const outputPath = path.join(__dirname, '..', 'public', 'quotes-cohere.json');
  const metadata = embedded.map(item => ({
    id: item.id,
    quote: item.text,
    author: item.metadata.author,
    book_title: item.metadata.book_title,
  }));
  fs.writeFileSync(outputPath, JSON.stringify(metadata));
  console.log(`Saved metadata to ${outputPath}`);

  // Save embeddings as binary
  const embeddingsFlat: number[] = [];
  for (const item of embedded) {
    if (item.embedding) {
      embeddingsFlat.push(...item.embedding);
    }
  }

  const embeddingsBuffer = new Float32Array(embeddingsFlat);
  const embeddingsPath = path.join(__dirname, '..', 'public', 'quotes-embeddings.bin');
  fs.writeFileSync(embeddingsPath, Buffer.from(embeddingsBuffer.buffer));
  console.log(`Saved embeddings to ${embeddingsPath} (${(embeddingsBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function processBible(): Promise<void> {
  console.log('\n=== Processing Bible Verses ===\n');

  const bibleDir = path.join(__dirname, '..', 'christianity');
  const files = fs.readdirSync(bibleDir).filter((f: string) => f.endsWith('.csv'));

  // First pass: load all metadata
  const allItems: EmbeddedItem[] = [];
  let globalId = 0;

  for (const file of files) {
    const csvPath = path.join(bibleDir, file);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const parsed = Papa.parse<VerseRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    const source = file.replace('christianity_', '').replace('_verses.csv', '').toUpperCase();

    for (const row of parsed.data) {
      if (row.Text && row.Text.trim().length > 0) {
        allItems.push({
          id: globalId++,
          text: row.Text,
          metadata: {
            book: row.Book || '',
            chapter: row.Chapter || '',
            verse: row.Verse || '',
            source,
          },
        });
      }
    }

    console.log(`Loaded ${parsed.data.length} verses from ${file}`);
  }

  console.log(`Total: ${allItems.length} verses`);

  // Prepare output files
  const embeddingsPath = path.join(__dirname, '..', 'public', 'bible-embeddings.bin');
  const metadataPath = path.join(__dirname, '..', 'public', 'bible-cohere.json');

  // Clear/create embeddings file
  fs.writeFileSync(embeddingsPath, Buffer.alloc(0));

  // Process in batches and write embeddings incrementally
  const total = allItems.length;
  const batches = Math.ceil(total / BATCH_SIZE);
  const metadata: any[] = [];

  console.log(`Embedding ${total} verses in ${batches} batches...`);

  for (let i = 0; i < batches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, total);
    const batch = allItems.slice(start, end);
    const texts = batch.map(item => item.text);

    try {
      const embeddings = await embedBatch(texts);

      // Write embeddings immediately to file
      for (let j = 0; j < batch.length; j++) {
        const embeddingBuffer = new Float32Array(embeddings[j]);
        fs.appendFileSync(embeddingsPath, Buffer.from(embeddingBuffer.buffer));

        // Add to metadata array
        metadata.push({
          id: batch[j].id,
          text: batch[j].text,
          book: batch[j].metadata.book,
          chapter: batch[j].metadata.chapter,
          verse: batch[j].metadata.verse,
          source: batch[j].metadata.source,
        });
      }

      const progress = ((i + 1) / batches * 100).toFixed(1);
      console.log(`  Batch ${i + 1}/${batches} (${progress}%) - ${end}/${total} verses`);

      // Rate limiting
      if (i < batches - 1) {
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    } catch (error: any) {
      console.error(`Error in batch ${i + 1}:`, error.message);
      const retryKey = `bible_batch_${i}`;
      const retries = (global as any).retryCount || {};
      retries[retryKey] = (retries[retryKey] || 0) + 1;
      (global as any).retryCount = retries;

      if (retries[retryKey] <= 3) {
        console.log(`  Retrying batch ${i + 1} (attempt ${retries[retryKey]}/3)...`);
        await sleep(5000);
        i--; // Retry this batch
      } else {
        console.error(`  Skipping batch ${i + 1} after 3 failed attempts`);
        // Write zeros for failed batches
        for (let j = 0; j < batch.length; j++) {
          const zeroBuffer = new Float32Array(EMBEDDING_DIM);
          fs.appendFileSync(embeddingsPath, Buffer.from(zeroBuffer.buffer));

          metadata.push({
            id: batch[j].id,
            text: batch[j].text,
            book: batch[j].metadata.book,
            chapter: batch[j].metadata.chapter,
            verse: batch[j].metadata.verse,
            source: batch[j].metadata.source,
          });
        }
      }
    }
  }

  // Save metadata JSON
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  console.log(`Saved metadata to ${metadataPath}`);

  const stats = fs.statSync(embeddingsPath);
  console.log(`Saved embeddings to ${embeddingsPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'all';

  console.log('Cohere Embed V4 via AWS Bedrock');
  console.log('================================\n');

  if (target === 'quotes' || target === 'all') {
    await processQuotes();
  }

  if (target === 'bible' || target === 'all') {
    await processBible();
  }

  console.log('\nDone!');
}

main().catch(console.error);
