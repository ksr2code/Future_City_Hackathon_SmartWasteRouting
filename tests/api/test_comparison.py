"""GET /api/comparison + POST /api/datasets/demo — docs/contracts.md
§5.1/§5.2.2.

The comparison endpoint runs the real naive + OR-Tools pipeline (~seconds,
GLS wall-clock limit §4.4), so the shape assertions share one module-scoped
run on the synthetic VALID_CSV fixture. Demo-endpoint tests monkeypatch the
single server-side constant path (``services.DEMO_CSV_PATH``) for the
absent-file and invalid-file paths; the success path reads the real CSV.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.api import services
from src.api.main import app
from src.api.state import store
from tests.api.conftest import SMALL_CSV, upload_csv

AS_OF = "2026-09-30"
TARGET_DATE = "2026-10-28"  # as_of + horizon 28
DEMO_SOURCE_NAME = "demo:glass_fill_levels_anonymized_f.csv"

BAD_CSV = (
    "Location_id,material_type,date,fill_level_perc\n"
    "loc-a,brown,2026-01-05,20\n"
    "loc-x,brown,2026-03-01,abc\n"  # R5: neither int-in-range nor overfull
)


@pytest.fixture(scope="module")
def comparison_body() -> dict:
    """One solver-backed GET /api/comparison response for the whole module."""
    store.reset()
    client = TestClient(app)
    upload_csv(client)
    response = client.get("/api/comparison")
    assert response.status_code == 200, response.text
    return response.json()


class TestComparison:
    def test_comparison_404_without_dataset(self, client: TestClient) -> None:
        response = client.get("/api/comparison")
        assert response.status_code == 404
        assert "dataset" in response.json()["detail"].lower()

    def test_fixed_v1_defaults_are_echoed(self, comparison_body: dict) -> None:
        assert comparison_body["as_of_date"] == AS_OF
        assert comparison_body["horizon_days"] == 28
        assert comparison_body["target_date"] == TARGET_DATE
        assert comparison_body["method"] == "persistence"

    def test_naive_scenario_shape(self, comparison_body: dict) -> None:
        naive = comparison_body["naive"]
        assert naive["method"] == "naive_fixed_order"
        assert naive["status"] in {"complete", "incomplete"}
        assert naive["stops_total"] == 5  # all VALID_CSV series, no policy filter
        assert naive["stops_served"] + naive["unserved_count"] == naive["stops_total"]
        assert naive["vehicles_available"] == 3  # §4.6 demo_truck count
        assert naive["vehicles_used"] >= 1
        assert naive["distance_m"] >= 0
        assert naive["duration_min"] >= 0
        assert naive["collected_volume_litres"] > 0
        assert naive["collected_weight_kg"] > 0
        assert naive["recommended_trucks"] >= 1
        assert set(naive["fleet_basis"]) == {"ceil_by_volume", "ceil_by_weight"}
        # The §5.2.2 selection counts belong to the optimised scenario only.
        assert "selected_count" not in naive

    def test_optimised_scenario_shape(self, comparison_body: dict) -> None:
        optimised = comparison_body["optimised"]
        assert optimised["method"] == "ortools"
        assert optimised["status"] in {"optimal", "feasible", "infeasible", "timeout"}
        # At as_of 2026-09-30: 90/80/100 fills selected + overfull-state green;
        # only loc-a white (40) is skipped below threshold 80 (§3.1 default).
        assert optimised["selected_count"] == 4
        assert optimised["skipped_count"] == 1
        assert optimised["stops_total"] == optimised["selected_count"]
        assert optimised["stops_served"] + optimised["unserved_count"] == (optimised["stops_total"])
        assert optimised["vehicles_available"] == 3
        assert set(optimised["fleet_basis"]) == {"ceil_by_volume", "ceil_by_weight"}

    def test_provenance_and_assumption_labels(self, comparison_body: dict) -> None:
        assert comparison_body["distance_provenance"] == "haversine_straight_line_derived"
        assumptions = comparison_body["assumptions"]
        assert assumptions
        assert any("[demo assumption]" in label for label in assumptions)
        assert any("run-to-run" in label for label in assumptions)  # GLS note, §5.2.2
        assert any("lexicographic" in label for label in assumptions)  # naive order


class TestDemoDataset:
    def test_demo_upload_loads_fixed_server_csv(self, client: TestClient) -> None:
        response = client.post("/api/datasets/demo")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["source_name"] == DEMO_SOURCE_NAME  # "demo:" prefix (§5.2.2)
        assert body["n_rows"] == 11_701  # M2 real-CSV pins
        assert body["n_locations"] == 449
        assert body["n_series"] == 1_338
        assert body["n_errors"] == 0
        assert body["errors"] == []
        assert body["fill_stats"]["threshold_pct"] == 80
        summary = client.get("/api/summary")
        assert summary.json()["source_name"] == DEMO_SOURCE_NAME

    def test_demo_upload_replaces_active_dataset(self, client: TestClient) -> None:
        upload_csv(client, content=SMALL_CSV, name="small.csv")
        response = client.post("/api/datasets/demo")
        assert response.status_code == 200, response.text
        summary = client.get("/api/summary")
        assert summary.json()["n_rows"] == 11_701
        assert summary.json()["source_name"] == DEMO_SOURCE_NAME

    def test_demo_absent_file_404_and_dataset_unchanged(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        upload_csv(client, content=SMALL_CSV, name="small.csv")
        missing = tmp_path / "missing" / "demo.csv"
        monkeypatch.setattr(services, "DEMO_CSV_PATH", missing)
        response = client.post("/api/datasets/demo")
        assert response.status_code == 404
        assert "demo dataset" in response.json()["detail"].lower()
        summary = client.get("/api/summary")
        assert summary.json()["n_rows"] == 2  # active dataset untouched
        assert summary.json()["source_name"] == "small.csv"

    def test_demo_invalid_csv_422_full_error_list_and_dataset_unchanged(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> None:
        upload_csv(client, content=SMALL_CSV, name="small.csv")
        invalid = tmp_path / "invalid_demo.csv"
        invalid.write_text(BAD_CSV, encoding="utf-8")
        monkeypatch.setattr(services, "DEMO_CSV_PATH", invalid)
        response = client.post("/api/datasets/demo")
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert len(detail["errors"]) == 1
        assert detail["errors"][0]["rule_id"] == "R5"
        summary = client.get("/api/summary")
        assert summary.json()["n_rows"] == 2  # §5.3: dataset not replaced
        assert summary.json()["source_name"] == "small.csv"
