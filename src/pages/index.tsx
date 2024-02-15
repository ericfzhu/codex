import React from 'react';
import Head from 'next/head';
import { Pinecone } from '@pinecone-database/pinecone';
import GridItem from '@/components/GridItem';
import { Metadata } from '@/types';
import { JetBrains_Mono } from 'next/font/google'
import { GetServerSideProps } from 'next';
import Link from 'next/link';

const jetBrainsMono = JetBrains_Mono({
    subsets: ['latin'],
})

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
		topK: 10,
		includeMetadata: true,
	});
	const secondResponse = secondQueryResponse.matches;
	const metadata = response.metadata;
	return {
		props: {
			quote: metadata,
			neighbors: secondResponse.map((match) => ({ metadata: match.metadata, score: match.score, id: match.id })),
		},
	};
};

export default function IndexPage({ quote, neighbors }: { quote: Metadata; neighbors: { metadata: Metadata; score: number; id: number }[] }) {
	return (
		<main className="items-center flex flex-col bg-white h-screen overflow-auto">
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
			<div className={`grid grid-cols-3 lg:grid-cols-4 grid-rows-2 lg:grid-rows-3 max-h-screen h-full overflow-hidden ${jetBrainsMono.className}`}>
				<div className="flex flex-col gap-12 p-5 bg-accent text-white">
					<p className={`text-left whitespace-pre-line flex-grow`}>{quote.quote}</p>
					<div className="flex w-full justify-end pt-2">
						<div>
							{quote.author && <p>{quote.author}</p>}
							{quote.book_title && <i>{quote.book_title}</i>}
						</div>
					</div>
				</div>
				{neighbors
					.filter((neighbor: { metadata: Metadata; score: number }) => neighbor.metadata.quote !== quote.quote)
					.map((neighbor: { metadata: Metadata; score: number; id: number }, index: number) => {
						neighbor.metadata.score = neighbor.score;
						return <GridItem id={neighbor.id} metadata={neighbor.metadata} originalPosition={index + 1} shuffledPosition={index + 1} />;
					})}
				<GridItem id={-1} originalPosition={0} shuffledPosition={0} isLink={true} />

				<div className="col-span-1 row-span-1 bg-accent p-5 text-white flex flex-col gap-3 text-xl">
                    <Link href="ericfzhu.com">Home</Link>
                    <Link href="ericfzhu.com">Github</Link>
                    <Link
                        href={'ericfzhu.com/?windows=works&fs=works'}
                        className="hover:text-accent duration-300"
                    >
                        Works
                    </Link>
                </div>
				{/* <div className="col-span-1 row-span-1 border border-accent2"></div>
				<div className="col-span-1 row-span-1 border border-accent2"></div> */}
			</div>
		</main>
	);
}
