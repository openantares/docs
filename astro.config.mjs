// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

const SITE = 'https://openantares.org';
// Pre-DNS phase: the site is served at openantares.github.io/docs.
// BASE flips to '/' when the openantares.org custom domain goes live.
const BASE = '/docs';
// Site-wide default social card; pages can override it by declaring their
// own og:image/twitter:image tags in `head` frontmatter.
const OG_IMAGE = `${SITE}${BASE === '/' ? '' : BASE}/og-default.png`;

export default defineConfig({
	site: SITE,
	base: BASE,
	integrations: [
		starlight({
			title: 'OpenAntares',
			description:
				'The open .ant interchange format for knowledge graphs: specification, JSON Schema, canonical Rust implementation, CLI, reference bindings, and conformance suite.',
			logo: {
				light: './src/assets/brand/openantares-wordmark-black.png',
				dark: './src/assets/brand/openantares-wordmark-white.png',
				replacesTitle: true,
				alt: 'OpenAntares',
			},
			customCss: ['./src/styles/brand.css'],
			components: {
				Footer: './src/components/Footer.astro',
			},
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: OG_IMAGE },
				},
				{
					tag: 'meta',
					attrs: { name: 'twitter:image', content: OG_IMAGE },
				},
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/openantares' },
			],
			sidebar: [
				{
					label: 'Implementation',
					items: ['implementation/ant-types', 'implementation/antares-format'],
				},
				'cli',
				{
					label: 'Format',
					items: ['format/spec', 'format/schema', 'format/parsers', 'format/conformance'],
				},
				'versioning',
			],
			plugins: [
				starlightLlmsTxt({
					projectName: 'OpenAntares (.ant format)',
					description:
						'.ant is an open, integrity-checked, streamable container format for exchanging knowledge graphs. These docs cover the normative specification, the JSON Schema, the canonical Rust implementation (ant-types, antares-format, the openantares CLI), the Python and JavaScript reference bindings, and the conformance suite.',
					promote: ['index*', 'format/spec', 'format/schema', 'implementation/*', 'cli'],
				}),
			],
		}),
	],
});
