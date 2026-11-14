# WasteRouting.AI

Explainable glass-waste collection forecasting and route-optimisation prototype
for the PreZero / City of Heilbronn challenge. See `PLAN.md` for milestones and
`AGENTS.md` for repository rules.

## Stack

- **Backend**: Python (FastAPI, pandas/numpy, scikit-learn, OR-Tools, Pydantic), pytest, ruff, mypy (strict for `src/`).
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, Recharts, Leaflet, Vitest.

## Prerequisites (verified locally)

| Tool | Version used |
|---|---|
| Python | 3.14.8 (3.11–3.14 supported; ortools has no 3.15 wheels yet, see `pyproject.toml`) |
| uv | 0.13.1 |
| Node | v26.13.0 |
| npm | 11.20.0 |

## Backend setup (uv, preferred; uv is installed)

```bash
uv venv --python 3.14          # creates .venv (use --clear to recreate)
uv pip install -e ".[dev]"     # installs runtime + dev dependencies
```

Alternative without uv (Python 3.11–3.14):

```bash
python3.14 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Run

```bash
.venv/bin/uvicorn src.api.main:app --reload   # API on http://127.0.0.1:8000
```

## Frontend setup & run

```bash
cd frontend
npm install        # installs dependencies per package.json / package-lock.json
npm run dev        # Vite dev server, proxies /health and /api/* to 127.0.0.1:8000
```

## Checks (same as CI, see `.github/workflows/ci.yml`)

```bash
.venv/bin/ruff check .   # lint
.venv/bin/mypy src       # strict type check for src/
.venv/bin/pytest         # backend tests
cd frontend && npm run build   # tsc --noEmit + Vite production build
cd frontend && npm test        # Vitest suite
```

## Configuration

Copy `.env.example` to `.env` for app settings (host, port, log level). No API
keys are required for the core demo.

## Data

`data/raw/` holds immutable challenge inputs (git-ignored). Derived data goes to
`data/derived/` (git-ignored) and must be reproducible from code.
