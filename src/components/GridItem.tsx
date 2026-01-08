import { Metadata } from '@/types';
import { IconArrowUpRight } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useSelection } from '@/context/SelectionContext';

interface GridItemProps {
	id?: number;
	metadata?: Metadata;
	isLink?: boolean;
	color: {
		bg: string;
		hoverbg: string;
		border: string;
	};
}

function SimilarityBar({ score }: { score: number }) {
	// Normalize score - typical dot product scores range from ~0.5 to ~0.9
	// Map to 0-100% for display
	const normalized = Math.min(100, Math.max(0, (score - 0.4) * 200));

	return (
		<div className="flex items-center gap-2" title={`Similarity: ${(score * 100).toFixed(1)}%`}>
			<div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
				<div
					className="h-full bg-current rounded-full transition-all duration-300"
					style={{ width: `${normalized}%` }}
				/>
			</div>
			<span className="text-xs opacity-70">{(score * 100).toFixed(0)}%</span>
		</div>
	);
}

export default function GridItem({ id, metadata, isLink = false, color }: GridItemProps) {
	const [isHovered, setIsHovered] = useState(false);
	const { isSelected, toggleSelection, selectionMode, setSelectionMode } = useSelection();

	const selected = id !== undefined && id >= 0 && isSelected(id);

	const handleSelect = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (id !== undefined && id >= 0 && metadata) {
			toggleSelection({
				id,
				quote: metadata.quote,
				author: metadata.author,
				book_title: metadata.book_title,
			});
		}
	};

	const handleLongPress = () => {
		if (!selectionMode) {
			setSelectionMode(true);
		}
	};

	return (
		<div
			className={`relative col-span-1 row-span-1 border ${color.border} dark:border-gray-700 duration-300 ${color.hoverbg} hover:text-white dark:text-gray-100 max-h-full h-full min-h-52 ${
				selected ? 'ring-2 ring-accent ring-inset' : ''
			}`}
			onMouseOver={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}>
			{/* Selection checkbox */}
			{metadata && id !== undefined && id >= 0 && (isHovered || selectionMode || selected) && (
				<button
					onClick={handleSelect}
					className={`absolute top-2 left-2 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
						selected
							? 'bg-accent border-accent text-white'
							: 'bg-white/80 dark:bg-gray-800/80 border-gray-300 dark:border-gray-600 hover:border-accent'
					}`}
					title={selected ? 'Remove from comparison' : 'Add to comparison'}>
					{selected && (
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
						</svg>
					)}
				</button>
			)}

			{isLink && (
				<Link href="/cloud" className="flex h-full w-full p-2 md:p-5 justify-between flex-col">
					<p>Memetic cloud</p>
					<div className="w-full h-full relative">
						<Image
							src="/cloud.png"
							alt=""
							width={500}
							height={500}
							className={`p-2 duration-300 ${isHovered ? 'opacity-100' : 'opacity-50'} w-full max-h-[80%]`}
						/>
					</div>
					<div className="flex justify-end items-center pt-2">
						<p>codex/cloud</p>
						<IconArrowUpRight />
					</div>
				</Link>
			)}
			{metadata && (
				<Link href={`/?id=${id}`} className="text-sm p-2 md:p-5 flex flex-col justify-between h-full group">
					<p className="whitespace-normal overflow-scroll flex-grow line-clamp-6 md:line-clamp-none">
						{metadata.quote}
					</p>
					<div className="flex justify-between items-end shrink-0 pt-2 gap-2">
						<div className="text-left shrink-0">
							{metadata.score !== undefined && <SimilarityBar score={metadata.score} />}
						</div>
						<div className="text-right truncate">
							{metadata.author && <p className="truncate">{metadata.author}</p>}
							{metadata.book_title && <i className="truncate block text-xs opacity-70">{metadata.book_title}</i>}
						</div>
					</div>
				</Link>
			)}
		</div>
	);
}
