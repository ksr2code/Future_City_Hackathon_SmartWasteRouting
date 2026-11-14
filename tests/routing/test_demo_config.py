"""Demo config tests — docs/contracts.md §4.6 v3 defaults (2026-11-14).

Values the challenge representative supplied verbally are **[representative]**
(container 3,000 L, stop service 5 min, shift 480 min, travel mode
fixed_per_leg, fixed 10 min/leg, 500 EUR/truck-day, 5/200 operating days);
everything else is **[demo assumption]**; geography knobs are [demo assumption
knobs]. Coordinates are synthetic demo fixtures near Heilbronn (contract
§4.5), never real locations.
"""

from __future__ import annotations

import math

from src.data.schema import MATERIALS
from src.routing.demo_config import (
    DEMO_AVG_SPEED_KMH,
    DEMO_CONTAINER_VOLUME_LITRES,
    DEMO_COST_PER_TRUCK_DAY_EUR,
    DEMO_DENSITIES_KG_PER_LITRE,
    DEMO_DETOUR_FACTOR,
    DEMO_DISPOSAL_SERVICE_MINUTES,
    DEMO_FIXED_TRAVEL_MINUTES,
    DEMO_GEOGRAPHY_SEED,
    DEMO_GEOGRAPHY_SPREAD_KM,
    DEMO_MAX_SHIFT_MINUTES,
    DEMO_OPERATING_DAYS_PER_WEEK,
    DEMO_OPERATING_DAYS_PER_YEAR,
    DEMO_SOLVER_SOLUTION_LIMIT,
    DEMO_SOLVER_TIME_LIMIT_S,
    DEMO_STOP_SERVICE_MINUTES,
    DEMO_TRAVEL_TIME_MODE,
    DEMO_VEHICLE_COUNT_AVAILABLE,
    DEMO_VEHICLE_ID,
    DEMO_VEHICLE_VOLUME_CAPACITY_LITRES,
    DEMO_VEHICLE_WEIGHT_CAPACITY_KG,
    demo_depot,
    demo_disposal_site,
    demo_routing_config,
    demo_vehicle_type,
)


def test_container_volume_default_is_3000_litres() -> None:
    """3 m3 per container — §4.6 v3 [representative]."""
    assert DEMO_CONTAINER_VOLUME_LITRES == 3000


def test_densities_default_is_05_uniform() -> None:
    """§4.6: 0.5 kg/L uniform for brown/green/white [demo assumption]."""
    assert DEMO_DENSITIES_KG_PER_LITRE == {"brown": 0.5, "green": 0.5, "white": 0.5}
    assert set(DEMO_DENSITIES_KG_PER_LITRE) == set(MATERIALS)


def test_vehicle_defaults_match_contract() -> None:
    """demo_truck: 12,000 L / 10,000 kg, 3 available — §4.6 [demo assumption]."""
    assert DEMO_VEHICLE_ID == "demo_truck"
    assert DEMO_VEHICLE_VOLUME_CAPACITY_LITRES == 12000
    assert DEMO_VEHICLE_WEIGHT_CAPACITY_KG == 10000
    assert DEMO_VEHICLE_COUNT_AVAILABLE == 3


def test_service_and_shift_defaults_match_contract() -> None:
    assert DEMO_STOP_SERVICE_MINUTES == 5  # per container [representative]
    assert DEMO_DISPOSAL_SERVICE_MINUTES == 30  # [demo assumption]
    assert DEMO_MAX_SHIFT_MINUTES == 480  # 8 h [representative]


def test_travel_mode_defaults_match_contract() -> None:
    """§4.6 v3: fixed_per_leg is the default duration mode [representative
    reading of "10 min between containers"]; the fixed 10 minutes apply to
    EVERY leg incl. depot/disposal legs [interpretation — open question]."""
    assert DEMO_TRAVEL_TIME_MODE == "fixed_per_leg"
    assert DEMO_FIXED_TRAVEL_MINUTES == 10


def test_cost_and_operating_days_defaults_match_contract() -> None:
    """§4.6 v3 [representative]: 500 EUR per truck-day, 5 days/week,
    200 days/year — echo/display parameters, never invoiced amounts."""
    assert DEMO_COST_PER_TRUCK_DAY_EUR == 500.0
    assert DEMO_OPERATING_DAYS_PER_WEEK == 5
    assert DEMO_OPERATING_DAYS_PER_YEAR == 200


def test_geography_knob_defaults_reproduce_current_layout() -> None:
    """§4.6 v3 [demo assumption knobs — user decision (1)]: seed 0 = current
    SHA-256 layout (regression-tested in test_geography.py), spread 6.0 km =
    the current 1-6 km band."""
    assert DEMO_GEOGRAPHY_SEED == 0
    assert DEMO_GEOGRAPHY_SPREAD_KM == 6.0


def test_matrix_derivation_defaults_match_contract() -> None:
    assert DEMO_AVG_SPEED_KMH == 30  # urban demo speed, km/h (haversine mode only)
    assert DEMO_DETOUR_FACTOR == 1.4  # haversine -> approx road factor


def test_solver_defaults_match_contract_v2() -> None:
    """§4.6 v2 [demo assumption]: solver_solution_limit 200 is the primary
    (deterministic) stopping criterion; solver_time_limit_s 30.0 is a safety
    cap only (fires => status timeout, run not reproducible — §4.4/§4.7)."""
    assert DEMO_SOLVER_SOLUTION_LIMIT == 200
    assert DEMO_SOLVER_TIME_LIMIT_S == 30.0


def test_demo_depot_is_near_heilbronn_and_labelled_synthetic() -> None:
    depot = demo_depot()
    assert depot.id.startswith("demo_")  # synthetic id, never a real depot
    assert math.isclose(depot.lat, 49.15, abs_tol=0.01)
    assert math.isclose(depot.lon, 9.22, abs_tol=0.01)


def test_demo_disposal_site_is_near_heilbronn_with_30_min_service() -> None:
    site = demo_disposal_site()
    assert site.id.startswith("demo_")
    assert site.service_minutes == DEMO_DISPOSAL_SERVICE_MINUTES == 30
    assert abs(site.lat - 49.15) < 0.1
    assert abs(site.lon - 9.22) < 0.1


def test_demo_vehicle_type_builds_valid_vehicle() -> None:
    vehicle = demo_vehicle_type()
    assert vehicle.id == "demo_truck"
    assert vehicle.volume_capacity_litres == 12000
    assert vehicle.weight_capacity_kg == 10000
    assert vehicle.count_available == 3
    # §4.2 v3: no explicit layout => equal thirds, 12,000/3 = 4,000 L each.
    assert vehicle.compartment_volume_litres is None
    assert vehicle.compartment_capacities() == {
        "brown": 4000,
        "green": 4000,
        "white": 4000,
    }


def test_demo_routing_config_matches_all_defaults() -> None:
    config = demo_routing_config()
    assert config.max_shift_minutes == 480
    assert config.densities_kg_per_litre == {
        "brown": 0.5,
        "green": 0.5,
        "white": 0.5,
    }
    assert config.detour_factor == 1.4
    assert config.avg_speed_kmh == 30
    assert config.solver_solution_limit == 200
    assert config.solver_time_limit_s == 30.0
    assert config.travel_time_mode == "fixed_per_leg"
    assert config.fixed_travel_minutes == 10
    assert config.cost_per_truck_day_eur == 500.0
    assert config.operating_days_per_week == 5
    assert config.operating_days_per_year == 200
    assert config.geography_seed == 0
    assert config.geography_spread_km == 6.0


def test_demo_routing_config_validates_and_covers_materials() -> None:
    """Construction itself must pass RoutingConfig validation and the densities
    dict must key exactly the three observed materials."""
    config = demo_routing_config()
    assert set(config.densities_kg_per_litre) == set(MATERIALS)


def test_factories_return_fresh_instances() -> None:
    """Callers may mutate the returned dicts/lists; factories must never share
    mutable state between calls."""
    first = demo_routing_config()
    second = demo_routing_config()
    assert first is not second
    first.densities_kg_per_litre["brown"] = 99.0
    assert second.densities_kg_per_litre["brown"] == 0.5
