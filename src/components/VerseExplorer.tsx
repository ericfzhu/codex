import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import {
	getItemById,
	getRandomItem,
	searchById,
	type SearchIndex,
	type VerseMetadata,
} from '@/lib/searchClient';
import { isValidItemId, parseItemId } from '@/lib/routeIds';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'] });

interface Neighbor extends VerseMetadata {
	score: number;
}

interface HistoryItem {
	id: number;
	reference: string;
}

export interface VerseExplorerConfig {
	title: string;
	route: string;
	loadIndex: () => Promise<SearchIndex<VerseMetadata>>;
	errorMessage: string;
	emptyMessage?: string;
	formatReference: (verse: VerseMetadata) => string;
	formatSource?: (source: string) => string;
	accent: {
		text: string;
		hoverText: string;
		background: string;
		hoverBackground: string;
		darkHoverBackground: string;
	};
}

export default function VerseExplorer({ config }: { config: VerseExplorerConfig }) {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<VerseMetadata> | null>(null);
	const [currentVerse, setCurrentVerse] = useState<VerseMetadata | null>(null);
	const [currentId, setCurrentId] = useState<number | null>(null);
	const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const formatSource = config.formatSource ?? ((source: string) => source);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		config.loadIndex()
			.then((index) => {
				if (!cancelled) setSearchIndex(index);
			})
			.catch((loadError) => {
				console.error(`Failed to load ${config.title} index:`, loadError);
				if (!cancelled) setError(config.errorMessage);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [config, loadAttempt]);

	const searchForVerse = useCallback(
		(id: number) => {
			if (!searchIndex) return;
			const verse = getItemById(searchIndex, id);
			if (!verse) return;

			const uniqueTexts = new Set<string>();
			const neighborList: Neighbor[] = [];
			for (const result of searchById(searchIndex, id, 20)) {
				if (result.metadata.text !== verse.text && !uniqueTexts.has(result.metadata.text)) {
					uniqueTexts.add(result.metadata.text);
					neighborList.push({ ...result.metadata, id: result.id, score: result.score });
				}
			}

			setCurrentVerse(verse);
			setCurrentId(id);
			setNeighbors(neighborList);
			setHistory((previous) => {
				const existingIndex = previous.findIndex((item) => item.id === id);
				if (existingIndex >= 0) return previous.slice(0, existingIndex + 1);
				return [...previous, { id, reference: config.formatReference(verse) }];
			});
		},
		[config, searchIndex]
	);

	useEffect(() => {
		if (!router.isReady || !searchIndex) return;
		const id = parseItemId(router.query.id);
		if (isValidItemId(id, searchIndex.numItems)) {
			searchForVerse(id);
		} else {
			const random = getRandomItem(searchIndex);
			void router.replace(`${config.route}?id=${random.id}`, undefined, { shallow: true });
		}
	}, [config.route, router, router.isReady, router.query.id, searchIndex, searchForVerse]);

	const navigateTo = (id: number) => {
		void router.push(`${config.route}?id=${id}`, undefined, { shallow: true });
	};

	const loadRandom = () => {
		if (!searchIndex) return;
		setHistory([]);
		navigateTo(getRandomItem(searchIndex).id);
	};

	return (
		<main className={`min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden flex flex-col bg-white dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head><title>Codex - {config.title}</title></Head>
			<header className="sticky top-0 z-50 min-h-12 shrink-0 flex flex-wrap sm:flex-nowrap items-center gap-x-3 px-3 sm:px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div className="order-2 sm:order-1 basis-full sm:basis-auto sm:flex-1 overflow-x-auto no-scrollbar border-t border-gray-100 dark:border-gray-800 sm:border-0">
					<div className="min-h-10 flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
						{history.length === 0 ? <span className="text-gray-400 dark:text-gray-600">No history</span> : history.map((item, index) => (
							<React.Fragment key={item.id}>
								{index > 0 && <span className="text-gray-300 dark:text-gray-600">&rarr;</span>}
								<button onClick={() => navigateTo(item.id)} className={`min-h-10 py-2 ${config.accent.hoverText} active:scale-[0.96] transition-transform ${item.id === currentId ? `${config.accent.text} font-medium` : ''}`}>
									{item.reference}
								</button>
							</React.Fragment>
						))}
					</div>
				</div>
				<div className="order-1 sm:order-2 ml-auto flex items-center gap-1 sm:gap-2 text-xs sm:text-sm shrink-0">
					<button onClick={loadRandom} className="min-h-10 px-2 uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white active:scale-[0.96] transition-transform">Random</button>
					<Link href="/" className="min-h-10 px-2 uppercase text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 active:scale-[0.96] transition-transform">
						<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
						Back
					</Link>
				</div>
			</header>

			{isLoading ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">Loading...</div>
			) : error ? (
				<div className="flex-1 flex flex-col items-center justify-center">
					<p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
					<button onClick={() => setLoadAttempt((attempt) => attempt + 1)} className={`${config.accent.text} hover:underline`}>Try again</button>
				</div>
			) : !currentVerse ? (
				<div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">{config.emptyMessage ?? 'No verse selected'}</div>
			) : (
				<>
					<div className={`sticky top-20 sm:top-12 z-40 min-h-36 max-h-[42dvh] lg:h-32 lg:min-h-0 lg:max-h-none shrink-0 p-4 sm:px-5 sm:py-4 border-b border-gray-200 dark:border-gray-700 ${config.accent.background} text-white flex flex-col`}>
						<div className="shrink-0 flex items-center gap-2 mb-1"><span className="text-xs px-2 py-0.5 border border-white/30">{formatSource(currentVerse.source)}</span></div>
						<div className="flex-1 overflow-y-auto min-h-0 my-2"><p className="text-sm sm:text-base leading-relaxed max-w-5xl">{currentVerse.text}</p></div>
						<div className="shrink-0 text-right text-xs sm:text-sm"><span className="font-medium">{config.formatReference(currentVerse)}</span></div>
					</div>
					<div className="flex-none lg:flex-1 lg:min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:[grid-template-rows:repeat(4,minmax(0,1fr))] xl:[grid-template-rows:repeat(3,minmax(0,1fr))] gap-px bg-gray-200 dark:bg-gray-700">
						{neighbors.slice(0, 12).map((neighbor) => (
							<button key={neighbor.id} onClick={() => navigateTo(neighbor.id)} className={`group min-h-40 sm:min-h-44 lg:min-h-0 text-left p-4 lg:p-3 bg-white dark:bg-gray-900 ${config.accent.hoverBackground} hover:text-white ${config.accent.darkHoverBackground} [transition-property:color,background-color,transform] active:scale-[0.96] lg:active:scale-[0.99] overflow-hidden`}>
								<div className="h-full flex flex-col min-h-0">
									<div className="shrink-0 flex items-center gap-2 mb-2"><span className="text-[11px] sm:text-xs px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 group-hover:border-white/30 group-hover:text-white">{formatSource(neighbor.source)}</span></div>
									<div className="flex-1 overflow-y-auto min-h-0 mb-2"><p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100 group-hover:text-white">{neighbor.text}</p></div>
									<div className="shrink-0 flex justify-between items-end gap-2 text-xs tabular-nums">
										<span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-white truncate">{config.formatReference(neighbor)}</span>
										<span className="text-gray-400 dark:text-gray-500 group-hover:text-white/70 ml-1">{(neighbor.score * 100).toFixed(0)}%</span>
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
