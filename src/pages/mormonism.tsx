import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadMormonIndex, type VerseMetadata } from '@/lib/searchClient';

const config: VerseExplorerConfig = {
	title: 'Mormonism',
	route: '/mormonism',
	loadIndex: loadMormonIndex,
	errorMessage: 'Mormonism embeddings not yet available. Please check back later.',
	formatReference: (verse: VerseMetadata) => `${verse.book} ${verse.chapter}:${verse.verse}`,
	accent: {
		text: 'text-blue-600',
		hoverText: 'hover:text-blue-600',
		background: 'bg-blue-600',
		hoverBackground: 'hover:bg-blue-600',
		darkHoverBackground: 'dark:hover:bg-blue-600',
	},
};

export default function MormonismPage() {
	return <VerseExplorer config={config} />;
}
