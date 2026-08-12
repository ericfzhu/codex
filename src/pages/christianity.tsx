import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadBibleIndex, type VerseMetadata } from '@/lib/searchClient';

const sourceNames: Record<string, string> = {
	KJV: 'KING JAMES BIBLE',
	DEUT: 'DEUTEROCANONICAL',
	APODAT: 'APOCRYPHA',
};

const config: VerseExplorerConfig = {
	title: 'Christianity',
	route: '/christianity',
	loadIndex: loadBibleIndex,
	errorMessage: 'Christianity embeddings not yet available. Please check back later.',
	formatReference: (verse: VerseMetadata) => `${verse.book} ${verse.chapter}:${verse.verse}`,
	formatSource: (source) => sourceNames[source] || source,
	accent: {
		text: 'text-amber-600 dark:text-amber-400',
		hoverText: 'hover:text-amber-600 dark:hover:text-amber-400',
		background: 'bg-amber-600',
		hoverBackground: 'hover:bg-amber-600',
		darkHoverBackground: 'dark:hover:bg-amber-600',
		surface: 'bg-amber-50 dark:bg-amber-950/60',
		surfaceText: 'text-amber-950 dark:text-amber-50',
		separator: 'bg-amber-600 dark:bg-amber-500',
	},
};

export default function ChristianityPage() {
	return <VerseExplorer config={config} />;
}
