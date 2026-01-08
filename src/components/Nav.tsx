import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface NavProps {
	transparent?: boolean;
}

export default function Nav({ transparent = false }: NavProps) {
	const router = useRouter();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const isActive = (path: string) => {
		if (path === '/') return router.pathname === '/';
		return router.pathname.startsWith(path);
	};

	const navItems = [
		{ href: '/', label: 'Explore' },
		{ href: '/cloud', label: 'Cloud' },
		{ href: '/compare', label: 'Compare', disabled: true },
		{ href: '/lineage', label: 'Lineage', disabled: true },
	];

	return (
		<>
			<nav
				className={`fixed top-0 left-0 right-0 z-50 ${
					transparent ? 'bg-transparent' : 'bg-white/90 backdrop-blur-sm border-b border-gray-200'
				}`}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6">
					<div className="flex justify-between items-center h-14">
						{/* Logo */}
						<Link href="/" className="font-bold text-lg tracking-tight hover:opacity-70 transition-opacity">
							Codex
						</Link>

						{/* Desktop Navigation */}
						<div className="hidden md:flex items-center gap-1">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.disabled ? '#' : item.href}
									className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
										item.disabled
											? 'text-gray-300 cursor-not-allowed'
											: isActive(item.href)
												? 'bg-gray-900 text-white'
												: 'text-gray-600 hover:bg-gray-100'
									}`}
									onClick={(e) => item.disabled && e.preventDefault()}>
									{item.label}
								</Link>
							))}
						</div>

						{/* Mobile menu button */}
						<button
							className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label="Toggle menu">
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{mobileMenuOpen ? (
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								) : (
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
								)}
							</svg>
						</button>
					</div>
				</div>
			</nav>

			{/* Mobile menu overlay */}
			{mobileMenuOpen && (
				<div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}>
					<div className="absolute inset-0 bg-black/20" />
					<div
						className="absolute top-14 right-0 w-48 bg-white shadow-lg rounded-bl-lg border-l border-b border-gray-200"
						onClick={(e) => e.stopPropagation()}>
						<div className="py-2">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.disabled ? '#' : item.href}
									className={`block px-4 py-2 text-sm ${
										item.disabled
											? 'text-gray-300 cursor-not-allowed'
											: isActive(item.href)
												? 'bg-gray-100 text-gray-900 font-medium'
												: 'text-gray-600 hover:bg-gray-50'
									}`}
									onClick={(e) => {
										if (item.disabled) {
											e.preventDefault();
										} else {
											setMobileMenuOpen(false);
										}
									}}>
									{item.label}
									{item.disabled && <span className="ml-2 text-xs">(soon)</span>}
								</Link>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Spacer to prevent content from going under nav */}
			{!transparent && <div className="h-14" />}
		</>
	);
}
