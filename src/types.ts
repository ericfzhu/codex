export interface DataItem {
	Quote: string;
	Author: string;
	'Book Title': string;
	Embeddings_3D: string; // Assuming this is a string that will be split into [x, y, z]
}

export interface VisualizationProps {
	data: DataItem[];
}
