import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadConfucianIndex, type VerseMetadata } from '@/lib/searchClient';

function formatReference(verse: VerseMetadata): string {
	return verse.chapter && verse.verse ? `${verse.book} ${verse.chapter}:${verse.verse}` : `${verse.book} ${verse.verse}`;
}

const config: VerseExplorerConfig = {
	title: 'Confucianism',
	route: '/confucianism',
	loadIndex: loadConfucianIndex,
	errorMessage: 'Confucianism embeddings not yet available. Please check back later.',
	emptyMessage: 'No passage selected',
	getText: (verse) => verse.text,
	getSource: (verse) => verse.source,
	formatReference,
	accent: {
		text: 'text-red-600 dark:text-red-400',
		hoverText: 'hover:text-red-600 dark:hover:text-red-400',
		background: 'bg-red-600',
		hoverBackground: 'hover:bg-red-600',
		darkHoverBackground: 'dark:hover:bg-red-600',
		surface: 'bg-red-50 dark:bg-red-950/60',
		surfaceText: 'text-red-950 dark:text-red-50',
		separator: 'bg-red-600 dark:bg-red-500',
	},
};

export default function ConfucianismPage() {
	return <VerseExplorer config={config} />;
}
