import { Metadata } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { CSSProperties, useState } from 'react';

interface GridItemProps {
	id?: number;
	metadata?: Metadata;
	originalPosition: number;
	shuffledPosition: number;
	isLink?: boolean;
}

export default function GridItem({ id, metadata, originalPosition, shuffledPosition, isLink = false }: GridItemProps) {
	const style: CSSProperties = {
		transform: `translate(${calculateTranslateValue(shuffledPosition, originalPosition)})`,
	};
	const [isHovered, setIsHovered] = useState(false);

	return (
		<div
			className={`relative col-span-1 row-span-1 border border-accent2`}
			style={style}
			onMouseOver={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}>
			<div className="relative z-10 h-full w-full">
				{isLink && (
					<Link href="/cloud" className="block h-full w-full p-5 justify-between flex flex-col text-accent">
						<p>Explore memetic cloud</p>
						<div className="w-full h-full relative">
							<Image
								src="/cloud.png"
								alt=""
								layout="fill"
								objectFit="contain"
								className={`p-2 duration-300 ${isHovered ? 'opacity-100' : 'opacity-50'}`}
							/>
						</div>
						<div className="text-right">codex/cloud</div>
					</Link>
				)}
				{metadata && (
					<Link href={`/?id=${id}`} className="text-sm p-5 flex flex-col justify-between h-full">
						<p className="whitespace-pre-line flex-grow overflow-auto">{metadata.quote}</p>
						<div className="flex justify-between items-end shrink-0 pt-2">
							<div className="text-left">{metadata.score && <p>{metadata.score.toFixed(3)}</p>}</div>
							<div className="text-right">
								{metadata.author && <p>{metadata.author}</p>}
								{metadata.book_title && <i>{metadata.book_title}</i>}
							</div>
						</div>
					</Link>
				)}
			</div>
		</div>
	);
}

function calculateTranslateValue(shuffledPosition: number, originalPosition: number): string {
	// Calculate the X and Y translate values based on the grid's geometry
	// For example, if your grid has 3 columns, you can calculate the X offset as follows:
	const xOffset = ((shuffledPosition % 3) - (originalPosition % 3)) * 100; // Assuming each grid cell is 100% of the grid item's width
	const yOffset = (Math.floor(shuffledPosition / 3) - Math.floor(originalPosition / 3)) * 100; // Assuming each grid cell is 100% of the grid item's height
	return `${xOffset}%, ${yOffset}%`;
}
