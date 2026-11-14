"""GET /api/days-to-full — docs/contracts.md §5.1/§5.2.3 (v3, M15).

The estimates come from ``src.forecasting.days_to_full.build_days_to_full``
(fill history only; no business logic in the API layer). The hand-computed
pins below walk the §5.2.3 rules on the synthetic VALID_CSV fixture
(``loc-``-prefixed ids, never real data — M4 rule):

- loc-a brown 20→50→90 (14 d steps): positive rates 30/14 and 40/14 pp/day,
  median 2.5 pp/day; last fill 90 ⇒ days_to_full = (100-90)/2.5 = 4.0.
- loc-a green 10 then overfull: the token breaks pairs ⇒ no positive rate,
  but the last reading is overfull ⇒ ``already_full`` wins (§5.2.3
  precedence) with days_to_full = 0.0, rate None, last_fill None.
- loc-a white: single numeric reading ⇒ ``no_numeric_history``.
- loc-b brown 30→80: rate 50/14 ≈ 3.571 pp/day; last 80 ⇒ 20/3.571 = 5.6.
- loc-b white 60→100: numeric 100 is full ⇒ ``already_full``, 0.0.

Stats cover series with a value only: {4.0, 5.6, 0.0, 0.0} ⇒ median 2.0,
mean 2.4, min 0.0, max 5.6.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.api.conftest import upload_csv


def _days_body(client: TestClient) -> dict:
    response = client.get("/api/days-to-full")
    assert response.status_code == 200, response.text
    return response.json()


class TestDaysToFull:
    def test_days_to_full_404_without_dataset(self, client: TestClient) -> None:
        response = client.get("/api/days-to-full")
        assert response.status_code == 404
        assert "dataset" in response.json()["detail"].lower()

    def test_method_and_shape(self, client: TestClient) -> None:
        upload_csv(client)
        body = _days_body(client)
        assert body["method"] == "median_positive_pair_rate"
        assert set(body["stats"]) == {
            "series_total",
            "series_with_estimate",
            "median_days",
            "mean_days",
            "min_days",
            "max_days",
        }
        assert len(body["series"]) == 5  # all VALID_CSV series, exactly once
        keys = [(row["location_id"], row["material_type"]) for row in body["series"]]
        assert keys == sorted(keys)
        assert body["assumptions"]
        assert any("[observed]" in label for label in body["assumptions"])
        assert any("constant fill rate" in label for label in body["assumptions"])

    def test_estimated_series_hand_check(self, client: TestClient) -> None:
        upload_csv(client)
        body = _days_body(client)
        by_key = {(r["location_id"], r["material_type"]): r for r in body["series"]}

        brown_a = by_key[("loc-a", "brown")]
        assert brown_a["last_date"] == "2026-02-02"
        assert brown_a["last_fill_pct"] == 90
        assert brown_a["last_is_overfull"] is False
        assert brown_a["rate_pct_per_day"] == 2.5  # median(30/14, 40/14)
        assert brown_a["days_to_full"] == 4.0  # (100 - 90) / 2.5
        assert brown_a["reason"] is None  # estimate present ⇒ no reason

        brown_b = by_key[("loc-b", "brown")]
        assert brown_b["rate_pct_per_day"] == 50 / 14  # median positive rate, unrounded
        assert brown_b["days_to_full"] == 5.6  # 20 / (50/14), 1 d.p.
        assert brown_b["reason"] is None

    def test_no_data_cases_never_fabricated(self, client: TestClient) -> None:
        upload_csv(client)
        body = _days_body(client)
        by_key = {(r["location_id"], r["material_type"]): r for r in body["series"]}

        # Overfull token: already_full wins over the missing rate (precedence).
        green_a = by_key[("loc-a", "green")]
        assert green_a["last_fill_pct"] is None  # token never coerced (§1.1)
        assert green_a["last_is_overfull"] is True
        assert green_a["rate_pct_per_day"] is None  # token breaks pairs
        assert green_a["days_to_full"] == 0.0  # state fact, not an estimate
        assert green_a["reason"] == "already_full"

        # Numeric 100 is full too.
        white_b = by_key[("loc-b", "white")]
        assert white_b["last_fill_pct"] == 100
        assert white_b["days_to_full"] == 0.0
        assert white_b["reason"] == "already_full"

        # Single reading: no rate possible.
        white_a = by_key[("loc-a", "white")]
        assert white_a["rate_pct_per_day"] is None
        assert white_a["days_to_full"] is None  # never fabricated (§5.2.3)
        assert white_a["reason"] == "no_numeric_history"

    def test_aggregate_stats_cover_estimates_only(self, client: TestClient) -> None:
        upload_csv(client)
        stats = _days_body(client)["stats"]
        assert stats["series_total"] == 5
        assert stats["series_with_estimate"] == 4  # incl. the two already_full 0.0s
        assert stats["min_days"] == 0.0
        assert stats["max_days"] == 5.6
        assert stats["median_days"] == 2.0  # median({4.0, 5.6, 0.0, 0.0})
        assert stats["mean_days"] == 2.4  # (4.0 + 5.6 + 0.0 + 0.0) / 4
