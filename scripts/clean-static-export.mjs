import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'out');

// These full-precision source vectors are useful for offline data generation,
// but the browser reads the checked-in int8 files. Next.js copies everything in
// public/ during a static export, including locally present gitignored files.
const offlineOnlyFiles = [
	'quotes-embeddings.bin',
	'bible-embeddings.bin',
	'islam-embeddings.bin',
	'mormon-embeddings.bin',
	'confucian-embeddings.bin',
];

await Promise.all(
	offlineOnlyFiles.map((file) => rm(path.join(outputDirectory, file), { force: true }))
);
