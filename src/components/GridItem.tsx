import { Metadata } from '@/types';
import { IconArrowUpRight } from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

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

export default function GridItem({ id, metadata, isLink = false, color }: GridItemProps) {
	const [isHovered, setIsHovered] = useState(false);

	return (
		<div
			className={`relative col-span-1 row-span-1 border ${color.border} duration-300 ${color.hoverbg} hover:text-white max-h-full h-full min-h-52`}
			onMouseOver={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}>
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
				<Link href={`/?id=${id}`} className="text-sm p-2 md:p-5 flex flex-col justify-between h-full">
					<p className="whitespace-normal overflow-scroll flex-grow">{metadata.quote}</p>
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
	);
}
