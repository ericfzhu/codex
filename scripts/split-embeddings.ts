/**
 * Split large embedding files into chunks for Cloudflare Pages (25MB limit)
 *
 * Usage: npx ts-node --transpile-only scripts/split-embeddings.ts
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAX_CHUNK_SIZE = 20 * 1024 * 1024; // 20MB to be safe (under 25MB limit)

function splitFile(inputPath: string, outputPrefix: string): string[] {
  const buffer = fs.readFileSync(inputPath);
  const totalSize = buffer.byteLength;

  if (totalSize <= MAX_CHUNK_SIZE) {
    console.log(`${path.basename(inputPath)} is already under ${MAX_CHUNK_SIZE / 1024 / 1024}MB, no split needed`);
    return [inputPath];
  }

  const numChunks = Math.ceil(totalSize / MAX_CHUNK_SIZE);
  const chunkSize = Math.ceil(totalSize / numChunks);

  console.log(`Splitting ${path.basename(inputPath)} (${(totalSize / 1024 / 1024).toFixed(2)}MB) into ${numChunks} chunks...`);

  const chunkFiles: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = buffer.slice(start, end);

    const chunkPath = `${outputPrefix}-${i}.bin`;
    fs.writeFileSync(chunkPath, chunk);
    chunkFiles.push(path.basename(chunkPath));

    console.log(`  Chunk ${i}: ${(chunk.byteLength / 1024 / 1024).toFixed(2)}MB -> ${path.basename(chunkPath)}`);
  }

  // Remove original file
  fs.unlinkSync(inputPath);
  console.log(`  Removed original: ${path.basename(inputPath)}`);

  return chunkFiles;
}

function main() {
  console.log('Splitting large embedding files for Cloudflare Pages...\n');

  const biblePath = path.join(PUBLIC_DIR, 'bible-embeddings-int8.bin');

  if (fs.existsSync(biblePath)) {
    const chunks = splitFile(biblePath, path.join(PUBLIC_DIR, 'bible-embeddings-int8'));

    // Write manifest file
    const manifest = { chunks, totalChunks: chunks.length };
    fs.writeFileSync(
      path.join(PUBLIC_DIR, 'bible-embeddings-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    console.log(`\nManifest written: bible-embeddings-manifest.json`);
  }

  console.log('\nDone! Update searchClient.ts to load chunks.');
}

main();
