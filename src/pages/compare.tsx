import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import { useSelection } from '@/context/SelectionContext';
import { loadQuotesIndex, getItemById, getEmbedding, SearchIndex, QuoteMetadata } from '@/lib/searchClient';
import ThemeToggle from '@/components/ThemeToggle';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

interface CompareQuote {
	id: number;
	quote: string;
	author: string;
	book_title: string;
}

function dotProduct(a: Int8Array, b: Int8Array): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		sum += a[i] * b[i];
	}
	// Scale back: each value was multiplied by 127, so divide by 127^2
	return sum / (127 * 127);
}

function SimilarityMatrix({ quotes, searchIndex }: { quotes: CompareQuote[]; searchIndex: SearchIndex<QuoteMetadata> | null }) {
	if (!searchIndex || quotes.length < 2) return null;

	const embeddings = quotes.map((q) => getEmbedding(searchIndex, q.id));

	return (
		<div className="mt-8">
			<h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Similarity Matrix</h3>
			<div className="overflow-x-auto">
				<table className="min-w-full border-collapse">
					<thead>
						<tr>
							<th className="p-2 text-left text-sm text-gray-500 dark:text-gray-400"></th>
							{quotes.map((q, i) => (
								<th key={i} className="p-2 text-center text-sm text-gray-500 dark:text-gray-400 max-w-[100px] truncate">
									{q.author || `Quote ${i + 1}`}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{quotes.map((q1, i) => (
							<tr key={i}>
								<td className="p-2 text-sm text-gray-500 dark:text-gray-400 max-w-[100px] truncate">
									{q1.author || `Quote ${i + 1}`}
								</td>
								{quotes.map((q2, j) => {
									const similarity = dotProduct(embeddings[i], embeddings[j]);
									const isIdentical = i === j;
									const bgIntensity = isIdentical ? 100 : Math.round((similarity - 0.4) * 150);
									return (
										<td
											key={j}
											className={`p-2 text-center text-sm border border-gray-200 dark:border-gray-700 ${
												isIdentical ? 'bg-gray-100 dark:bg-gray-800' : ''
											}`}
											style={
												!isIdentical
													? {
															backgroundColor: `rgba(112, 112, 255, ${Math.max(0, bgIntensity) / 100})`,
														}
													: undefined
											}>
											{isIdentical ? '-' : `${(similarity * 100).toFixed(0)}%`}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function ComparisonColumn({ quote, onRemove }: { quote: CompareQuote; onRemove: () => void }) {
	return (
		<div className="flex flex-col h-full border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
			<div className="flex-1 p-4 overflow-auto">
				<p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">{quote.quote}</p>
			</div>
			<div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
				<div className="flex justify-between items-start">
					<div>
						<p className="font-medium text-gray-900 dark:text-white">{quote.author || 'Unknown'}</p>
						{quote.book_title && <p className="text-sm text-gray-500 dark:text-gray-400 italic">{quote.book_title}</p>}
					</div>
					<button
						onClick={onRemove}
						className="text-gray-400 hover:text-red-500 transition-colors"
						title="Remove from comparison">
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<Link
					href={`/quotes?id=${quote.id}`}
					className="mt-2 inline-block text-sm text-accent hover:underline">
					View neighbors &rarr;
				</Link>
			</div>
		</div>
	);
}

export default function ComparePage() {
	const router = useRouter();
	const { selectedQuotes, removeFromSelection, clearSelection } = useSelection();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<QuoteMetadata> | null>(null);
	const [quotes, setQuotes] = useState<CompareQuote[]>([]);

	// Load search index
	useEffect(() => {
		loadQuotesIndex()
			.then(setSearchIndex)
			.catch((err) => console.error('Failed to load search index:', err));
	}, []);

	// Load quotes from URL params or selection
	useEffect(() => {
		if (!router.isReady) return;

		const ids = router.query.ids;
		if (ids && searchIndex) {
			// Load from URL
			const idList = (typeof ids === 'string' ? ids.split(',') : ids).map(Number).filter((n) => !isNaN(n));
			const loadedQuotes: CompareQuote[] = [];
			for (const id of idList) {
				const q = getItemById(searchIndex, id);
				if (q) {
					loadedQuotes.push({
						id,
						quote: q.quote,
						author: q.author,
						book_title: q.book_title,
					});
				}
			}
			setQuotes(loadedQuotes);
		} else if (selectedQuotes.length > 0) {
			// Use selection context
			setQuotes(selectedQuotes);
		}
	}, [router.isReady, router.query.ids, searchIndex, selectedQuotes]);

	const handleRemove = (id: number) => {
		removeFromSelection(id);
		setQuotes((prev) => prev.filter((q) => q.id !== id));

		// Update URL
		const newIds = quotes.filter((q) => q.id !== id).map((q) => q.id);
		if (newIds.length > 0) {
			router.replace(`/compare?ids=${newIds.join(',')}`, undefined, { shallow: true });
		} else {
			router.replace('/compare', undefined, { shallow: true });
		}
	};

	return (
		<main className={`min-h-screen bg-white dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Compare Quotes</title>
			</Head>

			{/* Header */}
			<header className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
				<div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Link href="/" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
						</Link>
						<h1 className="text-xl font-bold text-gray-900 dark:text-white">Compare Quotes</h1>
					</div>
					<div className="flex items-center gap-4">
						{quotes.length > 0 && (
							<button
								onClick={() => {
									clearSelection();
									setQuotes([]);
									router.replace('/compare', undefined, { shallow: true });
								}}
								className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
								Clear all
							</button>
						)}
						<ThemeToggle />
					</div>
				</div>
			</header>

			<div className="max-w-7xl mx-auto px-4 py-8">
				{quotes.length === 0 ? (
					<div className="text-center py-16">
						<p className="text-gray-500 dark:text-gray-400 mb-4">No quotes selected for comparison.</p>
						<p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
							Go to the quotes page and select quotes to compare them side by side.
						</p>
						<Link
							href="/quotes"
							className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors">
							<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							Go to Quotes
						</Link>
					</div>
				) : (
					<>
						{/* Comparison columns */}
						<div
							className={`grid gap-4 ${
								quotes.length === 1
									? 'grid-cols-1 max-w-xl mx-auto'
									: quotes.length === 2
										? 'grid-cols-1 md:grid-cols-2'
										: quotes.length === 3
											? 'grid-cols-1 md:grid-cols-3'
											: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
							}`}>
							{quotes.map((quote) => (
								<ComparisonColumn key={quote.id} quote={quote} onRemove={() => handleRemove(quote.id)} />
							))}
						</div>

						{/* Similarity matrix */}
						<SimilarityMatrix quotes={quotes} searchIndex={searchIndex} />

						{/* Add more quotes hint */}
						{quotes.length < 4 && (
							<div className="mt-8 text-center">
								<Link
									href="/quotes"
									className="text-sm text-gray-500 dark:text-gray-400 hover:text-accent dark:hover:text-accent">
									+ Add more quotes to compare (max 4)
								</Link>
							</div>
						)}
					</>
				)}
			</div>
		</main>
	);
}
