export interface DataItem {
	Quote: string;
	Author: string;
	'Book Title': string;
	Embeddings_3D: string; // Assuming this is a string that will be split into [x, y, z]
	Religion?: string; // Optional religion/source field for filtering
}

export interface CloudCollection {
	slug: string;
	label: string;
	colour: string;
}

export interface CloudPoint {
	collection: number;
	itemId: number;
	x: number;
	y: number;
	duplicateCount: number;
	neighbours: number[];
}

export interface CloudPointsPayload {
	version: 2;
	algorithm: {
		key: string;
		family: 'pacmap' | 'umap';
		nNeighbors: number;
		minDist: number | null;
		seed: number;
		semanticDimensions: number;
	};
	collections: CloudCollection[];
	columns: string[];
	points: number[][];
}

export interface CloudMetadataPayload {
	version: 2;
	columns: string[];
	items: [text: string, author: string, book: string, source: string, reference: string][];
}

export interface VisualizationProps {
	data: DataItem[];
}

export type Metadata = {
	quote: string;
	author: string;
	book_title: string;
	score?: number;
};
