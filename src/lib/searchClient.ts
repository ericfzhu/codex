/**
 * Client-side vector search using brute-force dot product.
 * Supports multiple collections (quotes, bible).
 */

export interface QuoteMetadata {
  id: number;
  quote: string;
  author: string;
  book_title: string;
  year?: number;
  era?: string;
}

export interface VerseMetadata {
  id: number;
  text: string;
  book: string;
  chapter: string;
  verse: string;
  source: string;
}

export interface SearchResult<T> {
  id: number;
  score: number;
  metadata: T;
}

export interface SearchIndex<T> {
  metadata: T[];
  embeddings: Int8Array;
  numItems: number;
  embeddingDim: number;
}

// Cache for loaded indices
const indexCache: Map<string, SearchIndex<any>> = new Map();
const loadPromises: Map<string, Promise<SearchIndex<any>>> = new Map();

/**
 * Load a search index (metadata + embeddings).
 * Supports single file or chunked embeddings.
 */
export async function loadSearchIndex<T>(
  metadataUrl: string,
  embeddingsUrl: string | string[],
  embeddingDim: number = 1024
): Promise<SearchIndex<T>> {
  const cacheKey = metadataUrl;

  if (indexCache.has(cacheKey)) {
    return indexCache.get(cacheKey)!;
  }

  if (loadPromises.has(cacheKey)) {
    return loadPromises.get(cacheKey)!;
  }

  const loadPromise = (async () => {
    const embeddingsUrls = Array.isArray(embeddingsUrl) ? embeddingsUrl : [embeddingsUrl];

    const [metadataRes, ...embeddingsResponses] = await Promise.all([
      fetch(metadataUrl),
      ...embeddingsUrls.map(url => fetch(url)),
    ]);

    if (!metadataRes.ok || embeddingsResponses.some(r => !r.ok)) {
      throw new Error('Failed to load search index');
    }

    const metadata: T[] = await metadataRes.json();

    // Load and concatenate embedding chunks
    const embeddingsBuffers = await Promise.all(
      embeddingsResponses.map(r => r.arrayBuffer())
    );

    const totalLength = embeddingsBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
    const embeddings = new Int8Array(totalLength);

    let offset = 0;
    for (const buffer of embeddingsBuffers) {
      embeddings.set(new Int8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    const numItems = metadata.length;

    if (embeddings.length !== numItems * embeddingDim) {
      throw new Error(
        `Embeddings size mismatch: expected ${numItems * embeddingDim}, got ${embeddings.length}`
      );
    }

    const index: SearchIndex<T> = { metadata, embeddings, numItems, embeddingDim };
    indexCache.set(cacheKey, index);
    return index;
  })();

  loadPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Load quotes search index.
 */
export async function loadQuotesIndex(): Promise<SearchIndex<QuoteMetadata>> {
  return loadSearchIndex<QuoteMetadata>('/quotes-cohere.json', '/quotes-embeddings-int8.bin', 1024);
}

/**
 * Load Bible search index (chunked for Cloudflare Pages 25MB limit).
 */
export async function loadBibleIndex(): Promise<SearchIndex<VerseMetadata>> {
  return loadSearchIndex<VerseMetadata>(
    '/bible-cohere.json',
    [
      '/bible-embeddings-int8-0.bin',
      '/bible-embeddings-int8-1.bin',
      '/bible-embeddings-int8-2.bin',
    ],
    1024
  );
}

/**
 * Get the embedding vector for an item by ID.
 */
export function getEmbedding<T>(index: SearchIndex<T>, id: number): Int8Array {
  const start = id * index.embeddingDim;
  return index.embeddings.slice(start, start + index.embeddingDim);
}

/**
 * Compute dot product between two int8 vectors.
 * Result is scaled back to [-1, 1] range.
 */
function dotProduct(a: Int8Array, b: Int8Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  // Scale back: each value was multiplied by 127, so divide by 127^2
  return sum / (127 * 127);
}

/**
 * Find the K most similar items to a query vector.
 */
export function searchByVector<T>(
  index: SearchIndex<T>,
  queryVector: Int8Array,
  topK: number = 10,
  excludeIds: Set<number> = new Set()
): SearchResult<T>[] {
  const scores: Array<{ id: number; score: number }> = [];

  for (let i = 0; i < index.numItems; i++) {
    if (excludeIds.has(i)) continue;

    const embedding = getEmbedding(index, i);
    const score = dotProduct(queryVector, embedding);
    scores.push({ id: i, score });
  }

  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, topK).map(({ id, score }) => ({
    id,
    score,
    metadata: index.metadata[id],
  }));
}

/**
 * Find similar items to a given ID.
 */
export function searchById<T>(
  index: SearchIndex<T>,
  id: number,
  topK: number = 10,
  includeSelf: boolean = false
): SearchResult<T>[] {
  const queryVector = getEmbedding(index, id);
  const excludeIds = includeSelf ? new Set<number>() : new Set([id]);
  return searchByVector(index, queryVector, topK, excludeIds);
}

/**
 * Get a random item from the index.
 */
export function getRandomItem<T>(index: SearchIndex<T>): T & { id: number } {
  const randomId = Math.floor(Math.random() * index.numItems);
  return { ...index.metadata[randomId], id: randomId };
}

/**
 * Get item metadata by ID.
 */
export function getItemById<T>(index: SearchIndex<T>, id: number): T | null {
  if (id < 0 || id >= index.numItems) return null;
  return index.metadata[id];
}

/**
 * Get quotes with pairwise similarities (for comparison view).
 */
export function getItemsWithSimilarities<T>(
  index: SearchIndex<T>,
  ids: number[]
): {
  items: T[];
  similarities: number[][];
} {
  const items = ids.map((id) => index.metadata[id]);
  const embeddings = ids.map((id) => getEmbedding(index, id));

  const similarities: number[][] = [];
  for (let i = 0; i < ids.length; i++) {
    similarities[i] = [];
    for (let j = 0; j < ids.length; j++) {
      similarities[i][j] = dotProduct(embeddings[i], embeddings[j]);
    }
  }

  return { items, similarities };
}
