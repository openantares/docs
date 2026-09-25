---
title: "ant-types — the record shapes"
description: The Rust vocabulary of the .ant format — Vertex, Edge, Observation with event time that may be explicitly unknown, Evidence, Belief, contradiction cases, relationship proposals, elected ontology revisions, stored originals and cleaned-text derivations, schema declarations, and SQL-fidelity typed property values with an exact Decimal.
---

[`ant-types`](https://crates.io/crates/ant-types) is the record vocabulary of the `.ant` format: everything that can appear inside a `.ant` file, and nothing else. The container that carries these records — compression, manifest, trailer, integrity hashing — is the separate [`antares-format`](../antares-format/) crate.

```sh
cargo add ant-types
```

API reference: [docs.rs/ant-types](https://docs.rs/ant-types).

## One module per record plane

- **`graph`** — [`Vertex`](https://docs.rs/ant-types/latest/ant_types/graph/struct.Vertex.html) and [`Edge`](https://docs.rs/ant-types/latest/ant_types/graph/struct.Edge.html), with typed properties and optional bitemporal validity.
- **`observation`** — append-only, source-bound atomic facts, whose two times are an [`EventTime`](https://docs.rs/ant-types/latest/ant_types/event_time/enum.EventTime.html) (see below).
- **`event_time`** — `EventTime`, `TimeBasis` and `UnknownTime`: a time that is either known, optionally with the basis it was drawn from, or explicitly unknown with a reason (format 0.6).
- **`evidence`** — the source material observations and edges cite, with span offsets into the source. A primary evidence may name its stored original ([`SourceBlob`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.SourceBlob.html)), that original's provenance ([`SourceReference`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.SourceReference.html)), and cleaned text may be bound to the exact original it came from ([`Derivation`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.Derivation.html)) (format 1.0; see below).
- **`belief`** — versioned inferred state derived from observations.
- **`contradiction`** — [`ContradictionCase`](https://docs.rs/ant-types/latest/ant_types/contradiction/struct.ContradictionCase.html): immutable revisions comparing two or more exact claim revisions, carrying references (never copies) and three independent states — epistemic, business impact, workflow (format 0.4).
- **`proposal`** — [`RelationshipProposal`](https://docs.rs/ant-types/latest/ant_types/proposal/struct.RelationshipProposal.html): immutable measured proposals about a source, with the run and source manifest, the measurement, the probes, the status, and a reviewer's receipt when promoted (format 0.5).
- **`ontology`** — [`OntologyRevision`](https://docs.rs/ant-types/latest/ant_types/ontology/struct.OntologyRevision.html): an immutable elected semantic manifest with exact vault and head pins, typed definitions, explicit record and revision closure, retained positions, approval binding, publisher identity and its conditional head position (format 0.7).
- **`schema`** — OpenSPG-compatible type declarations.
- **`author`** — the provenance stamp records can carry.
- **`exact_json`** — exact decoding of the two format 1.0 opaque fields, a derivation's `segment.coverage` and a source reference's `source`, so no double is rounded on the way in.

## Vertex and Edge

A vertex is deliberately small — business id, display name, namespace-qualified type label, and typed properties. Tenant and project scoping live in the file's manifest, not on each record:

```rust
pub struct Vertex {
    pub id: VertexId,          // unique within the type, e.g. "deal_1"
    pub name: String,          // human-readable display name
    pub label: TypeName,       // namespace-qualified, e.g. "Antares.Deal"
    pub properties: BTreeMap<String, PropertyValue>,
}
```

An edge is directed and labeled, and can carry bitemporal validity — `valid_from`/`valid_to` for when the fact holds in the real world (`None` meaning "always was" / "still holds"), `observed_at`/`extracted_at` for when it was recorded — plus a confidence in `[0, 1]` and first-class evidence references:

```rust
pub struct Edge {
    pub id: EdgeId,
    pub src: VertexId,
    pub src_type: TypeName,
    pub dst: VertexId,
    pub dst_type: TypeName,
    pub label: String,                        // relation name, e.g. "hasStakeholder"
    pub properties: BTreeMap<String, PropertyValue>,
    pub valid_from: Option<DateTime<Utc>>,    // None = always was
    pub valid_to: Option<DateTime<Utc>>,      // None = still holds
    pub observed_at: Option<DateTime<Utc>>,
    pub extracted_at: Option<DateTime<Utc>>,
    pub confidence: Option<f32>,
    pub evidenced_by: Vec<EvidenceId>,
}
```

`Edge` ships the validity queries (`valid_at`, `valid_between`, `still_holds`) so consumers do not reimplement the interval rules.

## Observation and event time

An observation's `observed_at` and `extracted_at` are not bare instants. Since format 0.6 (crate 0.4.0) each is an `EventTime`:

```rust
pub enum EventTime {
    Known { at: DateTime<Utc>, basis: Option<TimeBasis> },
    Unknown { reason: UnknownTime },
}
```

`TimeBasis` names where a known instant came from (`SourceRecordTime`, `AssertedValidFrom`, `SourceFieldBinding`); `UnknownTime` says why there is none (`NoSourceTime`, `AssertedWithoutDate`, `CurrentStateOnly`, `AmbiguousSourceTime`, `ImplausibleSourceTime`). A genuinely undated original is therefore representable end to end: it is on no timeline, rather than clamped to the epoch or to now. Construct with `EventTime::known(at)`, `known_with(at, basis)` or `unknown(reason)`; read with `at()`, `is_known()` and `is_unknown()`.

The wire form is additive, so the common case is byte-identical to what format 0.5 wrote:

```text
"2026-08-09T10:00:00Z"                                                   Known, no basis
{"known":{"at":"2026-08-09T10:00:00Z","basis":"source_record_time"}}     Known, with its basis
{"unknown":{"reason":"no_source_time"}}                                  explicitly unknown
```

No basis is ever fabricated onto a historical record, and only an observation that carries a basis or an unknown time takes an object form. `Edge`'s own `observed_at` / `extracted_at` remain optional instants.

`Observation` also carries [`ConditionalRevision`](https://docs.rs/ant-types/latest/ant_types/observation/struct.ConditionalRevision.html) helpers (crate 0.4.1): an optimistic-concurrency condition kept inside the observation's `metadata` as a versioned envelope, so it travels through a `.ant` archive unchanged.

## Stored originals (format 1.0)

Since format 1.0 (crate 0.6.0) a primary `Evidence` can name the exact file it was cut from. The record carries a small reference, never the bytes; in a `.ant` file the bytes follow the evidence as `original_chunk` records, and the [container](../antares-format/) reassembles and verifies them:

```rust
pub struct SourceBlob {
    pub asset_id: String,     // [A-Za-z0-9_-]{16,128}; an identifier, never a credential
    pub byte_length: u64,     // exact length; 0 is an empty file
    pub sha256: String,       // the whole original's digest, lowercase hex
    pub media_type: String,   // descriptive only
    pub file_name: String,    // descriptive only
}
```

`Evidence` gains `source_blob: Option<SourceBlob>`, absent on every other record so their bytes do not change. An evidence's original is immutable: a changed file is a new evidence id.

A [`SourceReference`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.SourceReference.html) records where an original came from — a folder, a drive item, a mail message. Any number may bind to one original; they are append-only, bound to the evidence's `SourceBlob` (`binds()`), and carry the provenance itself as opaque JSON in `source` (at most 16 KiB, 64 levels deep).

A [`Derivation`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.Derivation.html) binds cleaned text to the exact original it was normalized from, under the `antares.normalized-text/v1` contract (`NORMALIZED_TEXT_CONTRACT`). It is carried by ordinary blob-free evidence whose `content` is the cleaned text, as `derivation: Option<Box<Derivation>>`: the primary's id and blob binding, the [`Normalizer`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.Normalizer.html) that produced it, a job id, a [`DerivationSegment`](https://docs.rs/ant-types/latest/ant_types/evidence/struct.DerivationSegment.html) slot (index, locator, opaque `coverage` of at most 8 KiB and 64 levels), and the digest and length of the text. Once written, a derivation is never changed or dropped. Each of the three types has a `validate()` that enforces the format's field rules.

## Typed property values

Property values are typed at SQL fidelity via [`PropertyValue`](https://docs.rs/ant-types/latest/ant_types/graph/enum.PropertyValue.html). The legacy scalars stay bare JSON on the wire — `null`, booleans, 64-bit integers, doubles, text, and JSON documents serialize exactly as they always did. The typed additions travel in a tagged envelope, `{"$ant": "<type>", "v": <payload>}`:

| variant | SQL type | wire form |
|---------|----------|-----------|
| `Null`, `Bool`, `Long`, `Float`, `Text`, `Json` | NULL, BOOLEAN, BIGINT, DOUBLE PRECISION, TEXT, JSON/JSONB | bare JSON, unchanged |
| `Decimal` | DECIMAL/NUMERIC | `{"$ant":"decimal","v":"<canonical decimal string>"}` |
| `Date` | DATE | `{"$ant":"date","v":"YYYY-MM-DD"}` |
| `Time` | TIME | `{"$ant":"time","v":"HH:MM:SS[.ffffff]"}` |
| `Timestamp` | TIMESTAMP WITH TIME ZONE | `{"$ant":"timestamp","v":"<RFC 3339, offset preserved>"}` |
| `Uuid` | UUID | `{"$ant":"uuid","v":"<lowercase uuid>"}` |
| `Bytes` | BLOB/BYTEA | `{"$ant":"bytes","v":"<base64>"}` |
| `Int32`, `Int16` | INT, SMALLINT | `{"$ant":"int32","v":n}`, range-checked |
| `Array` | SQL array | `{"$ant":"array","v":[…]}` — elements are themselves typed |

An object is an envelope **only** when it has exactly the two keys `$ant` and `v` and `$ant` names a known type. A plain JSON document that happens to carry a `$ant` field still round-trips as a document.

### Decimal is exact

[`Decimal`](https://docs.rs/ant-types/latest/ant_types/decimal/struct.Decimal.html) is an `i128` of unscaled digits plus a scale — never `f64`. `DECIMAL`/`NUMERIC` columns survive digit for digit, scale included: `12.3400` keeps its four fraction digits, and a 19-significant-digit amount like `12345678901234567.89` round-trips exactly where an IEEE double would silently round it. `Timestamp` likewise preserves its UTC offset verbatim: `+02:00` does not come back as `Z`.

These two rules — decimal as string, offset preserved — are the ones implementations most often get wrong, and both are exercised by the [conformance goldens](../../format/conformance/).
