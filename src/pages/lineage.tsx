import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import { loadQuotesIndex, type QuoteMetadata, type SearchIndex } from '@/lib/searchClient';
import { findLineage, type LineageItem, type LineageResult } from '@/lib/lineageSearch';
import { isValidItemId, parseItemId } from '@/lib/routeIds';

const jetBrainsMono = JetBrains_Mono({ subsets: ['latin'] });

const eraStyles: Record<string, string> = {
	Ancient: 'bg-[#C58B12] text-[#211704]',
	Medieval: 'bg-[#75685C] text-white',
	Renaissance: 'bg-[#B83B2F] text-white',
	Enlightenment: 'bg-[#2E55B8] text-white',
	'19th Century': 'bg-[#176B4D] text-white',
	'20th Century': 'bg-[#55318F] text-white',
	Contemporary: 'bg-[#91354F] text-white',
	Unknown: 'bg-[#3B3B3F] text-white',
};

function formatYear(item: LineageItem): string {
	if (item.year === undefined) return 'undated';
	if (item.year < 0) return `${Math.abs(item.year)} BCE`;
	return String(item.year);
}

function SourcePanel({ item, echoCount }: { item: LineageItem; echoCount: number }) {
	return (
		<aside className="flex flex-col bg-[#55318F] text-white lg:min-h-0 lg:overflow-y-auto">
			<div className="flex items-start justify-between gap-5 border-b border-white/20 p-5 text-[10px] uppercase tracking-[0.18em] text-white/60 sm:p-7">
				<span>source</span>
				<span className="tabular-nums">{String(echoCount).padStart(2, '0')} echoes</span>
			</div>

			<div className="flex flex-1 flex-col justify-between p-5 sm:p-7 lg:p-8">
				<p className="max-w-3xl text-lg leading-relaxed text-pretty sm:text-xl lg:text-[clamp(1.05rem,1.55vw,1.45rem)]">{item.quote}</p>

				<div className="mt-12">
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-5 border-t border-white/20 pt-5">
						<div className="min-w-0">
							<p className="truncate text-sm font-medium">{item.author || 'Unknown author'}</p>
							{item.book_title && <p className="mt-1 truncate text-xs text-white/55">{item.book_title}</p>}
						</div>
						<div className="text-right">
							<p className="text-xl tabular-nums">{formatYear(item)}</p>
							<p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/55">{item.era}</p>
						</div>
					</div>

					<Link
						href={`/quotes?id=${item.id}`}
						className="mt-6 flex min-h-10 w-fit items-center border border-white/35 px-3 text-xs transition-[background-color,scale] duration-150 ease-out hover:bg-white/10 active:scale-[0.96]">
						open source &rarr;
					</Link>
				</div>
			</div>
		</aside>
	);
}

function EchoRecord({ item, index }: { item: LineageItem; index: number }) {
	const affinity = Math.max(0, Math.min(100, item.similarity * 100));

	return (
		<Link
			href={`/quotes?id=${item.id}`}
			className="group relative grid min-h-52 grid-cols-[5rem_minmax(0,1fr)] border-b border-black/20 bg-[#F1EEE8] text-[#17141F] outline-none transition-[background-color,color,transform] duration-200 ease-out hover:bg-[#55318F] hover:text-white focus-visible:bg-[#55318F] focus-visible:text-white active:scale-[0.96] sm:grid-cols-[7.5rem_minmax(0,1fr)]">
			<div className="flex flex-col justify-between border-r border-black/20 p-4 transition-colors duration-200 group-hover:border-white/20 group-focus-visible:border-white/20 sm:p-5">
				<span className="text-[10px] tabular-nums opacity-45">{String(index + 1).padStart(2, '0')}</span>
				<span className="text-sm tabular-nums">{formatYear(item)}</span>
			</div>

			<div className="flex min-w-0 flex-col justify-between p-4 sm:p-5">
				<div className="flex items-start justify-between gap-5">
					<p className="line-clamp-6 max-w-3xl text-sm leading-relaxed text-pretty sm:text-base">{item.quote}</p>
					<span className="hidden shrink-0 text-xs tabular-nums opacity-50 sm:block">{affinity.toFixed(0)}%</span>
				</div>

				<div className="mt-8 flex items-end justify-between gap-4 text-xs">
					<div className="min-w-0">
						<span className="block truncate font-medium">{item.author || 'Unknown author'}</span>
						{item.book_title && <span className="mt-1 block truncate opacity-55">{item.book_title}</span>}
					</div>
					<span className="shrink-0 tabular-nums opacity-50 sm:hidden">{affinity.toFixed(0)}%</span>
				</div>
			</div>

			<div className="absolute inset-x-0 bottom-0 h-1 bg-black/10 group-hover:bg-white/15 group-focus-visible:bg-white/15">
				<div
					className="h-full bg-[#55318F] transition-[background-color] duration-200 group-hover:bg-white group-focus-visible:bg-white"
					style={{ width: `${affinity}%` }}
				/>
			</div>
		</Link>
	);
}

function HistoricalStrata({ result }: { result: LineageResult }) {
	const byEra = new Map<string, LineageItem[]>();
	for (const item of result.lineage) {
		const existing = byEra.get(item.era) ?? [];
		existing.push(item);
		byEra.set(item.era, existing);
	}

	let itemIndex = 0;

	return (
		<section className="bg-[#17141F] lg:min-h-0 lg:overflow-y-auto" aria-label="Historical echoes">
			<div className="flex min-h-14 items-center justify-between border-b border-white/15 px-4 text-[10px] uppercase tracking-[0.16em] text-white/50 sm:px-5">
				<span>earliest</span>
				<span>affinity</span>
				<span>latest</span>
			</div>

			{Array.from(byEra.entries()).map(([era, items]) => {
				const eraId = `era-${era.replaceAll(' ', '-').toLowerCase()}`;
				return (
					<section key={era} aria-labelledby={eraId}>
						<header
							className={`sticky top-16 z-20 flex min-h-14 items-center justify-between gap-5 border-b border-black/20 px-4 lg:top-0 sm:px-5 ${eraStyles[era] ?? eraStyles.Unknown}`}>
							<h2 id={eraId} className="text-sm uppercase tracking-[-0.03em] sm:text-base">
								{era}
							</h2>
							<span className="text-[10px] tabular-nums opacity-65">{String(items.length).padStart(2, '0')}</span>
						</header>

						{items.map((item) => {
							const index = itemIndex;
							itemIndex += 1;
							return <EchoRecord key={item.id} item={item} index={index} />;
						})}
					</section>
				);
			})}
		</section>
	);
}

export default function LineagePage() {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<QuoteMetadata> | null>(null);
	const [result, setResult] = useState<LineageResult | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setError(null);
		loadQuotesIndex()
			.then((index) => {
				if (!cancelled) setSearchIndex(index);
			})
			.catch((loadError) => {
				console.error('Failed to load search index:', loadError);
				if (!cancelled) {
					setError('The quote index could not be loaded.');
					setLoading(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!router.isReady || !searchIndex) return;

		const id = parseItemId(router.query.id);
		if (!isValidItemId(id, searchIndex.numItems)) {
			setResult(null);
			setLoading(false);
			return;
		}

		setLoading(true);
		setResult(findLineage(searchIndex, id));
		setLoading(false);
	}, [router.isReady, router.query.id, searchIndex]);

	const sourceId = result?.sourceQuote.id;

	return (
		<main className={`min-h-[100dvh] bg-[#17141F] text-white lg:h-[100dvh] lg:overflow-hidden ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Lineage</title>
			</Head>

			<header className="sticky top-0 z-50 flex min-h-16 items-center justify-between gap-5 border-b border-white/15 bg-[#17141F] px-4 sm:px-5 lg:static">
				<h1 className="text-xl uppercase tracking-[-0.06em] sm:text-2xl">Lineage</h1>
				<nav className="flex shrink-0 items-center gap-1 text-xs" aria-label="Lineage navigation">
					<Link
						href={sourceId === undefined ? '/quotes' : `/quotes?id=${sourceId}`}
						className="flex min-h-10 items-center px-2 text-white/60 transition-[color,scale] duration-150 ease-out hover:text-white active:scale-[0.96]">
						&larr; quotes
					</Link>
					<Link
						href="/"
						className="flex min-h-10 min-w-10 items-center justify-center text-white/60 transition-[color,scale] duration-150 ease-out hover:text-white active:scale-[0.96]">
						/
					</Link>
				</nav>
			</header>

			{loading ? (
				<div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
					<p className="text-xs uppercase tracking-[0.16em] text-white/50">Tracing lineage…</p>
				</div>
			) : error ? (
				<div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-6 text-center">
					<p className="text-sm text-white/60">{error}</p>
					<Link
						href="/quotes"
						className="mt-6 flex min-h-10 items-center border border-white/25 px-4 text-xs transition-[background-color,scale] hover:bg-white/10 active:scale-[0.96]">
						return to quotes
					</Link>
				</div>
			) : !result ? (
				<div className="grid min-h-[calc(100dvh-4rem)] place-items-center px-5">
					<div className="w-full max-w-xl bg-[#55318F] p-6 sm:p-8">
						<p className="text-xl uppercase tracking-[-0.04em]">No source quote</p>
						<Link
							href="/quotes"
							className="mt-8 inline-flex min-h-10 items-center border border-white/40 px-4 text-xs transition-[background-color,scale] hover:bg-white/10 active:scale-[0.96]">
							open quotes &rarr;
						</Link>
					</div>
				</div>
			) : (
				<div className="lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(20rem,43%)_minmax(0,57%)]">
					<SourcePanel item={result.sourceQuote} echoCount={result.lineage.length} />
					<HistoricalStrata result={result} />
				</div>
			)}
		</main>
	);
}
