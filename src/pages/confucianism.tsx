import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadConfucianIndex, type VerseMetadata } from '@/lib/searchClient';

function formatReference(verse: VerseMetadata): string {
	return verse.chapter && verse.verse
		? `${verse.book} ${verse.chapter}:${verse.verse}`
		: `${verse.book} ${verse.verse}`;
}

const config: VerseExplorerConfig = {
	title: 'Confucianism',
	route: '/confucianism',
	loadIndex: loadConfucianIndex,
	errorMessage: 'Confucianism embeddings not yet available. Please check back later.',
	emptyMessage: 'No passage selected',
	formatReference,
	accent: {
		text: 'text-red-600',
		hoverText: 'hover:text-red-600',
		background: 'bg-red-600',
		hoverBackground: 'hover:bg-red-600',
		darkHoverBackground: 'dark:hover:bg-red-600',
	},
};

export default function ConfucianismPage() {
	return <VerseExplorer config={config} />;
}
