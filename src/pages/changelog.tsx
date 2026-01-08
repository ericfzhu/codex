import Head from 'next/head';
import Link from 'next/link';
import { JetBrains_Mono } from 'next/font/google';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

interface ChangeItem {
	title: string;
	description?: string;
}

interface ChangelogEntry {
	version: string;
	date: string;
	changes: ChangeItem[];
}

const changelog: ChangelogEntry[] = [
	{
		version: '0.1.0',
		date: '2025-01-09',
		changes: [
			{
				title: 'Client-side vector search',
				description: 'Replaced server-side Pinecone with in-browser search using Cohere embed-v4 embeddings. All ~5000 quotes are embedded and searched locally using brute-force dot product similarity.',
			},
			{
				title: 'Matrix UI',
				description: 'New grid-based interface showing 12 similar quotes at a time. Hover inverts colors. Long quotes scroll within their cells. The entire interface fits on screen without page scrolling.',
			},
			{
				title: 'Quotes exploration',
				description: 'Navigate through quotes by clicking on similar ones. History breadcrumb tracks your path through the semantic space.',
			},
			{
				title: 'Christianity page',
				description: 'Same matrix interface for exploring Bible verses across King James Bible, Deuterocanonical, and Apocrypha sources.',
			},
			{
				title: 'Idea lineage view',
				description: 'See how a concept appears across different authors throughout history. Quotes are deduplicated by author and sorted chronologically by publication year or era.',
			},
			{
				title: 'Publication year enrichment',
				description: 'Automatically fetched publication years for ~2000 quotes using Open Library (for books) and Wikidata (for author lifespans). Quotes are categorized into eras from Ancient to Contemporary.',
			},
			{
				title: 'Dark mode',
			},
			{
				title: 'Responsive design',
				description: 'Text and padding scale with viewport size. Grid adapts between 3x4 and 4x3 layouts.',
			},
			{
				title: 'Performance optimizations',
				description: 'Embeddings cached in IndexedDB for instant subsequent loads. Preloading starts on homepage. Int8 quantization reduces download size by 75%.',
			},
		],
	},
];

export default function ChangelogPage() {
	return (
		<main className={`min-h-screen bg-accent ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex - Changelog</title>
			</Head>

			<div className="max-w-2xl mx-auto px-4 py-12">
				<div className="flex items-center justify-between mb-12">
					<h1 className="text-2xl font-bold text-white uppercase">Changelog</h1>
					<Link href="/" className="text-white/70 hover:text-white uppercase text-sm">
						Back
					</Link>
				</div>

				<div className="space-y-12">
					{changelog.map((entry) => (
						<div key={entry.version}>
							<div className="flex items-baseline gap-4 mb-4">
								<span className="text-xl font-bold text-white">v{entry.version}</span>
								<span className="text-white/50 text-sm">{entry.date}</span>
							</div>
							<ul className="space-y-4">
								{entry.changes.map((change, index) => (
									<li key={index} className="text-sm">
										<div className="flex gap-3">
											<span className="text-white/40">-</span>
											<div>
												<span className="text-white font-medium">{change.title}</span>
												{change.description && (
													<p className="text-white/60 mt-1">{change.description}</p>
												)}
											</div>
										</div>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>
		</main>
	);
}
