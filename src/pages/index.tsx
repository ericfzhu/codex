import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { JetBrains_Mono } from 'next/font/google';
import { preloadIndices } from '@/lib/searchClient';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

const destinations = [
	{
		id: 'quotes',
		label: 'Quotes',
		description: 'Writers, thinkers, fragments.',
		href: '/quotes',
		className: 'bg-violet-100 text-violet-950 hover:bg-violet-600 hover:text-white focus-visible:bg-violet-600 focus-visible:text-white',
	},
	{
		id: 'christianity',
		label: 'Christianity',
		description: 'Scripture in conversation.',
		href: '/christianity',
		className: 'bg-amber-50 text-amber-950 hover:bg-amber-600 hover:text-white focus-visible:bg-amber-600 focus-visible:text-white',
	},
	{
		id: 'islam',
		label: 'Islam',
		description: 'The Qur’an through shared ideas.',
		href: '/islam',
		className: 'bg-emerald-50 text-emerald-950 hover:bg-emerald-600 hover:text-white focus-visible:bg-emerald-600 focus-visible:text-white',
	},
	{
		id: 'mormonism',
		label: 'Mormonism',
		description: 'Restoration texts, connected.',
		href: '/mormonism',
		className: 'bg-blue-50 text-blue-950 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white',
	},
	{
		id: 'confucianism',
		label: 'Confucianism',
		description: 'The Analects in relation.',
		href: '/confucianism',
		className: 'bg-red-50 text-red-950 hover:bg-red-600 hover:text-white focus-visible:bg-red-600 focus-visible:text-white',
	},
	{
		id: 'cloud',
		label: 'Memetic Cloud',
		description: 'See the whole field at once.',
		href: '/cloud',
		className: 'bg-indigo-100 text-indigo-950 hover:bg-indigo-600 hover:text-white focus-visible:bg-indigo-600 focus-visible:text-white',
	},
	{
		id: 'changelog',
		label: 'Changelog',
		description: 'Notes from the workshop.',
		href: '/changelog',
		className: 'bg-stone-100 text-stone-950 hover:bg-stone-700 hover:text-white focus-visible:bg-stone-700 focus-visible:text-white',
	},
	{
		id: 'github',
		label: 'GitHub',
		description: 'Read the source.',
		href: 'https://github.com/ericfzhu/codex',
		external: true,
		className: 'bg-zinc-100 text-zinc-950 hover:bg-zinc-800 hover:text-white focus-visible:bg-zinc-800 focus-visible:text-white',
	},
	{
		id: 'works',
		label: 'Other Works',
		description: 'See what else is growing.',
		href: 'https://ericfzhu.com/works',
		external: true,
		className: 'bg-pink-100 text-pink-950 hover:bg-pink-600 hover:text-white focus-visible:bg-pink-600 focus-visible:text-white',
	},
] as const;

type DestinationId = (typeof destinations)[number]['id'];
type HomeTileId = DestinationId | 'shuffle';

const defaultTileOrder: HomeTileId[] = [...destinations.map(({ id }) => id), 'shuffle'];
const desktopOrderClasses = [
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
];

let rememberedHomeOrder: HomeTileId[] | null = null;

function shuffledTileOrder(previous?: HomeTileId[]): HomeTileId[] {
	const next = [...defaultTileOrder];

	for (let index = next.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[next[index], next[swapIndex]] = [next[swapIndex], next[index]];
	}

	if (previous && next.every((tile, index) => tile === previous[index])) {
		next.push(next.shift() as HomeTileId);
	}

	return next;
}

export default function HomePage() {
	const [tileOrder, setTileOrder] = useState<HomeTileId[]>(defaultTileOrder);
	const [isReady, setIsReady] = useState(false);

	useEffect(() => {
		preloadIndices();
	}, []);

	useEffect(() => {
		if (!rememberedHomeOrder) rememberedHomeOrder = shuffledTileOrder();
		setTileOrder(rememberedHomeOrder);
		setIsReady(true);
	}, []);

	const orderByTile = useMemo(() => new Map(tileOrder.map((tile, index) => [tile, desktopOrderClasses[index]])), [tileOrder]);

	const shuffleLayout = () => {
		setTileOrder((current) => {
			const next = shuffledTileOrder(current);
			rememberedHomeOrder = next;
			return next;
		});
	};

	return (
		<main className={`min-h-[100dvh] bg-zinc-950 p-px ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex</title>
				<meta name="description" content="Explore connections between ideas" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.jpg" />
			</Head>

			<section
				aria-label="Codex collections"
				className={`grid min-h-[calc(100dvh-2px)] grid-cols-1 gap-px transition-opacity duration-300 md:grid-cols-2 lg:h-[calc(100dvh-2px)] lg:grid-cols-4 lg:[grid-template-rows:repeat(3,minmax(0,1fr))] ${
					isReady ? 'opacity-100' : 'opacity-0'
				}`}>
				<header className="relative flex min-h-[22rem] flex-col justify-between overflow-hidden bg-accent p-6 text-white md:col-span-2 lg:order-none lg:min-h-0 lg:p-8">
					<div className="flex items-start justify-between gap-6">
						<p className="text-[10px] uppercase tracking-[0.22em] text-white/65">An index of affinities</p>
						<p className="text-[10px] tabular-nums text-white/65">EST. 2024</p>
					</div>

					<div className="relative z-10 max-w-xl">
						<h1 className="text-5xl font-medium uppercase leading-none tracking-[-0.08em] sm:text-7xl lg:text-[clamp(3.5rem,6.5vw,7rem)]">
							Codex
						</h1>
						<p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
							A playful index of ideas. Pick a door; every path opens onto another.
						</p>
					</div>
				</header>

				{destinations.map((destination, index) => (
					<Link
						key={destination.id}
						href={destination.href}
						target={'external' in destination && destination.external ? '_blank' : undefined}
						rel={'external' in destination && destination.external ? 'noreferrer' : undefined}
						className={`group flex min-h-44 flex-col justify-between p-5 outline-none transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.96] lg:min-h-0 lg:p-6 ${destination.className} ${orderByTile.get(destination.id) ?? desktopOrderClasses[index]}`}>
						<div className="flex items-start justify-between gap-4 text-[10px] uppercase tracking-[0.16em] opacity-55">
							<span>{String(index + 1).padStart(2, '0')}</span>
							<span className="transition-transform duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-focus-visible:translate-x-1 group-focus-visible:-translate-y-1">
								{'external' in destination && destination.external ? '↗' : '→'}
							</span>
						</div>
						<div>
							<h2 className="text-xl font-medium uppercase leading-none tracking-[-0.05em] xl:text-2xl">{destination.label}</h2>
							<p className="mt-2 text-xs leading-relaxed opacity-65">{destination.description}</p>
						</div>
					</Link>
				))}

				<button
					type="button"
					onClick={shuffleLayout}
					className={`group flex min-h-44 flex-col justify-between bg-accent p-5 text-left text-white outline-none transition-[background-color,transform] duration-200 ease-out hover:bg-indigo-600 focus-visible:bg-indigo-600 active:scale-[0.96] lg:min-h-0 lg:p-6 ${orderByTile.get('shuffle') ?? 'lg:order-10'}`}>
					<div className="flex items-start justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-white/60">
						<span>10</span>
						<span
							aria-hidden="true"
							className="text-sm transition-transform duration-300 ease-out group-hover:rotate-180 group-focus-visible:rotate-180">
							⤨
						</span>
					</div>
					<div>
						<p className="text-xl font-medium uppercase leading-none tracking-[-0.05em] xl:text-2xl">Shuffle the index</p>
						<p className="mt-2 text-xs leading-relaxed text-white/65">Same doors, another arrangement.</p>
					</div>
				</button>
			</section>
		</main>
	);
}
