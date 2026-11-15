# Observed service schedule profile (M17 P0)

Source: `data/raw/glass_fill_levels_anonymized_f.csv` loaded through the canonical loader (`src/data/loader.py`, contracts §1). One row = one emptying record (§1.5), so row counts are visit counts. Every figure is [observed] unless marked otherwise; the only derived transform is `visits_per_year = visits x 365 / span_days` (span inclusive) — a stated formula, **not** a fixed-frequency service claim. Zero-visit calendar days are never counted as service days.

Reproduce: `.venv/bin/python -m src.analytics.schedule`

## 1. Window (observed)

- Span: 2025-10-17 .. 2026-09-30 = **349 days** (inclusive)
- Total visits (emptying records): **11,701**
- Active days (≥1 visit): **229** (65.6% of span)
- Zero-visit days in span: 120 — never treated as service days
- Series (location x material): 1338

## 2. Per-day visits on active days (observed)

| statistic | visits/day |
|---|---|
| p10 | 19.6 |
| median | 51.0 |
| p90 | 78.0 |
| p99 | 120.4 |
| min | 3 |
| max | 127 |
| mean | 51.1 |

Most common per-day visit counts (top 8):

| visits that day | days | share of active days |
|---|---|---|
| 57 | 11 | 4.8% |
| 63 | 11 | 4.8% |
| 51 | 11 | 4.8% |
| 60 | 10 | 4.4% |
| 3 | 10 | 4.4% |
| 48 | 9 | 3.9% |
| 49 | 8 | 3.5% |
| 39 | 7 | 3.1% |

## 3. Per-series visits/year (observed x stated formula)

Distribution of `visits x 365 / 349` over 1338 series:

| statistic | visits/year |
|---|---|
| p10 | 3.14 |
| p25 | 5.23 |
| median | 8.37 |
| p75 | 12.55 |
| p90 | 15.69 |
| min | 1.05 |
| max | 38.70 |

Note: this per-series median (8.37 visits/year ≈ one visit every ~44 days for the typical series) differs from the 28-day median of pooled consecutive-visit gaps (data_profile §14): busy series contribute many short gaps to the pooled figure. Both are [observed], different weights.

| visits/year bucket | series | share |
|---|---|---|
| < 6 | 397 | 29.7% |
| 6 - < 13 | 668 | 49.9% |
| 13 - < 26 | 258 | 19.3% |
| 26 - < 52 | 15 | 1.1% |
| ≥ 52 | 0 | 0.0% |

## 4. Weekday profile (observed; active days only)

calendar_days = occurrences of that weekday in the span;
statistics normalise over active days only — zero-visit days excluded.

| weekday | active days | calendar days | mean visits (active) | median | max | visit share |
|---|---|---|---|---|---|---|
| Mon | 43 | 50 | 45.6 | 45 | 119 | 16.7% |
| Tue | 42 | 50 | 55.1 | 58 | 105 | 19.8% |
| Wed | 44 | 50 | 58.2 | 54 | 127 | 21.9% |
| Thu | 42 | 49 | 52.9 | 51 | 121 | 19.0% |
| Fri | 41 | 50 | 53.1 | 51 | 117 | 18.6% |
| Sat | 11 | 50 | 40.4 | 47 | 60 | 3.8% |
| Sun | 6 | 50 | 3.5 | 3 | 6 | 0.2% |

Interpretation (kept separate from observation): emptying activity concentrates on weekdays; weekend figures describe only the dates that actually carry records — no zero-day imputation is applied.
