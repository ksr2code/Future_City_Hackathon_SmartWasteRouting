# WasteRouting.AI — shared contracts

Status legend: **[observed]** = verified in `data/raw/glass_fill_levels_anonymized_f.csv`
(see `docs/data_profile.md` for the producing commands) · **[predicted]** = model/solver
output · **[demo assumption]** = labelled synthetic value, not from data ·
**[open question]** = unresolved semantics (docs/data_profile.md §13).

This file is the authority for cross-module interfaces. Specialists must read it
before editing. Changes require architect review.

## 1. Canonical fill-level reading (src/data) — v1, agreed for M2

### 1.1 `ReadingRecord` (frozen dataclass, stdlib only)

| field | type | status | notes |
|---|---|---|---|
| `location_id` | `str` | [observed] | UUID-format strings; 449 distinct; no padding [observed] |
| `material_type` | `Literal["brown","green","white"]` | [observed] | exactly these three values exist |
| `date` | `datetime.date` | [observed] | ISO `YYYY-MM-DD`, date-only; timezone-naive [open question §13.6 — do not attach a tz] |
| `fill_level_pct` | `int \| None` | [observed] | deciles 0–100 today; `None` **iff** `is_overfull` is true |
| `is_overfull` | `bool` | [observed] | preserves the literal `"overfull"` token (1,192 rows) as a distinct state |

**Deliberate non-decisions** (blocked on host answers, schema must survive either):
- `overfull` is NOT coerced to 100 [open question §13.2/§13.3].
- Decile quantization is NOT enforced (finer upstream values would be valid).
- No capacity/volume/weight on readings — absent from source [open question §13.8].

### 1.2 Invariants (validation enforces)

- I1 key `(location_id, material_type, date)` unique [observed unique today].
- I2 raw fill value is an integer in `[0,100]` or `"overfull"`; anything else is an error.
- I3 `fill_level_pct is None` exactly when raw value was `"overfull"` (loader transform).

### 1.3 `LoadResult`

```text
LoadResult = {
  dataset: Dataset,            # Dataset.empty() if any errors, by default
  errors:   list[ValidationError],   # rule id, row number, message, offending value
  warnings: list[ValidationWarning],
}
Dataset = {
  readings: list[ReadingRecord],   # source file order preserved (no sorting)
  summary:  { n_rows, n_locations, n_series, date_min, date_max,
              rows_per_material: dict[material, int] },
}
```

Clarifications agreed at M2 review (2026-11-14):
- `row_number` is the 1-based data-row index (header excluded); `0` denotes the
  header row itself (used by R1).
- "empty dataset" means `Dataset.empty()`: zeroed summary, no readings.
- `rows_per_material` always contains all three material keys, zeros included.

### 1.4 Validation rules

| id | rule | level |
|---|---|---|
| R1 | column set/header mismatch (`utf-8-sig` read; BOM expected [observed]) | error |
| R2 | missing/empty field | error |
| R3 | `material_type` outside enum | error |
| R4 | date not strict `%Y-%m-%d` | error |
| R5 | fill value not int-in-range and not `"overfull"` (I2) | error |
| R6 | duplicate key — identical row vs conflicting value both flagged | error |
| R7 | numeric fill not a multiple of 10 | warning [observed all deciles today] |

Policy: invalid rows are reported, never silently dropped or coerced; a dataset
with errors yields `dataset=None`-style empty result plus the full error list.
Raw files are read-only.

## 2. Forecast output (src/forecasting) — v1 draft, agreed for M5

### 2.1 Target definition [grounded in data; constrained by open question §13.1]

Operational question: *what will the fill level of a series
`(location_id, material_type)` be at its next observed reading after the
prediction date?* The dataset records fill only at reading dates
[observed — median gap 28 d], so evaluation happens at observed readings.
At inference/demo time the horizon is a configurable number of days
**[demo assumption — not from brief]**; at evaluation time
`target_date` = next observed reading date [observed].

### 2.2 `ForecastRecord`

| field | type | status |
|---|---|---|
| `location_id`, `material_type` | key | [observed] |
| `as_of_date` | `date` | features may use only readings with `date <= as_of_date` (normative) |
| `target_date` | `date` | next observed reading (eval) or `as_of_date + horizon_days` (inference) |
| `predicted_fill_pct` | `float` in `[0,100]` | clipped; percent units |
| `predicted_state` | `"normal" \| "full" \| "overfull"` | `full` := numeric 100 [observed], `overfull` := token [observed]; states stay distinct (§1.1 non-decision) |
| `method` | `"persistence" \| "rate"` (M5) | more at M6 |
| `horizon_days` | `int` | days as_of → target |

### 2.3 Baselines (M5 — deterministic, no ML)

- **persistence**: numeric = last observed numeric fill ≤ as_of (if the last
  reading was `overfull`, predicted_state = `overfull` and numeric falls back
  to the last numeric fill).
- **rate**: last numeric fill + per-series median daily rate over numeric
  consecutive pairs × `horizon_days`, clipped to `[0,100]`.

### 2.4 Evaluation protocol (normative for M5/M6)

- **Chronological split only** (never random row splits): train `< 2026-05-01`,
  validation `2026-05-01..2026-07-31`, test `>= 2026-08-01`
  [protocol choice for the prototype, not a brief fact].
- Numeric metrics (MAE/RMSE in percentage points) computed **only where the
  observed truth is numeric**; rows whose truth is `overfull` are excluded from
  numeric metrics and covered by state metrics — never coerced.
- State metrics: confusion counts for `full-or-overfull` vs rest at a
  configurable threshold, default 80 % **[demo assumption]**.
- Leakage: no target reading may enter any feature; prediction-time features
  use only data available at `as_of_date`.

## 3. Collection candidates (src/collection) — TBD at M7

Shape (draft): stop list from forecast + configurable thresholds/buffers, each with
a reason string. Thresholds configurable, not constants.

## 4. Route input/output (src/routing) — TBD at M8/M9

Shape (draft): depot, vehicles (volume+weight capacity), stops with coordinates
[sourced externally — none in data, demo assumption until host supplies], travel
matrix with explicit provenance (straight-line ≠ road distance). Output: route
order, totals, load progression, unserved stops + reasons, fleet-size
recommendation, solver status. OR-Tools only.

## 5. API (src/api) — TBD at M10

Only `/health` exists (M0). Endpoints will wrap services defined by contracts 1–4;
no business logic in handlers.
