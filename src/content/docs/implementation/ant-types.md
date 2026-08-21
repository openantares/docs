---
title: "ant-types — the record shapes"
description: The Rust vocabulary of the .ant format — Vertex, Edge, Observation, Evidence, Belief, schema declarations, and SQL-fidelity typed property values with an exact Decimal.
---

[`ant-types`](https://crates.io/crates/ant-types) is the record vocabulary of the `.ant` format: everything that can appear inside a `.ant` file, and nothing else. The container that carries these records — compression, manifest, trailer, integrity hashing — is the separate [`antares-format`](../antares-format/) crate.

```sh
cargo add ant-types
```

API reference: [docs.rs/ant-types](https://docs.rs/ant-types).

## One module per record plane

- **`graph`** — [`Vertex`](https://docs.rs/ant-types/latest/ant_types/graph/struct.Vertex.html) and [`Edge`](https://docs.rs/ant-types/latest/ant_types/graph/struct.Edge.html), with typed properties and optional bitemporal validity.
- **`observation`** — append-only, source-bound atomic facts.
- **`evidence`** — the source material observations and edges cite, with span offsets into the source.
- **`belief`** — versioned inferred state derived from observations.
- **`schema`** — OpenSPG-compatible type declarations.
- **`author`** — the provenance stamp records can carry.

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
