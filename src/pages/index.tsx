import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { Pinecone } from '@pinecone-database/pinecone';
import GridItem from '@/components/GridItem';
import { Metadata } from '@/types';
import { JetBrains_Mono } from 'next/font/google';
import { GetServerSideProps } from 'next';
import Link from 'next/link';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

export const runtime = 'experimental-edge';

export const getServerSideProps: GetServerSideProps = async (context) => {
	const pinecone = new Pinecone({
		apiKey: process.env.PINECONE_API_KEY!,
	});
	const index = pinecone.index('codex');
	const id = context.query.id ? context.query.id.toString() : Math.floor(Math.random() * 4900).toString();
	const queryResponse = await index.query({
		id: id,
		topK: 1,
		includeMetadata: true,
		includeValues: true,
	});

	const response = queryResponse.matches[0];
	const vectorData = response.values;
	const secondQueryResponse = await index.query({
		vector: vectorData,
		topK: 15,
		includeMetadata: true,
	});
	let secondResponse = secondQueryResponse.matches;
	const metadata = response.metadata;

	const uniqueQuotes = new Set();
	secondResponse = secondResponse
		.filter((match) => {
			if (match.metadata!.quote !== metadata!.quote && !uniqueQuotes.has(match.metadata!.quote)) {
				uniqueQuotes.add(match.metadata!.quote);
				return true;
			}
			return false;
		})
		.slice(0, 9);

	return {
		props: {
			quote: metadata,
			neighbors: secondResponse.map((match) => ({ metadata: match.metadata, score: match.score, id: match.id })),
		},
	};
};

function shuffleArray(array: string[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export default function IndexPage({ quote, neighbors }: { quote: Metadata; neighbors: { metadata: Metadata; score: number; id: number }[] }) {
	const initialElements = ['quote', ...neighbors.map((n, index) => `neighbor-${index}`), 'cloud', 'links'];
	const colors = [
		{
			bg: 'bg-[#7070FF]',
			hoverbg: 'hover:bg-[#7070FF]',
			border: 'border-[#C5C5FF]',
		},
		{
			bg: 'bg-[#8BDB50]',
			hoverbg: 'hover:bg-[#8BDB50]',
			border: 'border-[#E1FBBB]',
		},
		{
			bg: 'bg-[#EE6A20]',
			hoverbg: 'hover:bg-[#EE6A20]',
			border: 'border-[#FDD5A5]',
		},
		{
			bg: 'bg-[#70A3F2]',
			hoverbg: 'hover:bg-[#70A3F2]',
			border: 'border-[#ADC8FF]',
		},
	];
	const randomColor = colors[Math.floor(Math.random() * colors.length)];
	const [elementsOrder, setElementsOrder] = useState(initialElements);

	return (
		<main className="bg-white h-screen overflow-hidden">
			<Head>
				<title>Codex</title>
				<meta property={'og:title'} content={'Codex'} key="title" />
				<meta name="viewport" content="width=device-width" key="title" />
				<link rel="icon" href="/favicon.jpg" />

				<meta property="og:url" content="http://codex.ericfzhu.com/" />
				<meta property="og:type" content="website" />
				<meta name="twitter:card" content="summary_large_image" />
				<meta property="twitter:domain" content="codex.ericfzhu.com" />
				<meta property="twitter:url" content="http://codex.ericfzhu.com/" />
				<meta name="twitter:title" content={'Codex'} />
			</Head>

			<div
				className={`grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 max-h-fit h-screen overflow-scroll md:overflow-hidden ${jetBrainsMono.className}`}>
				{elementsOrder.map((element) => {
					if (element === 'quote') {
						return (
							<div className={`flex flex-col p-2 md:p-5 ${randomColor.bg} text-white h-[100%] text-sm`} key={element}>
								<p className={`text-left whitespace-pre-line flex-grow overflow-auto`}>{quote.quote}</p>
								<div className="flex w-full justify-end pt-2">
									<div className="text-right">
										{quote.author && <p>{quote.author}</p>}
										{quote.book_title && <i>{quote.book_title}</i>}
									</div>
								</div>
							</div>
						);
					} else if (element.startsWith('neighbor-')) {
						const index = parseInt(element.split('-')[1]);
						const neighbor = neighbors[index];
						neighbor.metadata.score = neighbor.score;
						return <GridItem id={neighbor.id} metadata={neighbor.metadata} key={element} color={randomColor} />;
					} else if (element === 'links') {
						return (
							<div
								className={`col-span-1 row-span-1 ${randomColor.bg} p-2 md:p-5 text-white flex flex-col gap-3 text-normal md:text-xl h-[100%]`}
								key={element}>
								<Link href="https://ericfzhu.com" target="_blank" className="hover:text-black duration-300">
									Home
								</Link>
								<Link href="https://github.com/ericfzhu/codex" target="_blank" className="hover:text-black duration-300">
									Github
								</Link>
								<Link
									href={'https://github.com/ericfzhu/codex/blob/5660c5c7c42b434fa7f3b0aa89cdc4db35eb814f/public/embeddings.parquet'}
									target="_blank"
									className="hover:text-black duration-300">
									Embeddings
								</Link>
								<Link href={'https://ericfzhu.com/projects'} target="_blank" className="hover:text-black duration-300">
									Projects
								</Link>
								<button
									className="w-full text-left hover:text-black duration-300"
									onClick={() => setElementsOrder(shuffleArray([...elementsOrder]))}>
									Shuffle
								</button>
								<span className="text-sm mt-auto">Click on a tile to see neighbors</span>
							</div>
						);
					} else if (element === 'cloud') {
						return <GridItem id={-1} isLink={true} key={element} color={randomColor} />;
					}
				})}
			</div>
		</main>
	);
}
