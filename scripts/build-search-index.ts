/**
 * Build script to convert CSV embeddings into browser-friendly formats:
 * 1. embeddings.bin - Float32Array of all 1536D embeddings
 * 2. quotes.json - Metadata (quote, author, book_title) for each quote
 *
 * Usage: npx ts-node scripts/build-search-index.ts
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

interface QuoteRow {
  Quote: string;
  Author: string;
  'Book Title': string;
  Embeddings: string;
}

interface QuoteMetadata {
  id: number;
  quote: string;
  author: string;
  book_title: string;
}

const EMBEDDING_DIM = 1536;

async function buildSearchIndex() {
  const csvPath = path.join(__dirname, '..', 'quotes.csv');
  const outputDir = path.join(__dirname, '..', 'public');

  console.log('Reading CSV file...');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  const parsed = Papa.parse<QuoteRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = parsed.data;
  console.log(`Parsed ${rows.length} quotes`);

  // Prepare metadata and embeddings
  const metadata: QuoteMetadata[] = [];
  const embeddingsFlat: number[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Parse embedding
    let embedding: number[];
    try {
      embedding = JSON.parse(row.Embeddings);
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
        console.warn(`Row ${i}: Invalid embedding dimension (${embedding?.length}), skipping`);
        skipped++;
        continue;
      }
    } catch (e) {
      console.warn(`Row ${i}: Failed to parse embedding, skipping`);
      skipped++;
      continue;
    }

    // Add to metadata
    metadata.push({
      id: metadata.length, // Use sequential ID after filtering
      quote: row.Quote,
      author: row.Author || '',
      book_title: row['Book Title'] || '',
    });

    // Add embedding to flat array
    embeddingsFlat.push(...embedding);
  }

  console.log(`Processed ${metadata.length} quotes (skipped ${skipped})`);

  // Write metadata JSON
  const metadataPath = path.join(outputDir, 'quotes.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata));
  console.log(`Written metadata to ${metadataPath} (${(fs.statSync(metadataPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Write embeddings as binary Float32Array
  const embeddingsBuffer = new Float32Array(embeddingsFlat);
  const embeddingsPath = path.join(outputDir, 'embeddings.bin');
  fs.writeFileSync(embeddingsPath, Buffer.from(embeddingsBuffer.buffer));
  console.log(`Written embeddings to ${embeddingsPath} (${(fs.statSync(embeddingsPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Also create a compressed version info file
  const infoPath = path.join(outputDir, 'search-index-info.json');
  fs.writeFileSync(infoPath, JSON.stringify({
    numQuotes: metadata.length,
    embeddingDim: EMBEDDING_DIM,
    embeddingsFile: 'embeddings.bin',
    metadataFile: 'quotes.json',
    createdAt: new Date().toISOString(),
  }, null, 2));
  console.log(`Written index info to ${infoPath}`);

  console.log('\nDone! Files created in public/:');
  console.log('  - quotes.json (metadata)');
  console.log('  - embeddings.bin (binary embeddings)');
  console.log('  - search-index-info.json (index info)');
}

buildSearchIndex().catch(console.error);
