import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import {
	loadIslamIndex,
	searchById,
	getItemById,
	getRandomItem,
	SearchIndex,
	VerseMetadata,
} from '@/lib/searchClient';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

interface HistoryItem {
	id: number;
	reference: string;
}

interface Neighbor {
	id: number;
	text: string;
	book: string;
	chapter: string;
	verse: string;
	source: string;
	score: number;
}

function formatReference(verse: VerseMetadata | Neighbor): string {
	return `${verse.book} ${verse.chapter}:${verse.verse}`;
}

const sourceNames: Record<string, string> = {
	QURAN: 'QURAN',
	HADITH: 'HADITH',
};

function formatSource(source: string): string {
	return sourceNames[source] || source;
}

export default function IslamPage() {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<VerseMetadata> | null>(null);
	const [currentVerse, setCurrentVerse] = useState<VerseMetadata | null>(null);
	const [currentId, setCurrentId] = useState<number | null>(null);
	const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Load search index
	useEffect(() => {
		loadIslamIndex()
			.then((index) => {
				setSearchIndex(index);
				setIsLoading(false);
			})
			.catch((err) => {
				console.error('Failed to load Islam index:', err);
				setError('Islam embeddings not yet available. Please check back later.');
				setIsLoading(false);
			});
	}, []);

	// Handle search when index is loaded and id changes
	const searchForVerse = useCallback(
		(id: number, addToHistory: boolean = true) => {
			if (!searchIndex) return;

			const verse = getItemById(searchIndex, id);
			if (!verse) return;

			const results = searchById(searchIndex, id, 20);
			const uniqueTexts = new Set<string>();
			const neighborList: Neighbor[] = [];

			for (const result of results) {
				if (result.metadata.text !== verse.text && !uniqueTexts.has(result.metadata.text)) {
					uniqueTexts.add(result.metadata.text);
					neighborList.push({
						id: result.id,
						text: result.metadata.text,
						book: result.metadata.book,
						chapter: result.metadata.chapter,
						verse: result.metadata.verse,
						source: result.metadata.source,
						score: result.score,
					});
				}
			}

			setCurrentVerse(verse);
			setCurrentId(id);
			setNeighbors(neighborList);

			// Add to history
			if (addToHistory) {
				setHistory((prev) => {
					const existingIndex = prev.findIndex((item) => item.id === id);
					if (existingIndex >= 0) {
						return prev.slice(0, existingIndex + 1);
					}
					return [...prev, { id, reference: formatReference(verse) }];
				});
			}
		},
		[searchIndex]
	);

	// Load initial or URL-specified verse
	useEffect(() => {
		if (!router.isReady || !searchIndex) return;

		const id = router.query.id ? parseInt(router.query.id as string) : null;

		if (id !== null) {
			searchForVerse(id);
		} else {
			const random = getRandomItem(searchIndex);
			router.replace(`/islam?id=${random.id}`, undefined, { shallow: true });
		}
	}, [router.isReady, router.query.id, searchIndex, searchForVerse]);

	const handleNeighborClick = (id: number) => {
		router.push(`/islam?id=${id}`, undefined, { shallow: true });
	};

	const handleHistoryClick = (id: number) => {
		router.push(`/islam?id=${id}`, undefined, { shallow: true });
	};

	const loadRandom = () => {
		if (!searchIndex) return;
		const random = getRandomItem(searchIndex);
		setHistory([]);
		router.push(`/islam?id=${random.id}`, undefined, { shallow: true });
	};

	return (
		<main className={`h-screen overflow-hidden flex flex-col bg-white dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Islam</title>
			</Head>

			{/* Header - fixed height */}
			<header className="h-10 shrink-0 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div className="flex-1 overflow-x-auto scrollbar-thin">
					<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
						{history.length === 0 ? (
							<span className="text-gray-400 dark:text-gray-600">No history</span>
						) : (
							history.map((item, index) => (
								<React.Fragment key={item.id}>
									{index > 0 && <span className="text-gray-300 dark:text-gray-600">&rarr;</span>}
									<button
										onClick={() => handleHistoryClick(item.id)}
										className={`hover:text-emerald-600 ${item.id === currentId ? 'text-emerald-600 font-medium' : ''}`}>
										{item.reference}
									</button>
								</React.Fragment>
							))
						)}
					</div>
				</div>
				<div className="flex items-center gap-4 text-sm shrink-0 ml-4">
					<button onClick={loadRandom} className="uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
						Random
					</button>
					<Link href="/" className="uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1">
						<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
						Back
					</Link>
				</div>
			</header>

			{isLoading ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
			) : error ? (
				<div className="flex-1 flex flex-col items-center justify-center">
					<p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
					<Link href="/" className="text-emerald-600 hover:underline">
						Return home
					</Link>
				</div>
			) : !currentVerse ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">No verse selected</div>
			) : (
				<>
					{/* Main verse - fixed height */}
					<div className="h-28 shrink-0 p-3 border-b border-gray-200 dark:border-gray-700 bg-emerald-600 text-white flex flex-col">
						<div className="shrink-0 flex items-center gap-2 mb-1">
							<span className="text-xs px-2 py-0.5 border border-white/30">{formatSource(currentVerse.source)}</span>
						</div>
						<div className="flex-1 overflow-y-auto min-h-0 mb-1">
							<p className="text-sm leading-relaxed">{currentVerse.text}</p>
						</div>
						<div className="shrink-0 text-right text-sm">
							<span className="font-medium">{formatReference(currentVerse)}</span>
						</div>
					</div>

					{/* Matrix grid - 12 items: 3cols×4rows or 4cols×3rows */}
					<div className="flex-1 min-h-0 grid grid-cols-3 lg:grid-cols-4 [grid-template-rows:repeat(4,minmax(0,1fr))] lg:[grid-template-rows:repeat(3,minmax(0,1fr))] gap-px bg-gray-200 dark:bg-gray-700">
						{neighbors.slice(0, 12).map((neighbor) => (
							<button
								key={neighbor.id}
								onClick={() => handleNeighborClick(neighbor.id)}
								className="group text-left p-1.5 sm:p-2 lg:p-3 bg-white dark:bg-gray-900 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-colors overflow-hidden">
								<div className="h-full flex flex-col min-h-0">
									<div className="shrink-0 flex items-center gap-2 mb-1">
										<span className="text-[10px] sm:text-xs px-1 py-0.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 group-hover:border-white/30 group-hover:text-white">
											{formatSource(neighbor.source)}
										</span>
									</div>
									<div className="flex-1 overflow-y-auto min-h-0 mb-1">
										<p className="text-[10px] sm:text-xs lg:text-sm text-gray-900 dark:text-gray-100 group-hover:text-white">{neighbor.text}</p>
									</div>
									<div className="shrink-0 flex justify-between items-end text-[10px] sm:text-xs">
										<span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-white truncate">
											{formatReference(neighbor)}
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
