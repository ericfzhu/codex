import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import {
	loadQuotesIndex,
	searchById,
	getItemById,
	getRandomItem,
	SearchIndex,
	QuoteMetadata,
} from '@/lib/searchClient';
import { isValidItemId, parseItemId } from '@/lib/routeIds';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

interface HistoryItem {
	id: number;
	author: string;
}

interface Neighbor {
	id: number;
	quote: string;
	author: string;
	book_title: string;
	score: number;
}

export default function QuotesPage() {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<QuoteMetadata> | null>(null);
	const [currentQuote, setCurrentQuote] = useState<QuoteMetadata | null>(null);
	const [currentId, setCurrentId] = useState<number | null>(null);
	const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Load search index
	useEffect(() => {
		loadQuotesIndex()
			.then((index) => {
				setSearchIndex(index);
				setIsLoading(false);
			})
			.catch((err) => {
				console.error('Failed to load search index:', err);
				setIsLoading(false);
			});
	}, []);

	// Handle search when index is loaded and id changes
	const searchForQuote = useCallback(
		(id: number, addToHistory: boolean = true) => {
			if (!searchIndex) return;

			const quote = getItemById(searchIndex, id);
			if (!quote) return;

			const results = searchById(searchIndex, id, 20);
			const uniqueQuotes = new Set<string>();
			const neighborList: Neighbor[] = [];

			for (const result of results) {
				if (result.metadata.quote !== quote.quote && !uniqueQuotes.has(result.metadata.quote)) {
					uniqueQuotes.add(result.metadata.quote);
					neighborList.push({
						id: result.id,
						quote: result.metadata.quote,
						author: result.metadata.author,
						book_title: result.metadata.book_title,
						score: result.score,
					});
				}
			}

			setCurrentQuote(quote);
			setCurrentId(id);
			setNeighbors(neighborList);

			// Add to history
			if (addToHistory) {
				setHistory((prev) => {
					const existingIndex = prev.findIndex((item) => item.id === id);
					if (existingIndex >= 0) {
						return prev.slice(0, existingIndex + 1);
					}
					return [...prev, { id, author: quote.author || 'Unknown' }];
				});
			}
		},
		[searchIndex]
	);

	// Load initial or URL-specified quote
	useEffect(() => {
		if (!router.isReady || !searchIndex) return;

		const id = parseItemId(router.query.id);

		if (isValidItemId(id, searchIndex.numItems)) {
			searchForQuote(id);
		} else {
			const random = getRandomItem(searchIndex);
			router.replace(`/quotes?id=${random.id}`, undefined, { shallow: true });
		}
	}, [router, router.isReady, router.query.id, searchIndex, searchForQuote]);

	const handleNeighborClick = (id: number) => {
		router.push(`/quotes?id=${id}`, undefined, { shallow: true });
	};

	const handleHistoryClick = (id: number) => {
		router.push(`/quotes?id=${id}`, undefined, { shallow: true });
	};

	const loadRandom = () => {
		if (!searchIndex) return;
		const random = getRandomItem(searchIndex);
		setHistory([]);
		router.push(`/quotes?id=${random.id}`, undefined, { shallow: true });
	};

	return (
		<main className={`min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden flex flex-col bg-white dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Quotes</title>
			</Head>

			{/* Header - fixed height */}
			<header className="sticky top-0 z-50 min-h-12 shrink-0 flex flex-wrap sm:flex-nowrap items-center gap-x-3 px-3 sm:px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div className="order-2 sm:order-1 basis-full sm:basis-auto sm:flex-1 overflow-x-auto no-scrollbar border-t border-gray-100 dark:border-gray-800 sm:border-0">
					<div className="min-h-10 flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
						{history.length === 0 ? (
							<span className="text-gray-400 dark:text-gray-600">No history</span>
						) : (
							history.map((item, index) => (
								<React.Fragment key={item.id}>
									{index > 0 && <span className="text-gray-300 dark:text-gray-600">&rarr;</span>}
									<button
										onClick={() => handleHistoryClick(item.id)}
										className={`min-h-10 py-2 hover:text-accent active:scale-[0.96] transition-transform ${item.id === currentId ? 'text-accent font-medium' : ''}`}>
										{item.author}
									</button>
								</React.Fragment>
							))
						)}
					</div>
				</div>
				<div className="order-1 sm:order-2 ml-auto flex items-center gap-1 sm:gap-2 text-xs sm:text-sm shrink-0">
					<button onClick={loadRandom} className="min-h-10 px-2 uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white active:scale-[0.96] transition-transform">
						Random
					</button>
					{currentId !== null && (
						<Link href={`/lineage?id=${currentId}`} className="min-h-10 px-2 flex items-center uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white active:scale-[0.96] transition-transform">
							Lineage
						</Link>
					)}
					<Link href="/" className="min-h-10 px-2 uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 active:scale-[0.96] transition-transform">
						<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back
					</Link>
				</div>
			</header>

			{isLoading ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
			) : !currentQuote ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">No quote selected</div>
			) : (
				<>
					{/* Main quote - fixed height */}
					<div className="sticky top-20 sm:top-12 z-40 min-h-36 max-h-[42dvh] lg:h-32 lg:min-h-0 lg:max-h-none shrink-0 p-4 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-accent text-white flex flex-col">
						<div className="flex-1 overflow-y-auto min-h-0 mb-1">
							<p className="text-sm sm:text-base leading-relaxed max-w-5xl">{currentQuote.quote}</p>
						</div>
						<div className="shrink-0 text-right text-sm">
							<span className="font-medium">{currentQuote.author || 'Unknown'}</span>
							{currentQuote.book_title && <span className="opacity-80 italic ml-2">{currentQuote.book_title}</span>}
						</div>
					</div>

					{/* Matrix grid - 12 items: 3cols×4rows or 4cols×3rows */}
					<div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:[grid-template-rows:repeat(4,minmax(0,1fr))] xl:[grid-template-rows:repeat(3,minmax(0,1fr))] gap-px bg-gray-200 dark:bg-gray-700">
						{neighbors.slice(0, 12).map((neighbor) => (
							<button
								key={neighbor.id}
								onClick={() => handleNeighborClick(neighbor.id)}
								className="group min-h-40 sm:min-h-44 lg:min-h-0 text-left p-4 lg:p-3 bg-white dark:bg-gray-900 hover:bg-accent hover:text-white dark:hover:bg-accent [transition-property:color,background-color,transform] active:scale-[0.96] lg:active:scale-[0.99] overflow-hidden">
								<div className="h-full flex flex-col min-h-0">
									<div className="flex-1 overflow-y-auto min-h-0 mb-1">
										<p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 group-hover:text-white">{neighbor.quote}</p>
									</div>
									<div className="shrink-0 flex justify-between items-end gap-2 text-xs tabular-nums">
										<span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-white truncate">
											{neighbor.author || 'Unknown'}
										</span>
										<span className="text-gray-400 dark:text-gray-500 group-hover:text-white/70 ml-1">
											{(neighbor.score * 100).toFixed(0)}%
										</span>
									</div>
								</div>
							</button>
						))}
					</div>
				</>
			)}
		</main>
	);
}
