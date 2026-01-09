/**
 * Quantize embeddings from float32 to int8
 * Reduces file size by 4x with minimal quality loss
 *
 * Usage: npx ts-node --transpile-only scripts/quantize-embeddings.ts
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

interface QuantizationStats {
  file: string;
  originalSize: number;
  quantizedSize: number;
  numVectors: number;
  dimensions: number;
}

function quantizeEmbeddings(inputPath: string, outputPath: string, dimensions: number): QuantizationStats {
  console.log(`\nQuantizing ${path.basename(inputPath)}...`);

  // Read float32 embeddings
  const buffer = fs.readFileSync(inputPath);
  const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

  const numVectors = float32Array.length / dimensions;
  console.log(`  Vectors: ${numVectors}, Dimensions: ${dimensions}`);

  // Create int8 array
  const int8Array = new Int8Array(float32Array.length);

  // Quantize each vector
  // Cohere embeddings are already normalized, values typically in [-1, 1]
  // Scale to [-127, 127] for int8
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1] and scale to [-127, 127]
    const clamped = Math.max(-1, Math.min(1, float32Array[i]));
    int8Array[i] = Math.round(clamped * 127);
  }

  // Write quantized embeddings
  fs.writeFileSync(outputPath, Buffer.from(int8Array.buffer));

  const originalSize = buffer.byteLength;
  const quantizedSize = int8Array.byteLength;

  console.log(`  Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Quantized: ${(quantizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Reduction: ${((1 - quantizedSize / originalSize) * 100).toFixed(1)}%`);

  return { file: path.basename(inputPath), originalSize, quantizedSize, numVectors, dimensions };
}

function verifyQuantization(originalPath: string, quantizedPath: string, dimensions: number): void {
  console.log(`\nVerifying quantization quality...`);

  const originalBuffer = fs.readFileSync(originalPath);
  const originalArray = new Float32Array(originalBuffer.buffer, originalBuffer.byteOffset, originalBuffer.byteLength / 4);

  const quantizedBuffer = fs.readFileSync(quantizedPath);
  const quantizedArray = new Int8Array(quantizedBuffer.buffer, quantizedBuffer.byteOffset, quantizedBuffer.byteLength);

  // Test similarity preservation on a few random vector pairs
  const numVectors = originalArray.length / dimensions;
  const testPairs = 100;

  let totalOriginalSim = 0;
  let totalQuantizedSim = 0;
  let maxDiff = 0;

  for (let t = 0; t < testPairs; t++) {
    const i = Math.floor(Math.random() * numVectors);
    const j = Math.floor(Math.random() * numVectors);
    if (i === j) continue;

    // Original dot product
    let origDot = 0;
    for (let d = 0; d < dimensions; d++) {
      origDot += originalArray[i * dimensions + d] * originalArray[j * dimensions + d];
    }

    // Quantized dot product (scaled back)
    let quantDot = 0;
    for (let d = 0; d < dimensions; d++) {
      quantDot += (quantizedArray[i * dimensions + d] / 127) * (quantizedArray[j * dimensions + d] / 127);
    }

    totalOriginalSim += origDot;
    totalQuantizedSim += quantDot;
    maxDiff = Math.max(maxDiff, Math.abs(origDot - quantDot));
  }

  console.log(`  Avg original similarity: ${(totalOriginalSim / testPairs).toFixed(4)}`);
  console.log(`  Avg quantized similarity: ${(totalQuantizedSim / testPairs).toFixed(4)}`);
  console.log(`  Max difference: ${maxDiff.toFixed(4)}`);
}

async function main() {
  console.log('Quantizing embeddings from float32 to int8...');

  const files = [
    { input: 'quotes-embeddings.bin', output: 'quotes-embeddings-int8.bin', dims: 1024 },
    { input: 'bible-embeddings.bin', output: 'bible-embeddings-int8.bin', dims: 1024 },
    { input: 'islam-embeddings.bin', output: 'islam-embeddings-int8.bin', dims: 1024 },
    { input: 'mormon-embeddings.bin', output: 'mormon-embeddings-int8.bin', dims: 1024 },
    { input: 'confucian-embeddings.bin', output: 'confucian-embeddings-int8.bin', dims: 1024 },
  ];

  const stats: QuantizationStats[] = [];

  for (const file of files) {
    const inputPath = path.join(PUBLIC_DIR, file.input);
    const outputPath = path.join(PUBLIC_DIR, file.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`\nSkipping ${file.input} (not found)`);
      continue;
    }

    const stat = quantizeEmbeddings(inputPath, outputPath, file.dims);
    stats.push(stat);

    // Verify quality
    verifyQuantization(inputPath, outputPath, file.dims);
  }

  // Summary
  console.log('\n=== Summary ===');
  let totalOriginal = 0;
  let totalQuantized = 0;
  for (const stat of stats) {
    totalOriginal += stat.originalSize;
    totalQuantized += stat.quantizedSize;
  }
  console.log(`Total original: ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total quantized: ${(totalQuantized / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total reduction: ${((1 - totalQuantized / totalOriginal) * 100).toFixed(1)}%`);

  console.log('\nNext steps:');
  console.log('1. Update searchClient.ts to load int8 embeddings');
  console.log('2. Remove old float32 .bin files');
  console.log('3. Rename int8 files to replace originals');
}

main().catch(console.error);
