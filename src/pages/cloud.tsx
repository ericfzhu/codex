import Cloud from '@/components/Cloud';
import Link from 'next/link';
import Head from 'next/head';

import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import React from 'react';
import { DataItem, VisualizationProps } from '@/types';

export default function VisualizePage({ data }: VisualizationProps) {
	return (
		<main className="relative">
			<Head>
				<title>Codex - Cloud</title>
			</Head>

			{/* Floating back button */}
			<Link
				href="/"
				className="fixed top-4 left-4 z-50 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg hover:bg-white transition-colors flex items-center gap-2 text-sm font-medium uppercase">
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				Back
			</Link>

			{/* Help text */}
			<div className="fixed bottom-4 left-4 z-50 text-white/60 text-sm">
				<p>Drag to rotate • Scroll to zoom • Hover to see quote</p>
			</div>

			<div className="flex flex-col items-center">
				<Cloud data={data} />
			</div>
		</main>
	);
}

export const getStaticProps: GetStaticProps = async () => {
	const csvFilePath = path.join(process.cwd(), 'public', 'quotes_with_embeddings.csv');
	const csvFile = fs.readFileSync(csvFilePath, 'utf8');
	const parseResult = Papa.parse(csvFile, {
		header: true,
		dynamicTyping: true,
		skipEmptyLines: true,
	});

	return {
		props: {
			data: parseResult.data as DataItem[],
		},
	};
};
