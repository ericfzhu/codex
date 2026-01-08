import Link from 'next/link';
import { useSelection } from '@/context/SelectionContext';

export default function SelectionBar() {
	const { selectedQuotes, clearSelection, selectionMode, setSelectionMode } = useSelection();

	if (!selectionMode && selectedQuotes.length === 0) return null;

	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center gap-4">
			{selectedQuotes.length > 0 ? (
				<>
					<span className="text-sm text-gray-600 dark:text-gray-300">
						{selectedQuotes.length} selected
					</span>
					<Link
						href={`/compare?ids=${selectedQuotes.map((q) => q.id).join(',')}`}
						className="px-3 py-1 bg-accent text-white text-sm rounded-full hover:bg-accent/90 transition-colors">
						Compare
					</Link>
					<button
						onClick={clearSelection}
						className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
						title="Clear selection">
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</>
			) : (
				<>
					<span className="text-sm text-gray-500 dark:text-gray-400">Selection mode</span>
					<button
						onClick={() => setSelectionMode(false)}
						className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
						Cancel
					</button>
				</>
			)}
		</div>
	);
}
