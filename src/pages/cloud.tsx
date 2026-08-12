import Cloud from '@/components/Cloud';
import Link from 'next/link';
import Head from 'next/head';

import React, { useState } from 'react';

export default function CloudPage() {
	const [showFilters, setShowFilters] = useState(false);

	return (
		<main className="relative">
			<Head>
				<title>Codex - Cloud</title>
			</Head>

			{/* Top right navigation */}
			<div className="fixed top-4 right-4 z-50 flex items-center gap-4 text-sm">
				<button
					onClick={() => setShowFilters(!showFilters)}
					className="uppercase text-gray-400 hover:text-white transition-colors">
					{showFilters ? 'Hide' : 'Filters'}
				</button>
				<Link
					href="/"
					className="uppercase text-gray-400 hover:text-white transition-colors flex items-center gap-1">
					<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
					Back
				</Link>
			</div>

			{/* Help text */}
			<div className="fixed bottom-4 left-4 z-50 text-white/40 text-[10px] font-mono tracking-wider uppercase">
				<p>DRAG TO PAN • SCROLL TO ZOOM • HOVER FOR QUOTE</p>
			</div>

			<div className="flex flex-col items-center">
				<Cloud showFilters={showFilters} onToggleFilters={() => setShowFilters(!showFilters)} />
			</div>
		</main>
	);
}
