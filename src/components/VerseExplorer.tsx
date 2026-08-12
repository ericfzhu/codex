import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import { getItemById, getRandomItem, searchById, type SearchIndex, type VerseMetadata } from '@/lib/searchClient';
import { isValidItemId, parseItemId } from '@/lib/routeIds';
import LoadingProgress from '@/components/LoadingProgress';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'] });
const EXPLORER_STYLE_COUNT = 4;
const EXPLORER_GRID_SLOT_COUNT = 10;
const LARGE_GRID_ORDER_CLASSES = [
	'lg:order-1',
	'lg:order-2',
	'lg:order-3',
	'lg:order-4',
	'lg:order-5',
	'lg:order-6',
	'lg:order-7',
	'lg:order-8',
	'lg:order-9',
	'lg:order-10',
] as const;

interface SystemTilePositions {
	controls: number;
	history: number;
}

const selectedStylesByRoute = new Map<string, number>();
const selectedSystemTilePositionsByRoute = new Map<string, SystemTilePositions>();

type Neighbor<T> = T & { id: number; score: number };

interface HistoryItem {
	id: number;
	reference: string;
}

interface ExplorerMetadata {
	id: number;
}

export interface VerseExplorerConfig<T extends ExplorerMetadata = VerseMetadata> {
	title: string;
	route: string;
	loadIndex: () => Promise<SearchIndex<T>>;
	errorMessage: string;
	emptyMessage?: string;
	itemNoun?: string;
	getText: (item: T) => string;
	getSource: (item: T) => string;
	formatReference: (item: T) => string;
	formatSource?: (source: string) => string;
	utilityLink?: {
		label: string;
		href: (id: number) => string;
	};
	accent: {
		text: string;
		hoverText: string;
		background: string;
		hoverBackground: string;
		darkHoverBackground: string;
		surface: string;
		surfaceText: string;
		separator: string;
	};
}

export default function VerseExplorer<T extends ExplorerMetadata = VerseMetadata>({ config }: { config: VerseExplorerConfig<T> }) {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<T> | null>(null);
	const [currentVerse, setCurrentVerse] = useState<T | null>(null);
	const [currentId, setCurrentId] = useState<number | null>(null);
	const [neighbors, setNeighbors] = useState<Neighbor<T>[]>([]);
	const [history, setHistory] = useState<HistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadingProgress, setLoadingProgress] = useState(6);
	const [error, setError] = useState<string | null>(null);
	const [loadAttempt, setLoadAttempt] = useState(0);
	const [styleIndex, setStyleIndex] = useState(0);
	const [systemTilePositions, setSystemTilePositions] = useState<SystemTilePositions>({ controls: 1, history: 4 });
	const formatSource = config.formatSource ?? ((source: string) => source);

	useEffect(() => {
		const existingSelection = selectedStylesByRoute.get(config.route);
		if (existingSelection !== undefined) {
			setStyleIndex(existingSelection);
			return;
		}

		const storageKey = `codex-explorer-style:${config.route}`;
		const previousIndex = Number.parseInt(sessionStorage.getItem(storageKey) ?? '', 10);
		const nextIndex = Number.isInteger(previousIndex)
			? (previousIndex + 1 + Math.floor(Math.random() * (EXPLORER_STYLE_COUNT - 1))) % EXPLORER_STYLE_COUNT
			: Math.floor(Math.random() * EXPLORER_STYLE_COUNT);

		setStyleIndex(nextIndex);
		selectedStylesByRoute.set(config.route, nextIndex);
		sessionStorage.setItem(storageKey, String(nextIndex));
	}, [config.route]);

	useEffect(() => {
		const existingPositions = selectedSystemTilePositionsByRoute.get(config.route);
		if (existingPositions) {
			setSystemTilePositions(existingPositions);
			return;
		}

		const storageKey = `codex-explorer-layout:${config.route}`;
		const [previousControls, previousHistory] = (sessionStorage.getItem(storageKey) ?? '').split(',').map((value) => Number.parseInt(value, 10));
		const controls = Math.floor(Math.random() * EXPLORER_GRID_SLOT_COUNT);
		let history = Math.floor(Math.random() * (EXPLORER_GRID_SLOT_COUNT - 1));
		if (history >= controls) history += 1;

		if (controls === previousControls && history === previousHistory) {
			history = (history + 1) % EXPLORER_GRID_SLOT_COUNT;
			if (history === controls) history = (history + 1) % EXPLORER_GRID_SLOT_COUNT;
		}

		const nextPositions = { controls, history };
		setSystemTilePositions(nextPositions);
		selectedSystemTilePositionsByRoute.set(config.route, nextPositions);
		sessionStorage.setItem(storageKey, `${controls},${history}`);
	}, [config.route]);

	useEffect(() => {
		let cancelled = false;
		let revealTimer: ReturnType<typeof setTimeout> | undefined;
		setIsLoading(true);
		setLoadingProgress(6);
		setError(null);
		const progressTimer = setInterval(() => {
			setLoadingProgress((progress) => Math.min(92, progress + Math.max(0.4, (92 - progress) * 0.055)));
		}, 180);

		config
			.loadIndex()
			.then((index) => {
				if (cancelled) return;
				clearInterval(progressTimer);
				setSearchIndex(index);
				setLoadingProgress(100);
				revealTimer = setTimeout(() => setIsLoading(false), 260);
			})
			.catch((loadError) => {
				console.error(`Failed to load ${config.title} index:`, loadError);
				if (!cancelled) {
					clearInterval(progressTimer);
					setError(config.errorMessage);
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
			clearInterval(progressTimer);
			if (revealTimer) clearTimeout(revealTimer);
		};
	}, [config, loadAttempt]);

	const searchForVerse = useCallback(
		(id: number) => {
			if (!searchIndex) return;
			const verse = getItemById(searchIndex, id);
			if (!verse) return;

			const uniqueTexts = new Set<string>();
			const neighborList: Neighbor<T>[] = [];
			for (const result of searchById(searchIndex, id, 20)) {
				const resultText = config.getText(result.metadata);
				if (resultText !== config.getText(verse) && !uniqueTexts.has(resultText)) {
					uniqueTexts.add(resultText);
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
		[config, searchIndex],
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

	const explorerStyles = [
		{
			name: 'field',
			separator: config.accent.separator,
			selected: config.accent.background,
			selectedText: 'text-white',
			accentText: 'text-white',
			related: config.accent.surface,
			relatedText: config.accent.surfaceText,
			history: config.accent.surface,
			historyText: config.accent.surfaceText,
			control: config.accent.background,
			controlText: 'text-white',
		},
		{
			name: 'paper',
			separator: config.accent.separator,
			selected: 'bg-stone-100 dark:bg-stone-900',
			selectedText: 'text-stone-900 dark:text-stone-100',
			accentText: config.accent.text,
			related: 'bg-stone-100 dark:bg-stone-900',
			relatedText: 'text-stone-900 dark:text-stone-100',
			history: 'bg-stone-100 dark:bg-stone-900',
			historyText: 'text-stone-900 dark:text-stone-100',
			control: 'bg-stone-100 dark:bg-stone-900',
			controlText: 'text-stone-900 dark:text-stone-100',
		},
		{
			name: 'bloom',
			separator: 'bg-white dark:bg-gray-950',
			selected: config.accent.surface,
			selectedText: config.accent.surfaceText,
			accentText: config.accent.text,
			related: config.accent.background,
			relatedText: 'text-white',
			history: config.accent.background,
			historyText: 'text-white',
			control: config.accent.surface,
			controlText: config.accent.surfaceText,
		},
		{
			name: 'night',
			separator: config.accent.separator,
			selected: 'bg-gray-950',
			selectedText: 'text-gray-100',
			accentText: config.accent.text,
			related: 'bg-gray-900',
			relatedText: 'text-gray-100',
			history: 'bg-gray-900',
			historyText: 'text-gray-100',
			control: 'bg-gray-950',
			controlText: 'text-gray-100',
		},
	] as const;

	const explorerStyle = explorerStyles[styleIndex];
	const neighborHoverStyles =
		explorerStyle.name === 'bloom'
			? 'hover:bg-gray-950 hover:text-white dark:hover:bg-white dark:hover:text-gray-950'
			: `${config.accent.hoverBackground} hover:text-white ${config.accent.darkHoverBackground}`;

	const cycleStyle = (direction: number) => {
		setStyleIndex((currentIndex) => {
			const nextIndex = (currentIndex + direction + explorerStyles.length) % explorerStyles.length;
			selectedStylesByRoute.set(config.route, nextIndex);
			sessionStorage.setItem(`codex-explorer-style:${config.route}`, String(nextIndex));
			return nextIndex;
		});
	};

	const renderNeighbor = (neighbor: Neighbor<T>, gridSlot: number) => (
		<button
			key={neighbor.id}
			data-grid-role="neighbor"
			data-grid-slot={gridSlot + 1}
			onClick={() => navigateTo(neighbor.id)}
			className={`group min-h-44 lg:min-h-0 w-full overflow-hidden p-4 text-left ${LARGE_GRID_ORDER_CLASSES[gridSlot]} ${explorerStyle.related} ${explorerStyle.relatedText} ${neighborHoverStyles} transition-[color,background-color,scale] duration-200 ease-out active:scale-[0.96]`}>
			<div className="flex h-full min-h-0 flex-col justify-between">
				<p className="line-clamp-6 overflow-hidden text-sm leading-relaxed text-pretty lg:line-clamp-5">{config.getText(neighbor)}</p>
				<div className="mt-5 flex shrink-0 items-end justify-between gap-3 text-xs tabular-nums">
					<div className="min-w-0">
						<span className="block truncate font-medium">{config.formatReference(neighbor)}</span>
						<span className="block truncate opacity-60">{formatSource(config.getSource(neighbor))}</span>
					</div>
					<span className="shrink-0 opacity-60">{(neighbor.score * 100).toFixed(0)}%</span>
				</div>
			</div>
		</button>
	);

	const visibleNeighbors = neighbors.slice(0, 8);
	const neighborGridSlots = Array.from({ length: EXPLORER_GRID_SLOT_COUNT }, (_, index) => index).filter(
		(index) => index !== systemTilePositions.controls && index !== systemTilePositions.history,
	);
	const neighborTiles = visibleNeighbors.map((neighbor, index) => renderNeighbor(neighbor, neighborGridSlots[index]));

	return (
		<main className={`min-h-[100dvh] bg-white dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head>
				<title>{`Codex - ${config.title}`}</title>
			</Head>

			{isLoading ? (
				<div className="flex min-h-[100dvh]">
					<LoadingProgress label={`Loading ${config.title}`} progress={loadingProgress} barClassName={config.accent.background} />
				</div>
			) : error ? (
				<div className="flex min-h-[100dvh] flex-col items-center justify-center">
					<p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
					<button
						onClick={() => setLoadAttempt((attempt) => attempt + 1)}
						className={`min-h-10 px-3 ${config.accent.text} hover:underline active:scale-[0.96] transition-transform`}>
						Try again
					</button>
				</div>
			) : !currentVerse ? (
				<div className="flex min-h-[100dvh] items-center justify-center text-gray-500 dark:text-gray-400">
					{config.emptyMessage ?? 'No verse selected'}
				</div>
			) : (
				<div
					data-explorer-style={explorerStyle.name}
					className={`grid min-h-[100dvh] grid-cols-1 gap-px sm:grid-cols-2 lg:h-[100dvh] lg:grid-cols-4 lg:[grid-template-rows:repeat(3,minmax(0,1fr))] lg:overflow-hidden ${explorerStyle.separator}`}>
					<section
						className={`flex min-h-56 flex-col justify-between p-5 sm:col-span-2 lg:min-h-0 ${explorerStyle.selected} ${explorerStyle.selectedText}`}>
						<div className="flex items-start justify-between gap-4 text-xs">
							<span className={`font-medium lowercase ${explorerStyle.accentText}`}>{config.title}</span>
							<span className="max-w-[55%] text-right opacity-70">{formatSource(config.getSource(currentVerse))}</span>
						</div>
						<p className="my-6 min-h-0 max-w-3xl overflow-y-auto text-base leading-relaxed text-pretty no-scrollbar sm:text-lg">
							{config.getText(currentVerse)}
						</p>
						<span className="self-end text-sm font-medium tabular-nums">{config.formatReference(currentVerse)}</span>
					</section>

					{neighborTiles[0]}

					<section
						data-grid-role="controls"
						data-grid-slot={systemTilePositions.controls + 1}
						className={`flex min-h-44 flex-col justify-between p-4 lg:min-h-0 ${LARGE_GRID_ORDER_CLASSES[systemTilePositions.controls]} ${explorerStyle.control} ${explorerStyle.controlText}`}>
						<div>
							<span className="text-xs opacity-70">explore:</span>
							<p className={`mt-1 lowercase ${explorerStyle.accentText}`}>{config.title}</p>
							<div className="mt-3 flex items-center gap-1 text-xs">
								<span className="mr-1 opacity-70">style:</span>
								<button
									onClick={() => cycleStyle(-1)}
									className="flex min-h-10 min-w-10 items-center justify-center transition-[opacity,scale] duration-150 ease-out hover:opacity-60 active:scale-[0.96]"
									aria-label="Previous visual style">
									&lt;
								</button>
								<span className={`min-w-12 text-center ${explorerStyle.accentText}`}>{explorerStyle.name}</span>
								<button
									onClick={() => cycleStyle(1)}
									className="flex min-h-10 min-w-10 items-center justify-center transition-[opacity,scale] duration-150 ease-out hover:opacity-60 active:scale-[0.96]"
									aria-label="Next visual style">
									&gt;
								</button>
							</div>
						</div>
						<div className="flex items-end justify-between gap-3">
							<button
								onClick={loadRandom}
								className="min-h-11 border border-dashed border-current/60 px-3 py-2 text-left transition-[opacity,scale] duration-150 ease-out hover:opacity-60 active:scale-[0.96]">
								shuffle
								<br />
								connections
							</button>
							<div className="flex flex-col items-end text-xs">
								{config.utilityLink && currentId !== null && (
									<Link
										href={config.utilityLink.href(currentId)}
										className="flex min-h-10 items-center px-1 opacity-70 transition-[opacity,scale] duration-150 ease-out hover:opacity-100 active:scale-[0.96]">
										{config.utilityLink.label} &rarr;
									</Link>
								)}
								<Link
									href="/"
									className="flex min-h-10 items-center px-1 text-right opacity-70 transition-[opacity,scale] duration-150 ease-out hover:opacity-100 active:scale-[0.96]">
									&larr; /
								</Link>
							</div>
						</div>
					</section>

					{neighborTiles.slice(1, 3)}

					<section
						data-grid-role="history"
						data-grid-slot={systemTilePositions.history + 1}
						className={`flex min-h-44 flex-col justify-between overflow-hidden p-4 lg:min-h-0 ${LARGE_GRID_ORDER_CLASSES[systemTilePositions.history]} ${explorerStyle.history} ${explorerStyle.historyText}`}>
						<div className="flex items-center justify-between gap-3 text-xs">
							<span className="opacity-60">trail:</span>
							<span className="tabular-nums opacity-60">{history.length}</span>
						</div>
						<div className="my-3 min-h-0 overflow-y-auto no-scrollbar">
							{history.length === 0 ? (
								<span className="text-sm opacity-60">Starting point</span>
							) : (
								history.map((item, index) => (
									<React.Fragment key={item.id}>
										{index > 0 && <span className="block py-0.5 opacity-40">&darr;</span>}
										<button
											onClick={() => navigateTo(item.id)}
											className={`min-h-10 max-w-full truncate py-2 text-left text-sm transition-[color,scale] duration-150 ease-out active:scale-[0.96] ${config.accent.hoverText} ${item.id === currentId ? `${config.accent.text} font-medium` : ''}`}>
											{item.reference}
										</button>
									</React.Fragment>
								))
							)}
						</div>
						<span className="text-xs opacity-60">select {config.itemNoun ?? 'a passage'} to recenter</span>
					</section>

					{neighborTiles.slice(3)}
				</div>
			)}
		</main>
	);
}
