// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
	site: 'https://openantares.org',
	// Pre-DNS phase: the site is served at openantares.github.io/docs.
	// This line is removed when the openantares.org custom domain flips on.
	base: '/docs',
	integrations: [
		starlight({
			title: 'OpenAntares',
			description:
				'The open .ant interchange format for knowledge graphs: specification, JSON Schema, canonical Rust implementation, CLI, reference bindings, and conformance suite.',
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
