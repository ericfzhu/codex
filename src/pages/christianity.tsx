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
		text: 'text-amber-600',
		hoverText: 'hover:text-amber-600',
		background: 'bg-amber-600',
		hoverBackground: 'hover:bg-amber-600',
		darkHoverBackground: 'dark:hover:bg-amber-600',
	},
};

export default function ChristianityPage() {
	return <VerseExplorer config={config} />;
}
