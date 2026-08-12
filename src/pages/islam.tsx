import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadIslamIndex, type VerseMetadata } from '@/lib/searchClient';

const config: VerseExplorerConfig = {
	title: 'Islam',
	route: '/islam',
	loadIndex: loadIslamIndex,
	errorMessage: 'Islam embeddings not yet available. Please check back later.',
	getText: (verse) => verse.text,
	getSource: (verse) => verse.source,
	formatReference: (verse: VerseMetadata) => `${verse.book} ${verse.chapter}:${verse.verse}`,
	accent: {
		text: 'text-emerald-600 dark:text-emerald-400',
		hoverText: 'hover:text-emerald-600 dark:hover:text-emerald-400',
		background: 'bg-emerald-600',
		hoverBackground: 'hover:bg-emerald-600',
		darkHoverBackground: 'dark:hover:bg-emerald-600',
		surface: 'bg-emerald-50 dark:bg-emerald-950/60',
		surfaceText: 'text-emerald-950 dark:text-emerald-50',
		separator: 'bg-emerald-600 dark:bg-emerald-500',
	},
};

export default function IslamPage() {
	return <VerseExplorer config={config} />;
}
