# openantares.org

The public documentation site for the open **`.ant`** interchange format:
the specification, the JSON Schema served at its normative `$id` URL
(`/schema/ant-0.1.schema.json`), the canonical Rust implementation
([ant-types](https://crates.io/crates/ant-types),
[antares-format](https://crates.io/crates/antares-format),
[openantares](https://crates.io/crates/openantares)), the Python and
JavaScript reference bindings, and the conformance suite.

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build).
Content is sourced from the public [openantares/ant](https://github.com/openantares/ant)
and [openantares/openantares](https://github.com/openantares/openantares)
repositories — rendered, not rewritten.

## Develop

```sh
bun install
bun run dev      # local dev server
bun run build    # production build to dist/
bun run preview  # serve the production build
```

## Deploy

GitHub Pages via Actions (`.github/workflows/deploy.yml`): every push and
pull request builds the site and checks the contract paths (schema,
robots.txt, sitemap, llms.txt); pushes to `main` deploy.

`public/schema/ant-0.1.schema.json` must stay byte-for-byte identical to
`schema/ant.schema.json` in `openantares/ant` — it is the document the
schema's `$id` resolves to.

## License

Apache-2.0 — see [LICENSE](LICENSE). The `.ant` specification and
implementations are Apache-2.0 in their own repositories.
