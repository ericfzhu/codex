import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider } from '@/context/ThemeContext';
import { SelectionProvider } from '@/context/SelectionContext';

export default function App({ Component, pageProps }: AppProps) {
	return (
		<ThemeProvider>
			<SelectionProvider>
				<Component {...pageProps} />
			</SelectionProvider>
		</ThemeProvider>
	);
}
