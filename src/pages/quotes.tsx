import VerseExplorer, { type VerseExplorerConfig } from '@/components/VerseExplorer';
import { loadQuotesIndex, type QuoteMetadata } from '@/lib/searchClient';

const config: VerseExplorerConfig<QuoteMetadata> = {
	title: 'Quotes',
	route: '/quotes',
	loadIndex: loadQuotesIndex,
	errorMessage: 'Quote embeddings are not available right now. Please try again.',
	emptyMessage: 'No quote selected',
	itemNoun: 'a quote',
	getText: (quote) => quote.quote,
	getSource: (quote) => quote.book_title || 'Unknown work',
	formatReference: (quote) => quote.author || 'Unknown author',
	utilityLink: {
		label: 'lineage',
		href: (id) => `/lineage?id=${id}`,
	},
	accent: {
		text: 'text-violet-700 dark:text-violet-400',
		hoverText: 'hover:text-violet-700 dark:hover:text-violet-400',
		background: 'bg-[#55318F]',
		hoverBackground: 'hover:bg-[#55318F]',
		darkHoverBackground: 'dark:hover:bg-[#55318F]',
		surface: 'bg-violet-50 dark:bg-violet-950/60',
		surfaceText: 'text-violet-950 dark:text-violet-50',
		separator: 'bg-violet-700 dark:bg-violet-500',
	},
};

export default function QuotesPage() {
	return <VerseExplorer config={config} />;
}
