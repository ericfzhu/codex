import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HistoryItem {
	id: number;
	quote: string;
	author: string;
}

const HISTORY_KEY = 'codex-exploration-history';
const MAX_HISTORY = 10;

export function addToHistory(item: HistoryItem) {
	if (typeof window === 'undefined') return;

	const history = getHistory();

	// Check if this item already exists in history
	const existingIndex = history.findIndex((h) => h.id === item.id);

	if (existingIndex !== -1) {
		// Item exists - truncate history to this point (go back behavior)
		const truncated = history.slice(0, existingIndex + 1);
		localStorage.setItem(HISTORY_KEY, JSON.stringify(truncated));
	} else {
		// New item - add to end and trim to max
		history.push(item);
		if (history.length > MAX_HISTORY) {
			history.shift();
		}
		localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
	}
}

export function getHistory(): HistoryItem[] {
	if (typeof window === 'undefined') return [];

	try {
		const stored = localStorage.getItem(HISTORY_KEY);
		return stored ? JSON.parse(stored) : [];
	} catch {
		return [];
	}
}

export function clearHistory() {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(HISTORY_KEY);
}

interface ExplorationHistoryProps {
	currentId?: number;
	className?: string;
}

export default function ExplorationHistory({ currentId, className = '' }: ExplorationHistoryProps) {
	const [history, setHistory] = useState<HistoryItem[]>([]);

	useEffect(() => {
		setHistory(getHistory());

		// Listen for storage changes (in case other tabs update)
		const handleStorage = () => setHistory(getHistory());
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	}, []);

	// Also refresh when currentId changes
	useEffect(() => {
		setHistory(getHistory());
	}, [currentId]);

	// Show last 5 items as breadcrumbs
	const recentHistory = history.slice(-5);

	return (
		<div className={`flex items-center gap-2 text-sm overflow-x-auto h-6 ${className}`}>
			{history.length === 0 ? (
				<span className="text-gray-300 dark:text-gray-600">No exploration history yet</span>
			) : (
				<>
					<span className="text-gray-400 dark:text-gray-500 shrink-0">History:</span>
					{recentHistory.map((item, index) => (
						<span key={item.id} className="flex items-center shrink-0">
							{index > 0 && <span className="text-gray-300 dark:text-gray-600 mx-1">&rarr;</span>}
							<Link
								href={`/?id=${item.id}`}
								className={`max-w-[120px] truncate hover:underline ${
									item.id === currentId
										? 'font-medium text-gray-900 dark:text-white'
										: 'text-gray-500 dark:text-gray-400'
								}`}
								title={`${item.quote.slice(0, 100)}... - ${item.author}`}>
								{item.author || 'Unknown'}
							</Link>
						</span>
					))}
					<button
						onClick={() => {
							clearHistory();
							setHistory([]);
						}}
						className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ml-2 shrink-0"
						title="Clear history">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</>
			)}
		</div>
	);
}
