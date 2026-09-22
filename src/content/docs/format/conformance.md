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
| [`contradiction_cases.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/contradiction_cases.ant) | (v0.4) four `contradiction_case` records with the vertices, observations, evidence and belief they reference — a reader must surface the kind rather than skip it, and `expected.json` pins the epistemic and workflow states it reports |
| [`relationship_proposals.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/relationship_proposals.ant) | (v0.5) three `relationship_proposal` records beside the five evidence records they cite — surfaced and counted as `relationshipProposals` in the trailer |
| [`unknown_time.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/unknown_time.ant) | (v0.6) two observations: one whose event time is explicitly unknown (`{"unknown":{"reason":…}}`) beside one whose provenance time carries a basis — a reader must surface both forms, never substitute an instant, and read a bare string as a Known time with no basis |
| [`ontology_revisions.ant`](https://github.com/openantares/ant/blob/main/conformance/golden/ontology_revisions.ant) | (v0.7) one `ontology_revision` record beside the evidence it publishes — the immutable elected semantic manifest. The runners assert its semantic id (`orv1:<manifestSha256>`), target vault, previous ontology head, typed item kinds and the `ontology/v1` / `ontology` conditional position, so an implementation cannot pass by skipping the kind; the fixture also pins the exact record/revision closure and the first-publisher envelope |
| [`expected.json`](https://github.com/openantares/ant/blob/main/conformance/golden/expected.json) / [`expected_negatives.json`](https://github.com/openantares/ant/blob/main/conformance/golden/expected_negatives.json) | the expected manifest scope, record sequences, counts — and which fixtures must be rejected, with why |

## The three runners

**Rust — canonical.** The [openantares/openantares](https://github.com/openantares/openantares) workspace runs `antares-format`'s conformance target ([`tests/conformance.rs`](https://github.com/openantares/openantares/blob/main/crates/antares-format/tests/conformance.rs)) against these goldens. The flagship repository deliberately keeps no goldens of its own — they live once, published, in `openantares/ant`; its CI checks them out pinned at the format's release tag, and the `ANT_CONFORMANCE_GOLDEN` environment variable points the runner at a checkout. So the canonical writer and the published format cannot drift apart silently.

**Python and JavaScript.** Both runners work against the goldens as checked in, with no other setup:

```sh
# Python reference binding. `pip install zstandard jsonschema` — the
# per-line validation against the JSON Schema is a required check, not
# an optional one: a missing `jsonschema` is a failed check.
python3 conformance/run_conformance.py

# JavaScript reference binding. Node >= 22.15 (native zstd in node:zlib).
node conformance/run_conformance.mjs
```

Both suites pass — run on 2026-09-17 against the published goldens at `v0.7.0`:

```text
$ python3 conformance/run_conformance.py
...
89/89 checks passed

$ node conformance/run_conformance.mjs
...
68/68 checks passed
```

## What a conformant implementation must do

The runners are the executable form of this contract. Every implementation must:

1. read and fully verify the goldens (trailer SHA-256 + counts),
2. report the expected manifest scope, record sequence, and counts (`golden/expected.json`),
3. skip unknown record kinds while still verifying (`forward_compat.ant`),
4. surface tombstones as records and count them (`tombstones.ant`),
5. reject the negative goldens listed in `golden/expected_negatives.json`,
6. read a file whose MINOR is ahead of the reader, and report that it saw a subset — this is the rule most often implemented as `version == "0.2"`, which passes every positive test while being wrong,
7. reject the synthesized negatives: tampered record bytes, missing trailer, chopped compressed stream, data after the trailer, wrong counts, a different MAJOR version, an unparsable version, non-zstd input,
8. read `contradiction_cases.ant` (v0.4) and surface every `contradiction_case` record — a binding that skips the kind as unknown still verifies the file, so `expected.json` pins the record sequence and the epistemic and workflow states the binding reports,
9. ignore trailer count keys it does not know — they count kinds it skipped — while defaulting later-version keys it does know to zero.
10. read `ontology_revisions.ant` (v0.7), surface the native `ontology_revision` record, and report its semantic id, target vault, previous head, semantic item kinds and conditional domain/chain — the fixture also pins the exact record/revision closure and the immutable first-publisher envelope.
11. read `relationship_proposals.ant` (v0.5) and surface every `relationship_proposal` record, reporting each one's status and the support it measured (`proposalStatuses`, `proposalMatched`, `proposalNonNull`). The measurement is the point: the golden's quarantined hypothesis matched 0 of 1914 rows, and a binding that skips the kind as unknown still verifies the file while leaving a grader nothing to read.
12. read `unknown_time.ant` (v0.6) and report the **decoded** state of each observation's times, not just the record count. `observed_at` and `extracted_at` are one of three disjoint shapes — a bare RFC 3339 string (known, no basis), `{"known":{"at":…,"basis":…}}`, or `{"unknown":{"reason":…}}` — and `expected.json` pins the observed states, the extracted bases and the unknown reasons. A binding that cannot read the additive form misclassifies these, and one that stands epoch, now or zero in for an unknown time is wrong.

**Proving a third-party implementation** means passing this list against these goldens: port one of the runners (they are small, single-file programs) to drive your reader, or drive it directly from `expected.json` and `expected_negatives.json`.

## Reproducibility

The goldens are written by the canonical Rust writer, and the generator is **deterministic** — fixed ids and timestamps, no clock — so a diff in the golden bytes always means a deliberate format change, never noise. Regenerating them (`cargo run -p antares-format --example gen_conformance` in the flagship workspace) is an upstream act reserved for deliberate format changes; consuming them needs nothing but the runners above.
