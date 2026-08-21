---
title: "Conformance and reproducibility"
description: The golden .ant files, the three conformance runners (Rust, Python, JavaScript), and the contract a third-party implementation passes to prove itself conformant.
---

Conformance is decided by bytes, not prose: golden `.ant` files produced by the canonical Rust writer, plus one runner per implementation, all in [openantares/ant](https://github.com/openantares/ant/tree/main/conformance). Pass the runners' checks against the goldens as checked in and your reader is conformant.

## The goldens

| file | what it proves |
|------|----------------|
| [`basic.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/basic.ant) | one of everything — and the two rules implementations most often get wrong: `exact_amount` is a 19-digit decimal an IEEE double cannot hold, and `signed_at` carries a `+02:00` offset that must survive the read |
| [`forward_compat.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/forward_compat.ant) | carries a `hologram` record — an unknown kind a reader must skip while still verifying the trailer |
| [`tombstones.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/tombstones.ant) | `vertex_tombstone` / `edge_tombstone` records must surface as records and be counted — a binding that treats them as unknown kinds still verifies the file while dropping every deletion on the floor |
| [`major_version.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/major_version.ant) | **negative.** Declares format v1.0 and is valid in every other respect; a 0.x reader must refuse it for the version and nothing else |
| [`expected.json`](https://github.com/openantares/ant/blob/main/conformance/golden/expected.json) / [`expected_negatives.json`](https://github.com/openantares/ant/blob/main/conformance/golden/expected_negatives.json) | the expected manifest scope, record sequences, counts — and which fixtures must be rejected, with why |

## The three runners

**Rust — canonical.** The [openantares/openantares](https://github.com/openantares/openantares) workspace runs `antares-format`'s conformance target ([`tests/conformance.rs`](https://github.com/openantares/openantares/blob/main/crates/antares-format/tests/conformance.rs)) against these goldens. The flagship repository deliberately keeps no goldens of its own — they live once, published, in `openantares/ant`; its CI checks them out pinned at the format's release tag, and the `ANT_CONFORMANCE_GOLDEN` environment variable points the runner at a checkout. So the canonical writer and the published format cannot drift apart silently.

**Python and JavaScript.** Both runners work against the goldens as checked in, with no other setup:

```sh
# Python reference binding. `pip install zstandard`; `jsonschema` is
# optional and adds per-line validation against the JSON Schema.
python3 conformance/run_conformance.py

# JavaScript reference binding. Node >= 22.15 (native zstd in node:zlib).
node conformance/run_conformance.mjs
```

Both suites pass — run on 2026-08-21 against the published goldens:

```text
$ python3 conformance/run_conformance.py
...
29/29 checks passed

$ node conformance/run_conformance.mjs
...
27/27 checks passed
```

## What a conformant implementation must do

The runners are the executable form of this contract. Every implementation must:

1. read and fully verify the goldens (trailer SHA-256 + counts),
2. report the expected manifest scope, record sequence, and counts (`golden/expected.json`),
3. skip unknown record kinds while still verifying (`forward_compat.ant`),
4. surface tombstones as records and count them (`tombstones.ant`),
5. reject the negative goldens listed in `golden/expected_negatives.json`,
6. read a file whose MINOR is ahead of the reader, and report that it saw a subset — this is the rule most often implemented as `version == "0.2"`, which passes every positive test while being wrong,
7. reject the synthesized negatives: tampered record bytes, missing trailer, chopped compressed stream, data after the trailer, wrong counts, a different MAJOR version, an unparsable version, non-zstd input.

**Proving a third-party implementation** means passing this list against these goldens: port one of the runners (they are small, single-file programs) to drive your reader, or drive it directly from `expected.json` and `expected_negatives.json`.

## Reproducibility

The goldens are written by the canonical Rust writer, and the generator is **deterministic** — fixed ids and timestamps, no clock — so a diff in the golden bytes always means a deliberate format change, never noise. Regenerating them (`cargo run -p antares-format --example gen_conformance` in the flagship workspace) is an upstream act reserved for deliberate format changes; consuming them needs nothing but the runners above.
