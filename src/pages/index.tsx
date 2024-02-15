import React from 'react';
import Head from 'next/head';
import { Pinecone } from '@pinecone-database/pinecone';

import { GetStaticProps } from 'next';

export const getStaticProps: GetStaticProps = async () => {
	const pinecone = new Pinecone({
		apiKey: process.env.PINECONE_API_KEY!,
	});
	const index = pinecone.index('codex');
	const id = Math.floor(Math.random() * 4900).toString();
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
			neighbors: secondResponse.map((match) => ({metadata: match.metadata, score: match.score})),
		},
	};
};

type Metadata = {
    quote: string;
    author: string;
    book_title: string;
}



export default function IndexPage({ quote, neighbors }: { quote: Metadata; neighbors: {metadata: Metadata, score: number}[] }) {
	function generateAuthorBookDiv(author: string, book_title: string) {
		return (
			<div className="flex justify-end">
				<p className="mr-2">
					{author}
					{author && book_title && ','}
				</p>
				{book_title && <p className="italic">{book_title}</p>}
			</div>
		);
	}
    
	return (
		<main className='items-center flex flex-col bg-white h-screen overflow-auto'>
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
			<div className="w-full py-5 space-y-5 max-w-3xl">
                <p className={`text-left whitespace-pre-line`}>
                    {quote.quote}
                </p>
                <div className="text-right">
                    {generateAuthorBookDiv(quote.author, quote.book_title)}
                </div>
                <table className="divide-y-2 divide-dotted">
                    <thead>
                        <tr>
                            <th className="text-left w-1/6">Sim</th>
                            <th className="text-left">Quote</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 space-y-2 divide-dotted">
                        {neighbors.filter((neighbor: {metadata: Metadata, score: number}) => neighbor.metadata.quote !== quote.quote).map((neighbor: {metadata: Metadata, score: number}, index: number) => (
                            <tr key={neighbor.metadata.quote} className=''>
                                <td>{neighbor.score.toFixed(2)}</td>
                                <td>
                                    <p className={`whitespace-pre-line ${neighbor.metadata.author ? '' : 'italic'}`}>
                                        {neighbor.metadata.quote}
                                    </p>
                                    <div className="text-right">
                                        {generateAuthorBookDiv(neighbor.metadata.author, neighbor.metadata.book_title)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
		</main>
	);
}
