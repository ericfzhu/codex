import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface SelectedQuote {
	id: number;
	quote: string;
	author: string;
	book_title: string;
}

interface SelectionContextType {
	selectedQuotes: SelectedQuote[];
	isSelected: (id: number) => boolean;
	toggleSelection: (quote: SelectedQuote) => void;
	addToSelection: (quote: SelectedQuote) => void;
	removeFromSelection: (id: number) => void;
	clearSelection: () => void;
	selectionMode: boolean;
	setSelectionMode: (mode: boolean) => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

const MAX_SELECTION = 4;

export function SelectionProvider({ children }: { children: ReactNode }) {
	const [selectedQuotes, setSelectedQuotes] = useState<SelectedQuote[]>([]);
	const [selectionMode, setSelectionMode] = useState(false);

	const isSelected = useCallback((id: number) => selectedQuotes.some((q) => q.id === id), [selectedQuotes]);

	const addToSelection = useCallback((quote: SelectedQuote) => {
		setSelectedQuotes((prev) => {
			if (prev.length >= MAX_SELECTION) return prev;
			if (prev.some((q) => q.id === quote.id)) return prev;
			return [...prev, quote];
		});
	}, []);

	const removeFromSelection = useCallback((id: number) => {
		setSelectedQuotes((prev) => prev.filter((q) => q.id !== id));
	}, []);

	const toggleSelection = useCallback(
		(quote: SelectedQuote) => {
			if (isSelected(quote.id)) {
				removeFromSelection(quote.id);
			} else {
				addToSelection(quote);
			}
		},
		[isSelected, removeFromSelection, addToSelection]
	);

	const clearSelection = useCallback(() => {
		setSelectedQuotes([]);
		setSelectionMode(false);
	}, []);

	return (
		<SelectionContext.Provider
			value={{
				selectedQuotes,
				isSelected,
				toggleSelection,
				addToSelection,
				removeFromSelection,
				clearSelection,
				selectionMode,
				setSelectionMode,
			}}>
			{children}
		</SelectionContext.Provider>
	);
}

export function useSelection() {
	const context = useContext(SelectionContext);
	// Return default values during SSR or if not in provider
	if (!context) {
		return {
			selectedQuotes: [],
			isSelected: () => false,
			toggleSelection: () => {},
			addToSelection: () => {},
			removeFromSelection: () => {},
			clearSelection: () => {},
			selectionMode: false,
			setSelectionMode: () => {},
		};
	}
	return context;
}
