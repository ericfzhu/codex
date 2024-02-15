import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			colors: {
				accent: '#84D843',
				accent3: '#84A9FF',
				accent2: '#DFFBB5',
				accent1: '#D6E4FF',
				accent7: '#1939B7',
				accent9: '#091A7A',
				secondary: '#374152',
				secondary4: '#718197',
			},
		},
	},
	plugins: [],
};
export default config;
