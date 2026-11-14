# Open questions — challenge host / representative inputs

Collected 2026-11-14. Rules (AGENTS): unknown values are gaps, not invitations
to fabricate. Until a question below is answered, the demo runs the labelled
default from `docs/contracts.md` §4.6 and says so in the UI. Semantic questions
about the fill data itself live in `docs/data_profile.md` §13.

## Answered by the challenge representative (14 Nov 2026) — source: verbal

| topic | answer | status in code |
|---|---|---|
| vehicles per material | one vehicle type serves all materials, collected separated | [representative] — per-material compartments implemented; compartment **sizes** still assumed |
| container size | 3 m³ (3,000 L) | [representative] — `container_volume_litres` default |
| truck cost | 500 EUR/day, 5 days/week, 200 days/year; parametrised | [representative] — cost parameters, derived daily/annual figures |
| driver shift | 8 h | [representative] — `max_shift_minutes` 480 |
| emptying time | 5 min | [representative] — stop service time; per-container reading (see Q5) |
| driving time between containers | 10 min | [representative] — `fixed_per_leg` travel-time mode (see Q4) |
| reporting wish | average days-to-full per container | [predicted] — `GET /api/days-to-full` (contracts §5.2.3) |

## Still open

| # | question | current labelled default |
|---|---|---|
| Q1 | Truck capacity: volume (L), weight (kg), and how many vehicles exist? | `demo_truck` 12,000 L / 10,000 kg × 3 [demo assumption] |
| Q2 | Waste density per material (kg/L), or measured weights? | 0.5 kg/L uniform [demo assumption] |
| Q3 | Compartment layout on the truck (how many, size per material)? | equal thirds, 4,000 L per material, sum = vehicle volume [demo assumption] |
| Q4 | Is the 10 min driving time flat or an average — and does it cover depot→first, last→depot and disposal legs too? | flat 10 min on **every** leg [representative value + our interpretation] |
| Q5 | Is the 5 min emptying per container or per location (3 igloos = one stop each today)? | per container (= per stop) [representative value + our interpretation] |
| Q6 | Real coordinates of the 449 locations, depot and disposal site(s)? | synthetic SHA-256 geography near Heilbronn; seed/spread knobs for sensitivity only [demo assumption] |
| Q7 | Road-network matrix or measured travel times? | haversine straight-line × 1.4 — never presented as road distance [demo assumption] |
| Q8 | Disposal/yard unload duration? | 30 min per disposal visit [demo assumption] |

## Data-semantics questions (unchanged, see docs/data_profile.md §13)

Notably §13.1 (fill-level meaning/emptying semantics), §13.2/§13.3 (overfull
token semantics), §13.6 (timezone), §13.8 (no capacity/volume fields in data).
