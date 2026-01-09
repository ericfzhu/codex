/**
 * Generate 2D projections from high-dimensional embeddings using UMAP
 * This creates coordinates for the cloud visualization
 *
 * Usage: npx ts-node --transpile-only scripts/generate-2d-projections.ts
 */

const fs = require('fs');
const path = require('path');
const { UMAP } = require('umap-js');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const EMBEDDING_DIM = 1024;

interface ProjectionResult {
  id: number;
  text: string;
  author: string;
  book: string;
  source: string;
  religion: string;
  x: number;
  y: number;
}

function loadInt8Embeddings(files: string[]): Float32Array {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const filePath = path.join(PUBLIC_DIR, file);
    if (fs.existsSync(filePath)) {
      chunks.push(fs.readFileSync(filePath));
    }
  }
  const combined = Buffer.concat(chunks);
  const int8Array = new Int8Array(combined.buffer, combined.byteOffset, combined.byteLength);

  // Convert int8 back to float32 (scale from [-127, 127] to [-1, 1])
  const float32Array = new Float32Array(int8Array.length);
  for (let i = 0; i < int8Array.length; i++) {
    float32Array[i] = int8Array[i] / 127;
  }
  return float32Array;
}

function loadMetadata(file: string): any[] {
  const filePath = path.join(PUBLIC_DIR, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

async function main() {
  console.log('Generating 2D projections for cloud visualization...\n');

  const allData: { embedding: number[]; metadata: any; religion: string }[] = [];

  // Load quotes embeddings
  const quotesEmbPath = path.join(PUBLIC_DIR, 'quotes-embeddings-int8.bin');
  if (fs.existsSync(quotesEmbPath)) {
    console.log('Loading quotes...');
    const quotesBuffer = fs.readFileSync(quotesEmbPath);
    const quotesInt8 = new Int8Array(quotesBuffer.buffer, quotesBuffer.byteOffset, quotesBuffer.byteLength);
    const quotesMetadata = loadMetadata('quotes-cohere.json');

    const numQuotes = quotesInt8.length / EMBEDDING_DIM;
    for (let i = 0; i < numQuotes && i < quotesMetadata.length; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding.push(quotesInt8[i * EMBEDDING_DIM + j] / 127);
      }
      allData.push({
        embedding,
        metadata: quotesMetadata[i],
        religion: 'PHILOSOPHY',
      });
    }
    console.log(`  Loaded ${numQuotes} quotes`);
  }

  // Load Bible embeddings
  const bibleManifest = path.join(PUBLIC_DIR, 'bible-embeddings-manifest.json');
  if (fs.existsSync(bibleManifest)) {
    console.log('Loading Bible...');
    const manifest = JSON.parse(fs.readFileSync(bibleManifest, 'utf-8'));
    const bibleEmb = loadInt8Embeddings(manifest.chunks);
    const bibleMetadata = loadMetadata('bible-cohere.json');

    const numVerses = bibleEmb.length / EMBEDDING_DIM;
    for (let i = 0; i < numVerses && i < bibleMetadata.length; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding.push(bibleEmb[i * EMBEDDING_DIM + j]);
      }
      allData.push({
        embedding,
        metadata: bibleMetadata[i],
        religion: 'CHRISTIANITY',
      });
    }
    console.log(`  Loaded ${numVerses} verses`);
  }

  // Load Islam embeddings
  const islamEmbPath = path.join(PUBLIC_DIR, 'islam-embeddings-int8.bin');
  if (fs.existsSync(islamEmbPath)) {
    console.log('Loading Islam...');
    const islamBuffer = fs.readFileSync(islamEmbPath);
    const islamInt8 = new Int8Array(islamBuffer.buffer, islamBuffer.byteOffset, islamBuffer.byteLength);
    const islamMetadata = loadMetadata('islam-cohere.json');

    const numItems = islamInt8.length / EMBEDDING_DIM;
    for (let i = 0; i < numItems && i < islamMetadata.length; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding.push(islamInt8[i * EMBEDDING_DIM + j] / 127);
      }
      allData.push({
        embedding,
        metadata: islamMetadata[i],
        religion: 'ISLAM',
      });
    }
    console.log(`  Loaded ${numItems} items`);
  }

  // Load Mormon embeddings
  const mormonEmbPath = path.join(PUBLIC_DIR, 'mormon-embeddings-int8.bin');
  if (fs.existsSync(mormonEmbPath)) {
    console.log('Loading Mormon...');
    const mormonBuffer = fs.readFileSync(mormonEmbPath);
    const mormonInt8 = new Int8Array(mormonBuffer.buffer, mormonBuffer.byteOffset, mormonBuffer.byteLength);
    const mormonMetadata = loadMetadata('mormon-cohere.json');

    const numItems = mormonInt8.length / EMBEDDING_DIM;
    for (let i = 0; i < numItems && i < mormonMetadata.length; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding.push(mormonInt8[i * EMBEDDING_DIM + j] / 127);
      }
      allData.push({
        embedding,
        metadata: mormonMetadata[i],
        religion: 'MORMONISM',
      });
    }
    console.log(`  Loaded ${numItems} items`);
  }

  // Load Confucian embeddings
  const confucianEmbPath = path.join(PUBLIC_DIR, 'confucian-embeddings-int8.bin');
  if (fs.existsSync(confucianEmbPath)) {
    console.log('Loading Confucian...');
    const confucianBuffer = fs.readFileSync(confucianEmbPath);
    const confucianInt8 = new Int8Array(confucianBuffer.buffer, confucianBuffer.byteOffset, confucianBuffer.byteLength);
    const confucianMetadata = loadMetadata('confucian-cohere.json');

    const numItems = confucianInt8.length / EMBEDDING_DIM;
    for (let i = 0; i < numItems && i < confucianMetadata.length; i++) {
      const embedding: number[] = [];
      for (let j = 0; j < EMBEDDING_DIM; j++) {
        embedding.push(confucianInt8[i * EMBEDDING_DIM + j] / 127);
      }
      allData.push({
        embedding,
        metadata: confucianMetadata[i],
        religion: 'CONFUCIANISM',
      });
    }
    console.log(`  Loaded ${numItems} items`);
  }

  if (allData.length === 0) {
    console.log('No data found to project');
    return;
  }

  console.log(`\nTotal items: ${allData.length}`);
  console.log('Running UMAP (this may take a while)...');

  // Extract embeddings for UMAP
  const embeddings = allData.map(d => d.embedding);

  // Run UMAP
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors: 15,
    minDist: 0.1,
    spread: 1.0,
  });

  const projections = umap.fit(embeddings);
  console.log('UMAP complete!');

  // Build output data
  const results: ProjectionResult[] = allData.map((item, i) => {
    const meta = item.metadata;
    return {
      id: i,
      text: meta.text || meta.quote || '',
      author: meta.author || '',
      book: meta.book || meta.book_title || '',
      source: meta.source || '',
      religion: item.religion,
      x: projections[i][0],
      y: projections[i][1],
    };
  });

  // Save as JSON
  const outputPath = path.join(PUBLIC_DIR, 'cloud-projections.json');
  fs.writeFileSync(outputPath, JSON.stringify(results));
  console.log(`\nSaved ${results.length} projections to ${outputPath}`);

  // Print summary
  const byReligion: Record<string, number> = {};
  for (const r of results) {
    byReligion[r.religion] = (byReligion[r.religion] || 0) + 1;
  }
  console.log('\nBy religion:');
  for (const [religion, count] of Object.entries(byReligion)) {
    console.log(`  ${religion}: ${count}`);
  }
}

main().catch(console.error);
