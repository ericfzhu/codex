import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadIslamIndex, type VerseMetadata } from '@/lib/searchClient';

const config: VerseExplorerConfig = {
	title: 'Islam',
	route: '/islam',
	loadIndex: loadIslamIndex,
	errorMessage: 'Islam embeddings not yet available. Please check back later.',
	formatReference: (verse: VerseMetadata) => `${verse.book} ${verse.chapter}:${verse.verse}`,
	accent: {
		text: 'text-emerald-600',
		hoverText: 'hover:text-emerald-600',
		background: 'bg-emerald-600',
		hoverBackground: 'hover:bg-emerald-600',
		darkHoverBackground: 'dark:hover:bg-emerald-600',
	},
};

export default function IslamPage() {
	return <VerseExplorer config={config} />;
}
