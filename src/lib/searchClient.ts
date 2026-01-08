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
 */
export async function loadSearchIndex<T>(
  metadataUrl: string,
  embeddingsUrl: string,
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
    const [metadataRes, embeddingsRes] = await Promise.all([
      fetch(metadataUrl),
      fetch(embeddingsUrl),
    ]);

    if (!metadataRes.ok || !embeddingsRes.ok) {
      throw new Error('Failed to load search index');
    }

    const metadata: T[] = await metadataRes.json();
    const embeddingsBuffer = await embeddingsRes.arrayBuffer();
    const embeddings = new Int8Array(embeddingsBuffer);

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
 * Load Bible search index.
 */
export async function loadBibleIndex(): Promise<SearchIndex<VerseMetadata>> {
  return loadSearchIndex<VerseMetadata>('/bible-cohere.json', '/bible-embeddings-int8.bin', 1024);
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
