import { SearchIndex, QuoteMetadata, searchById, getItemById } from './searchClient';

const eraOrder = ['Ancient', 'Medieval', 'Renaissance', 'Enlightenment', '19th Century', '20th Century', 'Contemporary', 'Unknown'];

/**
 * Get era from metadata, or 'Unknown' if not available
 */
export function getEra(metadata: QuoteMetadata): string {
	return metadata.era || 'Unknown';
}

export interface LineageItem {
	id: number;
	quote: string;
	author: string;
	book_title: string;
	year?: number;
	era: string;
	similarity: number;
}

export interface LineageResult {
	sourceQuote: LineageItem;
	lineage: LineageItem[];
}

export function findLineage(index: SearchIndex<QuoteMetadata>, sourceId: number, maxResults: number = 20): LineageResult | null {
	const sourceQuote = getItemById(index, sourceId);
	if (!sourceQuote) return null;

	const similar = searchById(index, sourceId, 50);

	const byAuthor = new Map<string, LineageItem>();

	for (const result of similar) {
		const author = result.metadata.author || 'Unknown';
		const existing = byAuthor.get(author);

		if (!existing || result.score > existing.similarity) {
			byAuthor.set(author, {
				id: result.id,
				quote: result.metadata.quote,
				author: result.metadata.author,
				book_title: result.metadata.book_title,
				year: result.metadata.year,
				era: getEra(result.metadata),
				similarity: result.score,
			});
		}
	}

	let lineage = Array.from(byAuthor.values())
		.filter((item) => item.author !== sourceQuote.author)
		.sort((a, b) => {
			// Sort by year if available, otherwise by era
			if (a.year && b.year) return a.year - b.year;
			if (a.year && !b.year) return -1;
			if (!a.year && b.year) return 1;
			const eraA = eraOrder.indexOf(a.era);
			const eraB = eraOrder.indexOf(b.era);
			if (eraA !== eraB) return eraA - eraB;
			return b.similarity - a.similarity;
		})
		.slice(0, maxResults);

	return {
		sourceQuote: {
			id: sourceId,
			quote: sourceQuote.quote,
			author: sourceQuote.author,
			book_title: sourceQuote.book_title,
			year: sourceQuote.year,
			era: getEra(sourceQuote),
			similarity: 1,
		},
		lineage,
	};
}
