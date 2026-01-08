import Head from 'next/head';
import Link from 'next/link';
import { JetBrains_Mono } from 'next/font/google';

const jetBrainsMono = JetBrains_Mono({
	subsets: ['latin'],
});

export default function HomePage() {
	return (
		<main className={`min-h-screen bg-accent flex items-center justify-center ${jetBrainsMono.className}`}>
			<Head>
				<title>Codex</title>
				<meta name="description" content="Explore connections between ideas" />
				<meta name="viewport" content="width=device-width" />
				<link rel="icon" href="/favicon.jpg" />
			</Head>

			<nav className="flex flex-col items-center gap-6 text-white text-lg uppercase">
				<Link href="/quotes" className="hover:opacity-70 transition-opacity">
					Quotes
				</Link>
				<Link href="/christianity" className="hover:opacity-70 transition-opacity">
					Christianity
				</Link>
				<Link href="/cloud" className="hover:opacity-70 transition-opacity">
					Memetic Cloud
				</Link>
				<Link href="/changelog" className="hover:opacity-70 transition-opacity">
					Changelog
				</Link>
				<Link href="https://github.com/ericfzhu/codex" target="_blank" className="hover:opacity-70 transition-opacity">
					Github
				</Link>
				<Link href="https://ericfzhu.com/projects" target="_blank" className="hover:opacity-70 transition-opacity">
					Other Projects
				</Link>
			</nav>
		</main>
	);
}
