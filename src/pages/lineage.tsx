import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { JetBrains_Mono } from 'next/font/google';
import { loadQuotesIndex, SearchIndex, QuoteMetadata } from '@/lib/searchClient';
import { findLineage, LineageResult, LineageItem } from '@/lib/lineageSearch';
import ThemeToggle from '@/components/ThemeToggle';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

const eraColors: Record<string, string> = {
	Ancient: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
	Medieval: 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-200',
	Renaissance: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
	Enlightenment: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200',
	'19th Century': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
	'20th Century': 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
	Contemporary: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
	Unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

function LineageCard({ item, isSource = false }: { item: LineageItem; isSource?: boolean }) {
	return (
		<div
			className={`p-4 rounded-lg border ${
				isSource
					? 'border-accent bg-accent/5 dark:bg-accent/10'
					: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
			}`}>
			<div className="flex items-start justify-between gap-2 mb-2">
				<span className={`text-xs px-2 py-0.5 rounded-full ${eraColors[item.era]}`}>
					{item.year ? item.year : item.era}
				</span>
				{!isSource && (
					<span className="text-xs text-gray-400 dark:text-gray-500">{(item.similarity * 100).toFixed(0)}% similar</span>
				)}
			</div>
			<p className="text-sm text-gray-900 dark:text-gray-100 mb-3 line-clamp-4">{item.quote}</p>
			<div className="flex items-center justify-between">
				<div>
					<p className="font-medium text-gray-900 dark:text-white text-sm">{item.author || 'Unknown'}</p>
					{item.book_title && (
						<p className="text-xs text-gray-500 dark:text-gray-400 italic">{item.book_title}</p>
					)}
				</div>
				<Link
					href={`/quotes?id=${item.id}`}
					className="text-xs text-accent hover:underline">
					Explore &rarr;
				</Link>
			</div>
		</div>
	);
}

function TimelineView({ result }: { result: LineageResult }) {
	// Group by era
	const byEra = new Map<string, LineageItem[]>();
	for (const item of result.lineage) {
		const existing = byEra.get(item.era) || [];
		existing.push(item);
		byEra.set(item.era, existing);
	}

	const eras = Array.from(byEra.keys());

	return (
		<div className="relative">
			{/* Timeline line */}
			<div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

			{/* Source quote */}
			<div className="relative mb-8">
				<div className="absolute left-4 w-3 h-3 -translate-x-1/2 rounded-full bg-accent border-4 border-white dark:border-gray-900" />
				<div className="ml-10">
					<p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Source Quote</p>
					<LineageCard item={result.sourceQuote} isSource />
				</div>
			</div>

			{/* Era groups */}
			{eras.map((era) => (
				<div key={era} className="relative mb-8">
					<div className="absolute left-4 w-2 h-2 -translate-x-1/2 rounded-full bg-gray-300 dark:bg-gray-600" />
					<div className="ml-10">
						<p className="text-xs text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">{era}</p>
						<div className="space-y-3">
							{byEra.get(era)?.map((item) => (
								<LineageCard key={item.id} item={item} />
							))}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

export default function LineagePage() {
	const router = useRouter();
	const [searchIndex, setSearchIndex] = useState<SearchIndex<QuoteMetadata> | null>(null);
	const [result, setResult] = useState<LineageResult | null>(null);
	const [loading, setLoading] = useState(true);

	// Load search index
	useEffect(() => {
		loadQuotesIndex()
			.then(setSearchIndex)
			.catch((err) => console.error('Failed to load search index:', err));
	}, []);

	// Load lineage when index and id are ready
	useEffect(() => {
		if (!router.isReady || !searchIndex) return;

		const id = router.query.id ? parseInt(router.query.id as string) : null;
		if (id === null) {
			setLoading(false);
			return;
		}

		setLoading(true);
		const lineageResult = findLineage(searchIndex, id);
		setResult(lineageResult);
		setLoading(false);
	}, [router.isReady, router.query.id, searchIndex]);

	return (
		<main className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Idea Lineage</title>
			</Head>

			{/* Header */}
			<header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
				<div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button onClick={() => router.back()} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
						</button>
						<h1 className="text-xl font-bold text-gray-900 dark:text-white uppercase">Idea Lineage</h1>
					</div>
					<ThemeToggle />
				</div>
			</header>

			<div className="max-w-4xl mx-auto px-4 py-8">
				{loading ? (
					<div className="text-center py-16">
						<p className="text-gray-500 dark:text-gray-400">Loading...</p>
					</div>
				) : !result ? (
					<div className="text-center py-16">
						<p className="text-gray-500 dark:text-gray-400 mb-4">No quote selected.</p>
						<p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
							Select a quote from the quotes page to see how similar ideas appear across different authors and eras.
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
						<p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
							Tracing how this idea appears across {result.lineage.length} different authors throughout history.
						</p>
						<TimelineView result={result} />
					</>
				)}
			</div>
		</main>
	);
}
