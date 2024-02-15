import Visualization from '@/components/visualization';

import { GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import React from 'react';
import { DataItem, VisualizationProps } from '@/types';

export default function VisualizePage({ data }: VisualizationProps) {
	return (
		<main>
			<div className="flex flex-col items-center">
				<Visualization data={data} />
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
