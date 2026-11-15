/**
 * Minimal EN/DE translation file (M11+ jury-usability pass; v4 wording flip).
 * Scope per task: Overview + "Today's recommendation" views are translated;
 * other panels keep their generated English insight titles for now. Keys are
 * typed: `de` must implement every `en` key (checked by i18n.test.ts as well).
 *
 * Language rules baked into the strings (docs/contracts.md §1.5/§5.2.2 v4):
 * - every row in the data is an **emptying record** (DE "Leerungsdaten")
 *   [representative-stated] — human strings say so; JSON field names keep the
 *   historical `readings` tokens (no wire rename);
 * - distances are straight-line estimates, never road distance;
 * - demo/synthetic inputs stay visibly labelled; [representative] /
 *   [literature] / [demo assumption] stay distinguishable.
 */

export type Lang = "en" | "de";

const en = {
  "nav.overview": "Overview",
  "nav.data": "Data & upload",
  "nav.containers": "Containers",
  "nav.forecast": "Planning",
  "nav.route": "Route plan",
  "nav.scenarios": "Scenarios & timeline",
  "nav.config": "Configuration",

  "legend.title": "Glass colours",

  "overview.headline":
    "Know which glass containers need emptying — and plan the trucks accordingly",
  "overview.problem":
    "Container glass is often emptied on fixed schedules without knowing how full each container really is. This prototype derives fill-level estimates from real emptying records and proposes feasible, optimised collection routes — every recommendation comes with an explanation.",

  "overview.keynum.readings.title": "Emptying records with full containers",
  "overview.keynum.readings.note":
    "Share of historical emptying records at or above {thr} % fill (threshold: demo assumption) — every record is one emptying event [representative-stated].",
  "overview.keynum.containers.title": "Containers expected to need emptying",
  "overview.keynum.containers.note":
    "Model prediction for {date}: selected by the recommendation below — not a measured fact.",
  "overview.keynum.distance.title": "Planned distance: sweep-all vs optimised",
  "overview.keynum.distance.fixed": "Sweep all stops",
  "overview.keynum.distance.optimised": "Optimised",
  "overview.keynum.distance.savings":
    "Derived saving (total gain ÷ sweep-all distance): {pct}",
  "overview.keynum.daysToFull.title": "Predicted days until containers are full",
  "overview.keynum.daysToFull.note":
    "{n} of {total} container series have an estimate (median of the per-series predictions).",
  "overview.keynum.daysToFull.noData":
    "No days-to-full estimates for this dataset (no usable emptying history).",
  "overview.keynum.daysToFull.method": "Method",
  "overview.keynum.daysToFull.predicted": "prediction from emptying records, not a measurement",

  "overview.tanks.title": "Filling time per material (predicted)",
  "overview.tanks.note":
    "Median predicted days until each container reaches {pct} — derived from emptying records only [predicted], never a measurement. Bar length is relative to the slowest material shown.",
  "overview.tanks.lowerBound":
    "At least — includes censored lower bounds ({pct} of estimates); true filling times may be shorter.",
  "overview.tanks.caveatTitle": "Mandatory caveat (echoed by the API):",

  "scenarios.title": "Planning levers (what-if)",
  "scenarios.subtitle":
    "Move the levers and run the what-if: every run reports cost AND service level together — a cheaper strategy is not automatically better (§6). Defaults come from the configuration, never from this panel.",
  "scenarios.frequencyDays": "Fixed schedule: empty every N days",
  "scenarios.containersPerSeries": "Containers per series (same colour at one site)",
  "scenarios.costPerDay": "Truck cost",
  "scenarios.shift": "Shift length",
  "scenarios.capacity": "Truck volume capacity",
  "scenarios.run": "Run what-if",
  "scenarios.running": "Running…",
  "scenarios.waitingForConfig": "Sliders unlock once the configuration has loaded (defaults come from the API).",
  "scenarios.loading": "Running the what-if",
  "scenarios.error": "Could not run the what-if",
  "scenarios.noDataset":
    "No dataset loaded — the what-if becomes available after loading data.",
  "scenarios.skipped": "{n} series skipped by the replay (no usable rate)",
  "scenarios.timeline.title": "Daily replay (collections per day)",
  "scenarios.timeline.subtitle":
    "Multi-month replay of both strategies over the observed window — [predicted] simulation, not observed behaviour.",
  "scenarios.timeline.basis":
    "Basis: records observed · rates derived · plan simulated (§5.2.5 data_basis).",
  "scenarios.timeline.fixedLegend": "Fixed schedule (status quo)",
  "scenarios.timeline.demandLegend": "Demand-driven (plan)",
  "scenarios.timeline.observedLegend": "Observed visits [observed]",
  "scenarios.timeline.spike": "Max day in the replay: {n} collections.",
  "scenarios.timeline.empty": "Run the what-if above to see the daily replay.",
  "scenarios.timeline.megaDay":
    "Model consequence — read before interpreting spikes: series without pre-window history start at fill 0 on the same day, so their collections synchronise onto a few 'mega-days'. This is a replay-initialisation artefact of the model, not observed behaviour.",
  "scenarios.timeline.calibration":
    "Calibration check (TechDetails): simulated median fill at emptying {sim} % vs observed {obs} % — a large gap means the rate model does not reproduce history.",

  "overview.fleetBudget.title": "Fleet budget — recommended fleet",
  "overview.fleetBudget.perDay": "Cost per operating day",
  "overview.fleetBudget.perYear": "Cost per year",
  "overview.fleetBudget.note":
    "Recommended fleet priced at the configured truck cost — API-derived [predicted], never an invoice amount.",
  "overview.fleetBudget.basis": "[demo assumption — solver input]",

  "config.compartments.hint":
    "Leave all three empty for equal thirds, or fill all three — they must sum to the truck volume.",

  "overview.how.title": "How it works",
  "overview.how.step1": "Upload emptying records (Leerungsdaten)",
  "overview.how.step2": "Forecast how full each container will be",
  "overview.how.step3": "Select containers that need emptying — with a reason",
  "overview.how.step4": "Compute feasible routes and explain every stop",

  "overview.recommendation.title": "Today's recommendation",
  "overview.recommendation.asof": "as of {date} (last emptying-record date)",
  "overview.recommendation.horizon":
    "expected fill in {days} days — prediction, not measurement",
  "overview.recommendation.toEmpty": "{n} containers to empty",
  "overview.recommendation.canWait": "{n} can wait",
  "overview.recommendation.noForecast": "{n} have no forecast",
  "overview.recommendation.examples": "Top examples",
  "overview.recommendation.none":
    "No container is currently predicted at or above the emptying threshold.",
  "overview.recommendation.caption":
    "What this shows: which containers are recommended for the next collection round and why. Why it matters: overfull containers annoy residents — this turns emptying records into an explainable work list.",

  "overview.toggle.title": "Today vs. with our plan",
  "overview.toggle.subtitle":
    "Cost is always shown with its service level — the plan that costs less is not automatically better (§6).",
  "overview.toggle.today": "Modelled {days}-day cycle [demo assumption]",
  // Fail-safe when no config echo is available yet (pre-load / no dataset):
  // number-free, never invents the default 28 (review finding 4).
  "overview.toggle.todayNoDays": "Modelled fixed emptying cycle [demo assumption]",
  "overview.toggle.plan": "Demand-driven, same-day (no spacing)",
  // NOTE: `overview.toggle.plan` is still consumed as the ScenariosPanel
  // naive demand-driven card title (trap narrative — do NOT repurpose it).
  // The TodayPlanToggle button uses `overview.toggle.ourPlan` instead.
  "overview.toggle.ourPlan": "Our plan: demand-driven + day spreading",
  "overview.toggle.costWindow": "over the replayed window",
  "overview.toggle.costYear": "Pro-rated cost per year",
  "overview.toggle.serviceFull": "Simulated emptying events full-or-overfull",
  "overview.toggle.serviceObserved": "Emptying records full-or-overfull [observed]",
  "overview.toggle.overflow": "Container-days above 100 % fill (overflow)",
  "overview.toggle.maxFill": "Max simulated fill",
  "overview.toggle.truckDays": "Truck-days over the window",
  "overview.toggle.stops": "Stops over the window",
  "overview.toggle.simBasis":
    "Basis: simulation based on historical rates, not a prediction of reality.",
  "overview.toggle.anchor":
    "Observed today: {pct} of emptying records full-or-overfull [observed]",
  "overview.toggle.anchorUnavailable":
    "Observed service level unavailable for this run.",
  "overview.toggle.anchorBasis": "Basis: observed emptying records.",
  "overview.toggle.flagCostLessServiceWorse":
    "Warning: the plan costs LESS (delta {delta}) while simulated service is WORSE — cheaper is not automatically better.",
  "overview.toggle.flagCostMoreServiceBetter":
    "Honest tradeoff: the plan costs MORE (delta {delta}) — shown straight; the simulated service improves, which is the point.",
  "overview.toggle.flagCostMoreNoGain":
    "The plan costs MORE (delta {delta}) with NO simulated service gain — shown straight, no improvement to weigh it against.",
  "overview.toggle.flagCostMoreServiceWorse":
    "Warning: the plan costs MORE (delta {delta}) and the simulated service is WORSE — dominated on both cost and service.",
  "overview.toggle.flagCostLessNoServiceChange":
    "The plan costs LESS (delta {delta}) with the simulated service unchanged.",
  "overview.toggle.flagSameCost":
    "Same simulated cost (delta {delta}) — the service line below gives the direction.",
  "overview.toggle.flagCostLessServiceBetter":
    "The plan costs LESS (delta {delta}) while the simulated service improves.",
  "overview.toggle.serviceDelta":
    "Simulated service delta (share full-or-overfull): {delta} — positive = more full-or-overfull emptying events than today's strategy.",
  "overview.toggle.costYearBasis":
    "Strategy per-year figures are pro-rated over {days} operating days [demo assumption].",

  "overview.beforeafter.title": "From sweeping everything to optimised routes",
  "overview.beforeafter.caption":
    "What this shows: four scenarios on the same dataset — the status-quo fixed emptying schedule, an upper-bound sweep over every stop, a sweep over only the recommended stops, and optimised routing. Why it matters: distance per kg collected compares the scenarios fairly (they serve different numbers of stops); raw distances do not. Distances are straight-line estimates, not road kilometres.",
  "overview.compare.step0.title": "Status quo: fixed emptying schedule",
  "overview.compare.step0.short": "Fixed schedule",
  "overview.compare.step1.title": "Upper bound: sweep every stop",
  "overview.compare.step1.short": "Sweep all stops",
  "overview.compare.step2.title": "Selection effect: sweep only the recommended stops",
  "overview.compare.step2.short": "Sweep selected stops",
  "overview.compare.step3.title": "Optimised routes (OR-Tools)",
  "overview.compare.step3.short": "Optimised (OR-Tools)",
  "overview.compare.step3.medianSuffix": "median of {runs} solves",
  "overview.compare.selectionGain": "Selection gain (sweep-all → selection sweep): {gain}",
  "overview.compare.selectionGainNegative":
    "Negative = the selection sweep covered MORE distance than the sweep-all run — selection did not pay off for distance here.",
  "overview.compare.routingGain": "Routing gain (selection sweep → optimised): {gain}",
  "overview.compare.totalGain": "Total distance gain (sweep-all → optimised): {gain}",
  "overview.compare.gainUnavailable":
    "Gain not available for this run — no usable optimised solution to compare against.",
  "overview.compare.perKgNote":
    "Distance per kg collected is the like-for-like comparison across these scenarios (they serve different numbers of stops); raw distances are not comparable. Distances are straight-line estimates, not road kilometres.",
  "overview.compare.savings": "Derived saving share (total gain ÷ sweep-all distance): {pct}",
  "overview.compare.totalGainNegative":
    "Negative = the optimised run covered MORE distance than the sweep-all run — shown straight, not spun.",
  "overview.compare.determinism.identical":
    "Optimised result deterministic: identical distance across {runs} solves ({median}).",
  "overview.compare.determinism.medianOfRuns":
    "Optimised distance varied across {runs} solves (wall-clock solver variance): median {median}, range {min}–{max}. The median is shown above.",
  "col.distance": "Distance",
  "col.distancePerKg": "Distance per kg",
  "col.service": "Service level (beside cost)",
  "col.duration": "Duration",
  "col.trucks": "Trucks needed",
  "col.stopsServed": "Stops served",
  "col.unserved": "Unserved",
  "col.volume": "Volume collected",
  "col.weight": "Weight collected",
  "col.cost": "Cost (trucks in use)",
  "col.rate": "Rate (%-points/day)",
  "col.medianInterval": "Median interval",
  "col.daysToFull": "Days to {pct}",
  "col.daysToFullPlain": "Days to target fill",
  "col.predictedFullDate": "Predicted full date",
  "unit.containers": "containers",
  "unit.vehicles": "vehicles",

  "containers.interval.title": "Per-container filling intervals (predicted)",
  "containers.interval.subtitle":
    "Rates and days-to-target per (location, material) series — derived from the observed emptying records [predicted], never measurements. 'At least' marks censored lower bounds; series without an estimate carry their reason, never a fabricated value.",
  "containers.interval.loading": "Loading per-container intervals",
  "containers.interval.error": "Could not load the per-container intervals",
  "containers.interval.noDataset":
    "No dataset loaded — intervals become available after loading data.",
  "containers.interval.material": "Material",
  "containers.interval.allMaterials": "All materials",
  "containers.interval.onlyLowerBound": "Only lower-bound estimates",
  "containers.interval.onlyWithoutEstimate": "Only without estimate",
  "containers.interval.search": "Location",
  "containers.interval.searchPlaceholder": "Location ID starts with…",
  "containers.interval.showFewer": "Show fewer",
  "containers.interval.showAll": "Show all {n} rows",
  "containers.interval.count": "{shown} shown · {total} after filters · {all} series in the dataset",
  "containers.interval.noMatches": "No series match the current filters.",
  "containers.interval.colLocation": "Location",
  "containers.interval.colMaterial": "Material",
  "containers.interval.atLeast": "at least",
  "containers.interval.atLeastTitle":
    "Censored lower bound: a contributing record was full or overfull — true filling time may be shorter (§1.5).",
  "containers.interval.noEstimate": "no estimate",
  "containers.interval.overdue": "overdue",
  "containers.interval.overdueTitle":
    "The [predicted] full date lies in the past: the rate model assumes no emptying after the last record — treat this container as due for a check.",

  "planning.title": "Which containers will be full soon, and when?",
  "planning.subtitle":
    "What this shows: per-container estimates derived from the emptying records — [predicted], not observed. Why it matters: only containers that likely need service enter the route plan. Method details and the honest evaluation are under Technical details.",
  "planning.basis":
    "Basis: emptying records from the dataset — fill levels between emptyings are a model assumption, not sensor data.",
  "planning.params.asOf": "As-of date (ISO)",
  "planning.params.horizon": "Horizon (days)",
  "planning.params.horizonNote": "default 28 d = observed median reading gap",
  "planning.params.method": "Method",
  "planning.method.persistence": "Last measured level holds (persistence)",
  "planning.method.rate": "Fill-speed trend (rate)",
  "planning.run": "Run planning",
  "planning.running": "Estimating fill levels and selecting candidates",
  "planning.kpi.thresholdTitle": "predicted ≥ {threshold} % by the horizon",
  "planning.kpi.thresholdNote": "policy threshold from the config echo [demo assumption]",
  "planning.kpi.medianTitle": "median days to full",
  "planning.kpi.medianNote": "{n} of {total} series have an estimate [predicted]",
  "planning.kpi.lowerBoundTitle": "estimates are lower bounds only",
  "planning.kpi.lowerBoundNote":
    "these series refill from an assumed level after the last emptying — slower than predicted is possible",
  "planning.kpi.overdueTitle": "predicted full before today",
  "planning.kpi.overdueNote": "the model assumes no emptying after the last record",
  "planning.table.title": "Filling next",
  "planning.table.subtitle":
    "Top {n} series by soonest predicted full date — [predicted] estimates, not observed behaviour.",
  "planning.table.excluded": "{n} series without an estimate are excluded (not enough records or no numeric fill).",
  "planning.table.empty": "No series carries a predicted full date.",
  "planning.table.colSeries": "Series",
  "planning.table.colLastFill": "Last fill",
  "planning.table.colDaysToFull": "Days to full",
  "planning.table.colPredictedDate": "Predicted full",
  "planning.candidates.selected": "Selected",
  "planning.candidates.selectedEmpty": "No containers selected",
  "planning.candidates.skipped": "Skipped",
  "planning.candidates.skippedEmpty": "Nothing skipped",
  "planning.candidates.noSelection": "No selection yet",
  "planning.candidates.noSelectionHint": "Pick as-of date + horizon and run to see predicted candidates.",
  "planning.candidates.selectError": "Candidate selection failed",
  "planning.candidates.insight":
    "{selected} of {total} containers are expected to need emptying by {date} — {skipped} can wait",
  "planning.candidates.panelTitle": "Candidate stops for the route plan",
  "planning.candidates.panelSubtitle":
    "Predicted fill per container and the policy decision with its reason. Predicted fill is a model output [predicted]. Selected vs skipped per policy §3 with reasons.",
  "planning.candidates.batch":
    "Batch {asOf} → target {target} · selected {selected} · skipped {skipped}",
  "planning.candidates.policyEcho":
    "Effective policy (echo): threshold {threshold} % · buffer {buffer} % · overfull always selected: {overfull} — all [demo assumption]",
  "planning.candidates.colPredictedFill": "Predicted fill",
  "planning.candidates.colState": "State",
  "planning.candidates.colReason": "Reason",
  "planning.candidates.colDetail": "Detail",
  "planning.tech.persistence":
    "Last measured level holds (persistence): the predicted fill stays at the last measured level until the horizon — simple and transparent.",
  "planning.tech.rate":
    "Fill-speed trend (rate): the predicted fill grows by the series' median fill speed between emptyings.",
  "planning.tech.evaluation":
    "Evaluation on the real dataset: rate beats persistence — test MAE 20.1 vs 22.8 percentage points [evaluation on real data].",
  "planning.tech.autoNote":
    "The estimates above were fetched automatically with the dataset's last record date, a 28-day horizon and the persistence method.",

  "routing.title": "One collection day, optimised",
  "routing.subtitle":
    "What this shows: the visiting order per truck for the selected day, the load progression along the way, and the feasibility checks behind it. Why it matters: drivers get a feasible, explainable tour. Computed over synthetic demo geography — coordinates, depot, disposal, fleet and travel matrix are [demo assumption]; distances are straight-line derived, not road distance (§4.2/§5.3).",
  "routing.run": "Compute route proposal",
  "routing.running": "Forecasting, selecting and solving",
  "routing.runningHint": "solver time limit bounded",
  "routing.empty": "No route computed yet",
  "routing.emptyHint": "Run with an as-of date to get a labelled demo route proposal.",
  "routing.error": "Route computation failed",
  "routing.dayContext": "Day: as-of {asOf} → forecast target {target} · demo fleet and geography [demo assumption]",
  "routing.link.withPeak":
    "The day-by-day plan lives in Scenarios — our day-spreading schedule visits every container across the year (peak {n} truck(s) per day, [predicted] simulation). This demo optimises the visiting order for the trucks you configure.",
  "routing.link.withoutPeak":
    "The day-by-day plan lives in Scenarios — our day-spreading schedule visits every container across the year. This demo optimises the visiting order for the trucks you configure.",
  "routing.insight":
    "{routes} route(s) serve {served} of {total} selected stops on this day — {deferred} deferred to a later day",
  "routing.degraded":
    "Solver returned {status} — deferred stops are listed below, never hidden (contract §4.4).",
  "routing.deferred.title": "Deferred to a later day ({n})",
  "routing.deferred.explanation":
    "Not visited on this configured day — the fleet or shift limit ran out first (reasons per row). The Scenarios day-spreading plan schedules every container across days, so a deferral here is not a lost stop.",
  "routing.deferred.none": "All selected stops are served on this day.",
  "routing.reason.noInsertion":
    "No truck had free capacity or shift time left for this stop on the configured day.",
  "routing.reason.shift":
    "One visit plus the drive there and back does not fit into a truck's daily shift — the stop cannot be served on any single day with the configured shift.",
  "routing.reason.volume":
    "The container's expected collection volume exceeds the largest truck compartment for its material — no configured truck can take it in one visit.",
  "routing.reason.weight":
    "The container's expected collection weight exceeds the largest truck weight capacity — no configured truck can take it in one visit.",
  "routing.reason.fleetExhausted":
    "All configured trucks reached their shift limit with stops still waiting in the visiting order.",
  "routing.reason.hostedCap":
    "Demo display limit: only the first stops of the selection are routed on the hosted demo — the rest are deferred.",

  "overview.compare.serviceAnchor":
    "{pct} of emptying records full-or-overfull — observed service anchor, shown beside every cost (§6)",
  "overview.compare.serviceAnchorUnavailable":
    "Service level unavailable for this run — cost is shown with the anchor once the API reports it.",
  "overview.compare.flatModeNote":
    "Flat travel-time mode: visiting order cannot change total duration — distance differences are distance-only (no time effect).",

  "overview.calmnote":
    "Please note: locations, vehicles and densities in this prototype are demo assumptions. Distances are straight-line estimates — not real road distances.",

  // §6 v5 (superseded-presentation decision): the story charts live on the
  // Overview page, fed by the live API — labels carry over unchanged.
  "charts.observed.title": "The observed rhythm of emptying records",
  "charts.observed.caption":
    "What this shows: emptying records per day across the observed window. Why it matters: the workload is naturally spiky — a plan must absorb the spikes, not mirror them.",
  "charts.observed.median": "Median per active day: {n}",
  "charts.observed.basis": "Basis: observed emptying records [observed] — active days only.",
  "charts.fill.title": "How fast containers fill",
  "charts.fill.illustration": "Illustration — not data",
  "charts.fill.trigger": "emptying trigger {pct} % [demo assumption]",
  "charts.fill.curveCaption":
    "What this shows: the modelled fill between two emptyings. Why it matters: the same rate that predicts today's recommendation also predicts how far out each container is.",
  "charts.dtf.histogramTitle": "Predicted days to full — distribution",
  "charts.dtf.count": "{n} series with an estimate",
  "charts.dtf.bin": "≤ {n} d",
  "charts.dtf.binMore": "> 365 d",
  "charts.fill.basis":
    "Histogram bars are [predicted] estimates derived from emptying-record rates — see the §1.5 caveat above; the curve is a drawing, not data.",
  "charts.trap.title": "The trap in same-day demand-driven collection",
  "charts.trap.legendDemand": "Demand-driven, same-day (no spacing) [predicted]",
  "charts.trap.caption":
    "What this shows: truck-days per day — the fixed cycle needs few trucks most days but huge peaks; collecting everything the day it is due clusters the work into fewer, overloaded days. Why it matters: day spreading flattens the peaks (the plan card below).",
  "charts.trap.basis": "Simulation based on historical rates, not a prediction of reality — [predicted].",
  "charts.outcomes.title": "Outcomes",
  "charts.outcomes.cost": "−{pct} cost over the window",
  "charts.outcomes.eur": "−{eur} EUR",
  "charts.outcomes.service": "{overflow} simulated overflow · today's anchor {pct} [observed]",
  "charts.outcomes.basis":
    "Derived from the observed baseline and the day_spread plan (§5.2.6) — a model comparison, never a measured saving.",


  "overview.money.title": "The money story: observed operation vs plan",
  "overview.money.caption":
    "Today's operation comes from the observed emptying records; the plan spreads the same collections over more days. Every cost is shown with its service level.",
  "overview.money.observedTitle": "Observed operation",
  "overview.money.observedServiceBasis": "observed emptying records [observed]",
  "overview.money.yearBasis":
    "Per-year bases differ: the observed baseline is scaled to a 365-day year; the strategies are pro-rated over {days} operating days [demo assumption].",
  "overview.money.medianTrucks": "Trucks per active day (median)",
  "overview.money.peakTrucks": "Peak trucks",
  "overview.money.activeDays": "Active days / calendar days",
  "overview.money.typicalTrucks": "Typical trucks per day",
  "overview.money.perYear": "Pro-rated cost per year",
  "overview.money.infeasibleDays": "Capacity-infeasible days (surfaced, not coerced)",
  "overview.money.basisObserved": "[observed × representative time model]",
  "overview.money.planTitle": "Our plan: demand-driven + day spreading",
  "overview.money.basisPlan": "[predicted — simulation on observed rates]",
  "overview.money.saved":
    "≈ {eur} EUR lower over the window (−{pct} cost, derived) — with better service.",
  "overview.money.note":
    "Savings are derived from the two API totals (baseline − plan); the plan is a simulation on observed rates, not a prediction of reality.",

  "scenarios.baseline.title": "Observed operation",
  "scenarios.baseline.medianTrucks": "Trucks per active day (median)",
  "scenarios.baseline.peakTrucks": "Peak trucks",
  "scenarios.baseline.activeDays": "Active days / calendar days",
  "scenarios.baseline.visits": "Emptying records (visits)",
  "scenarios.baseline.infeasibleDays": "Capacity-infeasible days (surfaced, not coerced)",
  "scenarios.baseline.basis": "[observed × representative time model]",
  "scenarios.spreadLabel": "Our plan: demand-driven + day spreading",
  "scenarios.spread.peakTrucks": "Peak trucks per day",
  "scenarios.spread.typicalTrucks": "Typical trucks per day",
  "scenarios.spread.stopsPerTruckDay": "Stops per truck-day",
  "scenarios.spread.deferrals": "Deferred emptyings",
  "scenarios.spread.maxSuffix": "max",

  "demo.button": "Load demo data",
  "demo.loading": "Loading demo data",
  "demo.error": "Could not load demo data",

  "overview.reason.at_or_above_threshold":
    "Predicted at or above the emptying threshold — recommend emptying",
  "overview.reason.overfull_state":
    "Last emptying record was overfull — always recommended",
  "overview.reason.below_threshold": "Still room left — can wait",
  "overview.reason.no_forecast": "No forecast possible — check manually",

  "overview.state.loading": "Loading overview",
  "overview.state.noDataset":
    "No dataset loaded yet — upload a CSV or load the demo data below.",
  "overview.state.summaryError": "Could not load the dataset summary",
  "overview.state.recommendationLoading": "Computing recommendation",
  "overview.state.recommendationError": "Could not compute the recommendation",
  "overview.state.noAsOf": "No last emptying-record date available — recommendation skipped.",
  "overview.state.noFillStats":
    "Fill-level shares are not available for this dataset summary.",
  "overview.state.comparisonLoading": "Computing fixed-vs-optimised comparison",
  "overview.state.comparisonError": "Could not compute the comparison",
  "overview.state.comparisonNoDataset":
    "No dataset loaded — the comparison becomes available after loading data.",
  "overview.state.daysToFullLoading": "Computing days-to-full estimates",
  "overview.state.simulationLoading": "Loading the observed daily rhythm",
  "overview.state.simulationError": "Could not load the daily simulation",
  "overview.state.scenariosLoading": "Computing today-vs-plan comparison",
  "overview.state.scenariosError": "Could not compute the today-vs-plan comparison",
  "overview.state.scenariosNoDataset":
    "No dataset loaded — the today-vs-plan comparison is available after loading data.",
  "overview.tech.assumptions": "Labelled assumptions returned by the API",

  "techdetails.label": "Technical details",

  "legend.brown": "Brown glass",
  "legend.green": "Green glass",
  "legend.white": "White glass",
} as const;

export type TranslationKey = keyof typeof en;

const de: Record<TranslationKey, string> = {
  "nav.overview": "Übersicht",
  "nav.data": "Daten & Upload",
  "nav.containers": "Behälter",
  "nav.forecast": "Planung",
  "nav.route": "Routenplan",
  "nav.scenarios": "Szenarien & Zeitverlauf",
  "nav.config": "Konfiguration",

  "legend.title": "Glasfarben",

  "overview.headline":
    "Wissen, welche Glasbehälter geleert werden müssen — und die Fahrzeuge entsprechend planen",
  "overview.problem":
    "Container-Glas wird oft nach festen Zeitplänen geleert, ohne dass bekannt ist, wie voll jeder Behälter wirklich ist. Dieser Prototyp leitet Füllstand-Schätzungen aus echten Leerungsdaten ab und schlägt machbare, optimierte Sammelrouten vor — jede Empfehlung ist mit einer Begründung versehen.",

  "overview.keynum.readings.title": "Leerungsdaten mit vollem Behälter",
  "overview.keynum.readings.note":
    "Anteil der historischen Leerungsdaten mit Füllstand ≥ {thr} % (Schwelle: Demo-Annahme) — jeder Datensatz ist genau eine Leerung [Angabe des Auftraggebers].",
  "overview.keynum.containers.title": "Behälter, die voraussichtlich zu leeren sind",
  "overview.keynum.containers.note":
    "Modellprognose für {date}: von der Empfehlung unten ausgewählt — kein gemessener Fakt.",
  "overview.keynum.distance.title": "Geplante Strecke: Alles-Sweep vs. optimiert",
  "overview.keynum.distance.fixed": "Alle Stopps abfahren",
  "overview.keynum.distance.optimised": "Optimiert",
  "overview.keynum.distance.savings":
    "Abgeleitete Ersparnis (Gesamtgewinn ÷ Sweep-alle-Stopp-Strecke): {pct}",
  "overview.keynum.daysToFull.title": "Prognostizierte Tage bis volle Behälter",
  "overview.keynum.daysToFull.note":
    "{n} von {total} Behälter-Serien haben eine Schätzung (Median der Einzelschätzungen).",
  "overview.keynum.daysToFull.noData":
    "Keine Tage-bis-voll-Schätzungen für diesen Datensatz (keine verwertbare Leerungs-Historie).",
  "overview.keynum.daysToFull.method": "Methode",
  "overview.keynum.daysToFull.predicted": "Prognose aus Leerungsdaten, keine Messung",

  "overview.tanks.title": "Füllzeit pro Material (Prognose)",
  "overview.tanks.note":
    "Median der prognostizierten Tage, bis jeder Behälter {pct} erreicht — abgeleitet nur aus Leerungsdaten [Prognose], nie eine Messung. Balkenlänge relativ zum langsamsten gezeigten Material.",
  "overview.tanks.lowerBound":
    "Mindestens — enthält zensierte Untergrenzen ({pct} der Schätzungen); die tatsächlichen Füllzeiten können kürzer sein.",
  "overview.tanks.caveatTitle": "Pflicht-Hinweis (von der API zurückgegeben):",

  "scenarios.title": "Planungs-Hebel (Was-wäre-wenn)",
  "scenarios.subtitle":
    "Hebel bewegen und Was-wäre-wenn rechnen: jeder Lauf zeigt Kosten UND Serviceniveau zusammen — billiger heißt nicht automatisch besser (§6). Vorgaben kommen aus der Konfiguration, nie aus dieser Ansicht.",
  "scenarios.frequencyDays": "Fester Plan: alle N Tage leeren",
  "scenarios.containersPerSeries": "Behälter pro Serie (gleiche Farbe an einem Standort)",
  "scenarios.costPerDay": "Fahrzeugkosten",
  "scenarios.shift": "Schichtlänge",
  "scenarios.capacity": "Fahrzeug-Volumenkapazität",
  "scenarios.run": "Was-wäre-wenn berechnen",
  "scenarios.running": "Läuft…",
  "scenarios.waitingForConfig": "Regler werden freigeschaltet, sobald die Konfiguration geladen ist (Vorgaben aus der API).",
  "scenarios.loading": "Was-wäre-wenn wird berechnet",
  "scenarios.error": "Was-wäre-wenn konnte nicht berechnet werden",
  "scenarios.noDataset":
    "Keine Daten geladen — das Was-wäre-wenn ist nach dem Laden verfügbar.",
  "scenarios.skipped": "{n} Serien von der Wiederholung ausgeschlossen (keine verwertbare Rate)",
  "scenarios.timeline.title": "Tägliche Wiederholung (Leerungen pro Tag)",
  "scenarios.timeline.subtitle":
    "Mehrmonatige Wiederholung beider Strategien über das beobachtete Fenster — [Prognose]-Simulation, kein beobachtetes Verhalten.",
  "scenarios.timeline.basis":
    "Basis: Daten beobachtet · Raten abgeleitet · Plan simuliert (§5.2.5 data_basis).",
  "scenarios.timeline.fixedLegend": "Fester Plan (Status quo)",
  "scenarios.timeline.demandLegend": "Bedarfsorientiert (Plan)",
  "scenarios.timeline.observedLegend": "Beobachtete Besuche [beobachtet]",
  "scenarios.timeline.spike": "Stärkster Tag der Wiederholung: {n} Leerungen.",
  "scenarios.timeline.empty": "Oben das Was-wäre-wenn rechnen, um den Tagesverlauf zu sehen.",
  "scenarios.timeline.megaDay":
    "Modell-Konsequenz — vor der Interpretation von Spitzen lesen: Serien ohne Vorgeschichte vor dem Fenster starten mit Füllstand 0 am selben Tag, ihre Leerungen synchronisieren sich darum auf wenige „Mega-Tage“. Das ist ein Artefakt der Replay-Initialisierung des Modells, kein beobachtetes Verhalten.",
  "scenarios.timeline.calibration":
    "Kalibrierungs-Check (Technische Details): simulierter Median-Füllstand bei Leerung {sim} % vs. beobachtet {obs} % — eine große Lücke bedeutet, dass das Ratenmodell die Historie nicht reproduziert.",

  "overview.fleetBudget.title": "Flotten-Budget — empfohlene Flotte",
  "overview.fleetBudget.perDay": "Kosten pro Betriebstag",
  "overview.fleetBudget.perYear": "Kosten pro Jahr",
  "overview.fleetBudget.note":
    "Empfohlene Flotte zum konfigurierten Fahrzeugsatz — von der API abgeleitet [Prognose], nie ein Rechnungsbetrag.",
  "overview.fleetBudget.basis": "[Demo-Annahme — Solver-Eingabe]",

  "config.compartments.hint":
    "Alle drei leer lassen (gleiche Drittel) oder alle drei ausfüllen — die Summe muss dem Fahrzeuggesamtvolumen entsprechen.",

  "overview.how.title": "So funktioniert es",
  "overview.how.step1": "Leerungsdaten hochladen",
  "overview.how.step2": "Prognostizieren, wie voll jeder Behälter sein wird",
  "overview.how.step3": "Zu leerende Behälter auswählen — mit Begründung",
  "overview.how.step4": "Machbare Routen berechnen und jeden Stopp erklären",

  "overview.recommendation.title": "Empfehlung für heute",
  "overview.recommendation.asof": "Stand: {date} (Datum des letzten Leerungsdatensatzes)",
  "overview.recommendation.horizon":
    "erwarteter Füllstand in {days} Tagen — Prognose, nicht Messung",
  "overview.recommendation.toEmpty": "{n} Behälter leeren",
  "overview.recommendation.canWait": "{n} kann warten",
  "overview.recommendation.noForecast": "{n} ohne Prognose",
  "overview.recommendation.examples": "Top-Beispiele",
  "overview.recommendation.none":
    "Aktuell ist kein Behälter voraussichtlich auf oder über der Leeren-Schwelle.",
  "overview.recommendation.caption":
    "Was das zeigt: welche Behälter für die nächste Sammelrunde empfohlen werden und warum. Warum das zählt: übervolle Behälter ärgern Anwohner — daraus wird eine begründete Arbeitsliste.",

  "overview.toggle.title": "Heute vs. mit unserem Plan",
  "overview.toggle.subtitle":
    "Kosten werden immer zusammen mit dem Serviceniveau gezeigt — billiger heißt nicht automatisch besser (§6).",
  "overview.toggle.today": "Modellierter {days}-Tage-Zyklus [Demo-Annahme]",
  "overview.toggle.todayNoDays": "Modellierter fester Leerungszyklus [Demo-Annahme]",
  "overview.toggle.plan": "Bedarfsorientiert, gleicher Tag (ohne Staffelung)",
  // NOTE: `overview.toggle.plan` is still consumed as the ScenariosPanel
  // naive demand-driven card title (trap narrative — do NOT repurpose it).
  // The TodayPlanToggle button uses `overview.toggle.ourPlan` instead.
  "overview.toggle.ourPlan": "Unser Plan: bedarfsorientiert + Tagesverteilung",
  "overview.toggle.costWindow": "über den gespielten Zeitraum",
  "overview.toggle.costYear": "Hochgerechnete Kosten pro Jahr",
  "overview.toggle.serviceFull": "Simulierte Leerungs-Ereignisse voll oder übervoll",
  "overview.toggle.serviceObserved": "Leerungsdaten voll oder übervoll [beobachtet]",
  "overview.toggle.overflow": "Behälter-Tage über 100 % Füllstand (Überlauf)",
  "overview.toggle.maxFill": "Maximal simulierter Füllstand",
  "overview.toggle.truckDays": "Fahrzeug-Tage im Zeitraum",
  "overview.toggle.stops": "Stopps im Zeitraum",
  "overview.toggle.simBasis":
    "Basis: Simulation auf Basis historischer Raten, keine Vorhersage der Realität.",
  "overview.toggle.anchor":
    "Heute beobachtet: {pct} der Leerungsdaten voll oder übervoll [beobachtet]",
  "overview.toggle.anchorUnavailable":
    "Beobachtetes Serviceniveau für diesen Lauf nicht verfügbar.",
  "overview.toggle.anchorBasis": "Basis: beobachtete Leerungsdaten.",
  "overview.toggle.flagCostLessServiceWorse":
    "Warnung: der Plan kostet WENIGER (Differenz {delta}), bei WENIGER gutem simuliertem Service — billiger ist nicht automatisch besser.",
  "overview.toggle.flagCostMoreServiceBetter":
    "Ehrlicher Zielkonflikt: der Plan kostet MEHR (Differenz {delta}) — ehrlich gezeigt; der simulierte Service verbessert sich, das ist der Sinn.",
  "overview.toggle.flagCostMoreNoGain":
    "Der Plan kostet MEHR (Differenz {delta}) OHNE simulierten Service-Gewinn — ehrlich gezeigt, keine Verbesserung, die man dagegen aufwiegen könnte.",
  "overview.toggle.flagCostMoreServiceWorse":
    "Warnung: der Plan kostet MEHR (Differenz {delta}) und der simulierte Service ist SCHLECHTER — in Kosten und Service dominiert.",
  "overview.toggle.flagCostLessNoServiceChange":
    "Der Plan kostet WENIGER (Differenz {delta}) bei unverändertem simuliertem Service.",
  "overview.toggle.flagSameCost":
    "Gleiche simulierte Kosten (Differenz {delta}) — die Service-Zeile unten gibt die Richtung.",
  "overview.toggle.flagCostLessServiceBetter":
    "Der Plan kostet WENIGER (Differenz {delta}) und der simulierte Service verbessert sich.",
  "overview.toggle.serviceDelta":
    "Simulierte Service-Differenz (Anteil voll/übervoll): {delta} — positiv = mehr voll/übervoll geleerte Ereignisse als bei der heutigen Strategie.",
  "overview.toggle.costYearBasis":
    "Die Jahreswerte der Strategien sind auf {days} Betriebstage hochgerechnet [Demo-Annahme].",

  "overview.beforeafter.title": "Vom Alles-Abfahren zur optimierten Route",
  "overview.beforeafter.caption":
    "Was das zeigt: vier Szenarien auf demselben Datensatz — der Status-quo-feste Leerungsplan, ein Obergrenzen-Sweep über alle Stopps, ein Sweep nur über die empfohlenen Stopps und optimierte Routen. Warum das zählt: Strecke pro kg vergleicht die Szenarien fair (sie bedienen unterschiedlich viele Stopps); rohe Strecken sind nicht vergleichbar. Entfernungen sind Luftlinien-Schätzungen, keine Straßen-Kilometer.",
  "overview.compare.step0.title": "Status quo: fester Leerungsplan",
  "overview.compare.step0.short": "Fester Plan",
  "overview.compare.step1.title": "Obergrenze: alle Stopps abfahren",
  "overview.compare.step1.short": "Alle Stopps",
  "overview.compare.step2.title": "Auswahl-Effekt: nur die empfohlenen Stopps abfahren",
  "overview.compare.step2.short": "Ausgewählte Stopps",
  "overview.compare.step3.title": "Optimierte Routen (OR-Tools)",
  "overview.compare.step3.short": "Optimiert (OR-Tools)",
  "overview.compare.step3.medianSuffix": "Median aus {runs} Läufen",
  "overview.compare.selectionGain": "Auswahl-Gewinn (Sweep-alle → Auswahl-Sweep): {gain}",
  "overview.compare.selectionGainNegative":
    "Negativ = der Auswahl-Sweep hatte eine GRÖSSERE Strecke als der Sweep-alle-Lauf — die Auswahl hat sich hier (bei der Strecke) nicht gelohnt.",
  "overview.compare.routingGain": "Routing-Gewinn (Auswahl-Sweep → optimiert): {gain}",
  "overview.compare.totalGain": "Gesamt-Strecken-Gewinn (Sweep-alle → optimiert): {gain}",
  "overview.compare.gainUnavailable":
    "Gewinn für diesen Lauf nicht verfügbar — keine nutzbare optimierte Lösung zum Vergleich.",
  "overview.compare.perKgNote":
    "Strecke pro kg ist der faire Vergleich zwischen diesen Szenarien (sie bedienen unterschiedlich viele Stopps); rohe Strecken sind nicht vergleichbar. Entfernungen sind Luftlinien-Schätzungen, keine Straßen-Kilometer.",
  "overview.compare.savings": "Abgeleitete Ersparnis (Gesamtgewinn ÷ Sweep-alle-Stopp-Strecke): {pct}",
  "overview.compare.totalGainNegative":
    "Negativ = der optimierte Lauf hatte eine GRÖSSERE Strecke als der Sweep-alle-Lauf — ehrlich gezeigt, nicht beschönigt.",
  "overview.compare.determinism.identical":
    "Optimiertes Ergebnis deterministisch: identische Strecke über {runs} Läufe ({median}).",
  "overview.compare.determinism.medianOfRuns":
    "Optimierte Strecke variierte über {runs} Läufe (Wall-Clock-Solver-Varianz): Median {median}, Spanne {min}–{max}. Oben ist der Median gezeigt.",
  "col.distance": "Strecke",
  "col.distancePerKg": "Strecke pro kg",
  "col.service": "Serviceniveau (neben Kosten)",
  "col.duration": "Dauer",
  "col.trucks": "Fahrzeuge benötigt",
  "col.stopsServed": "Stopps bedient",
  "col.unserved": "Nicht bedient",
  "col.volume": "Volumen gesammelt",
  "col.weight": "Gewicht gesammelt",
  "col.cost": "Kosten (eingesetzte Fahrzeuge)",
  "col.rate": "Rate (Prozentpunkte/Tag)",
  "col.medianInterval": "Median-Intervall",
  "col.daysToFull": "Tage bis {pct}",
  "col.daysToFullPlain": "Tage bis zum Ziel-Füllstand",
  "col.predictedFullDate": "Prognostiziertes Voll-Datum",
  "unit.containers": "Behälter",
  "unit.vehicles": "Fahrzeuge",

  "containers.interval.title": "Füllungs-Intervalle pro Behälter (Prognose)",
  "containers.interval.subtitle":
    "Raten und Tage-bis-Ziel je Standort-Farben-Serie — abgeleitet aus den beobachteten Leerungsdaten [Prognose], nie Messungen. „Mindestens“ markiert zensierte Untergrenzen; Serien ohne Schätzung tragen ihren Grund, nie einen erfundenen Wert.",
  "containers.interval.loading": "Füllungs-Intervalle werden geladen",
  "containers.interval.error": "Füllungs-Intervalle konnten nicht geladen werden",
  "containers.interval.noDataset":
    "Keine Daten geladen — Intervalle sind nach dem Laden verfügbar.",
  "containers.interval.material": "Material",
  "containers.interval.allMaterials": "Alle Materialien",
  "containers.interval.onlyLowerBound": "Nur Untergrenzen-Schätzungen",
  "containers.interval.onlyWithoutEstimate": "Nur ohne Schätzung",
  "containers.interval.search": "Standort",
  "containers.interval.searchPlaceholder": "Standort-ID beginnt mit…",
  "containers.interval.showFewer": "Weniger anzeigen",
  "containers.interval.showAll": "Alle {n} Zeilen anzeigen",
  "containers.interval.count": "{shown} gezeigt · {total} nach Filtern · {all} Serien im Datensatz",
  "containers.interval.noMatches": "Keine Serie entspricht den aktuellen Filtern.",
  "containers.interval.colLocation": "Standort",
  "containers.interval.colMaterial": "Material",
  "containers.interval.atLeast": "mindestens",
  "containers.interval.atLeastTitle":
    "Zensierte Untergrenze: ein beitragender Datensatz war voll oder übervoll — die tatsächliche Füllzeit kann kürzer sein (§1.5).",
  "containers.interval.noEstimate": "keine Schätzung",
  "containers.interval.overdue": "überfällig",
  "containers.interval.overdueTitle":
    "Das [prognostizierte] Voll-Datum liegt in der Vergangenheit: das Ratenmodell nimmt keine Leerung nach dem letzten Datensatz an — diesen Behälter zeitnah prüfen.",

  "planning.title": "Welche Behälter sind bald voll, und wann?",
  "planning.subtitle":
    "Was diese Ansicht zeigt: Behälter-Schätzungen, abgeleitet aus den Leerungsdaten — [Prognose], nicht beobachtet. Warum das zählt: nur Behälter, die wahrscheinlich einen Service brauchen, kommen in den Routenplan. Methoden-Erklärung und die ehrliche Bewertung stehen unter Technische Details.",
  "planning.basis":
    "Grundlage: Leerungsdaten aus dem Datensatz — Füllstände zwischen Leerungen sind eine Modellannahme, keine Sensordaten.",
  "planning.params.asOf": "Stichtag (ISO)",
  "planning.params.horizon": "Horizont (Tage)",
  "planning.params.horizonNote": "Standard 28 T = beobachtete mittlere Abstand zwischen Lesungen",
  "planning.params.method": "Methode",
  "planning.method.persistence": "Zuletzt gemessener Stand hält (Persistence)",
  "planning.method.rate": "Füllgeschwindigkeits-Trend (Rate)",
  "planning.run": "Planung starten",
  "planning.running": "Füllstände werden geschätzt, Kandidaten werden ausgewählt",
  "planning.kpi.thresholdTitle": "prognostiziert ≥ {threshold} % bis zum Horizont",
  "planning.kpi.thresholdNote": "Schwellenwert aus der Richtlinien-Rückmeldung [Demo-Annahme]",
  "planning.kpi.medianTitle": "Median Tage bis voll",
  "planning.kpi.medianNote": "{n} von {total} Serien haben eine Schätzung [Prognose]",
  "planning.kpi.lowerBoundTitle": "Schätzungen sind nur Untergrenzen",
  "planning.kpi.lowerBoundNote":
    "diese Serien füllen sich nach der letzten Leerung ab einem angenommenen Stand — langsamer als prognostiziert ist möglich",
  "planning.kpi.overdueTitle": "prognostiziert voll vor heute",
  "planning.kpi.overdueNote": "das Modell nimmt keine Leerung nach dem letzten Datensatz an",
  "planning.table.title": "Als nächstes voll",
  "planning.table.subtitle":
    "Top {n} Serien nach frühestem prognostiziertem Voll-Datum — [Prognose]-Schätzungen, kein beobachtetes Verhalten.",
  "planning.table.excluded": "{n} Serien ohne Schätzung sind ausgeschlossen (zu wenige Datensätze oder kein numerischer Füllstand).",
  "planning.table.empty": "Keine Serie hat ein prognostiziertes Voll-Datum.",
  "planning.table.colSeries": "Serie",
  "planning.table.colLastFill": "Letzter Füllstand",
  "planning.table.colDaysToFull": "Tage bis voll",
  "planning.table.colPredictedDate": "Prognose voll",
  "planning.candidates.selected": "Ausgewählt",
  "planning.candidates.selectedEmpty": "Keine Behälter ausgewählt",
  "planning.candidates.skipped": "Übersprungen",
  "planning.candidates.skippedEmpty": "Nichts übersprungen",
  "planning.candidates.noSelection": "Noch keine Auswahl",
  "planning.candidates.noSelectionHint": "Stichtag + Horizont wählen und starten, um prognostizierte Kandidaten zu sehen.",
  "planning.candidates.selectError": "Kandidatenauswahl fehlgeschlagen",
  "planning.candidates.insight":
    "{selected} von {total} Behältern brauchen bis {date} voraussichtlich eine Leerung — {skipped} können warten",
  "planning.candidates.panelTitle": "Kandidaten-Stopps für den Routenplan",
  "planning.candidates.panelSubtitle":
    "Prognostizierter Füllstand pro Behälter und die Richtlinien-Entscheidung mit Begründung. Der prognostizierte Füllstand ist eine Modellausgabe [Prognose]. Ausgewählt vs. übersprungen gemäß Richtlinie §3 mit Gründen.",
  "planning.candidates.batch":
    "Batch {asOf} → Ziel {target} · ausgewählt {selected} · übersprungen {skipped}",
  "planning.candidates.policyEcho":
    "Effektive Richtlinie (Echo): Schwellenwert {threshold} % · Puffer {buffer} % · Überlauf immer ausgewählt: {overfull} — alle [Demo-Annahme]",
  "planning.candidates.colPredictedFill": "Prognose Füllstand",
  "planning.candidates.colState": "Zustand",
  "planning.candidates.colReason": "Grund",
  "planning.candidates.colDetail": "Detail",
  "planning.tech.persistence":
    "Zuletzt gemessener Stand hält (Persistence): der prognostizierte Füllstand bleibt bis zum Horizont auf dem letzten gemessenen Stand — einfach und nachvollziehbar.",
  "planning.tech.rate":
    "Füllgeschwindigkeit (Rate): der prognostizierte Füllstand wächst um die mittlere Füllgeschwindigkeit der Serie zwischen Leerungen.",
  "planning.tech.evaluation":
    "Bewertung am echten Datensatz: Rate schlägt Persistence — Test-MAE 20,1 vs. 22,8 Prozentpunkte [Bewertung an echten Daten].",
  "planning.tech.autoNote":
    "Die Schätzungen oben wurden automatisch mit dem letzten Daten-Zeitpunkt des Datensatzes, einem 28-Tage-Horizont und der Persistence-Methode abgerufen.",

  "routing.title": "Ein Sammeltag, optimiert",
  "routing.subtitle":
    "Was diese Ansicht zeigt: die Fahrreihenfolge pro Lkw für den gewählten Tag, die Beladung entlang der Tour und die Machbarkeitsprüfungen dahinter. Warum das zählt: Fahrerinnen und Fahrer bekommen eine machbare, erklärbare Tour. Berechnet über synthetische Demo-Geografie — Koordinaten, Depot, Entsorgung, Fuhrpark und Entfernungsmatrix sind [Demo-Annahme]; Entfernungen sind Luftlinien-Schätzungen, keine Straßen-Kilometer (§4.2/§5.3).",
  "routing.run": "Routenvorschlag berechnen",
  "routing.running": "Prognose, Auswahl und Lösung werden berechnet",
  "routing.runningHint": "Lösungszeitlimit ist begrenzt",
  "routing.empty": "Noch keine Route berechnet",
  "routing.emptyHint": "Mit einem Stichtag starten, um einen beschrifteten Demo-Routenvorschlag zu erhalten.",
  "routing.error": "Routenberechnung fehlgeschlagen",
  "routing.dayContext": "Tag: Stichtag {asOf} → Prognose-Ziel {target} · Demo-Fuhrpark und -Geografie [Demo-Annahme]",
  "routing.link.withPeak":
    "Der Tagesplan liegt unter Szenarien — unser Staffelungsplan besucht jeden Behälter über das Jahr verteilt (Spitze {n} Lkw pro Tag, [Prognose]-Simulation). Dieses Demo optimiert die Fahrreihenfolge für die konfigurierten Lkw.",
  "routing.link.withoutPeak":
    "Der Tagesplan liegt unter Szenarien — unser Staffelungsplan besucht jeden Behälter über das Jahr verteilt. Dieses Demo optimiert die Fahrreihenfolge für die konfigurierten Lkw.",
  "routing.insight":
    "{routes} Tour(en) bedienen {served} von {total} ausgewählten Stopps an diesem Tag — {deferred} auf einen späteren Tag verschoben",
  "routing.degraded":
    "Solver lieferte {status} — verschobene Stopps sind unten aufgeführt, niemals versteckt (Kontrakt §4.4).",
  "routing.deferred.title": "Auf einen späteren Tag verschoben ({n})",
  "routing.deferred.explanation":
    "An diesem konfigurierten Tag nicht gefahren — Fuhrpark oder Schichtlimit war zuerst erschöpft (Begründung pro Zeile). Der Szenarien-Staffelungsplan verteilt jeden Behälter auf Tage, eine Verschiebung hier ist kein verlorener Stopp.",
  "routing.deferred.none": "Alle ausgewählten Stopps werden an diesem Tag bedient.",
  "routing.reason.noInsertion":
    "Kein Lkw hatte an dem konfigurierten Tag freie Kapazität oder Schichtzeit für diesen Stopp übrig.",
  "routing.reason.shift":
    "Eine Leerung plus Hin- und Rückfahrt passt nicht in die tägliche Schicht eines Lkw — der Stopp ist an keinem einzelnen Tag mit der konfigurierten Schicht bedienbar.",
  "routing.reason.volume":
    "Das erwartete Sammelvolumen des Behälters übersteigt das größte Lkw-Fach für sein Material — kein konfigurierter Lkw kann ihn in einer Fahrt mitnehmen.",
  "routing.reason.weight":
    "Das erwartete Sammelgewicht des Behälters übersteigt die größte Lkw-Zuladung — kein konfigurierter Lkw kann ihn in einer Fahrt mitnehmen.",
  "routing.reason.fleetExhausted":
    "Alle konfigurierten Lkw haben ihr Schichtlimit erreicht, während in der Reihenfolge noch Stopps warteten.",
  "routing.reason.hostedCap":
    "Demo-Anzeigegrenze: nur die ersten Stopps der Auswahl werden im gehosteten Demo geroutet — der Rest ist verschoben.",

  "overview.compare.serviceAnchor":
    "{pct} der Leerungsdaten voll oder übervoll — beobachteter Serviceniveau-Anker, neben jeder Kostenangabe gezeigt (§6)",
  "overview.compare.serviceAnchorUnavailable":
    "Serviceniveau für diesen Lauf nicht verfügbar — Kosten werden gezeigt, sobald die API den Anker liefert.",
  "overview.compare.flatModeNote":
    "Flacher Fahrzeit-Modus: die Besuchsreihenfolge kann die Gesamtdauer nicht ändern — Strecken-Differenzen sind rein Strecke (kein Zeiteffekt).",

  "overview.calmnote":
    "Hinweis: Standorte, Fahrzeuge und Dichten in diesem Prototyp sind Demo-Annahmen. Entfernungen sind Luftlinien-Schätzungen — keine echten Straßen-Kilometer.",

  // §6 v5: die Story-Diagramme leben auf der Übersichtsseite, gespeist aus der
  // Live-API — die Ehrlichkeits-Labels bleiben unverändert.
  "charts.observed.title": "Der beobachtete Rhythmus der Leerungsdaten",
  "charts.observed.caption":
    "Was das zeigt: Leerungsdaten pro Tag über das beobachtete Fenster. Warum das zählt: die Arbeit kommt natürlich in Spitzen — ein Plan muss die Spitzen auffangen, nicht spiegeln.",
  "charts.observed.median": "Median pro aktivem Tag: {n}",
  "charts.observed.basis": "Grundlage: beobachtete Leerungsdaten [beobachtet] — nur aktive Tage.",
  "charts.fill.title": "Wie schnell Behälter voll werden",
  "charts.fill.illustration": "Illustration — keine Daten",
  "charts.fill.trigger": "Leerungs-Auslöser {pct} % [Demo-Annahme]",
  "charts.fill.curveCaption":
    "Was das zeigt: die modellierte Füllung zwischen zwei Leerungen. Warum das zählt: dieselbe Rate, die die heutige Empfehlung vorhersagt, sagt auch voraus, wie weit hinaus jeder Behälter reicht.",
  "charts.dtf.histogramTitle": "Prognostizierte Tage bis voll — Verteilung",
  "charts.dtf.count": "{n} Serien mit Schätzung",
  "charts.dtf.bin": "≤ {n} T",
  "charts.dtf.binMore": "> 365 T",
  "charts.fill.basis":
    "Histogramm-Balken sind [Prognose]-Schätzungen abgeleitet aus Leerungsdaten-Raten — siehe §1.5-Hinweis oben; die Kurve ist eine Zeichnung, keine Daten.",
  "charts.trap.title": "Die Falle der bedarfsorientierten Sammeltags-Abfuhr",
  "charts.trap.legendDemand": "Bedarfsorientiert, gleicher Tag (ohne Staffelung) [Prognose]",
  "charts.trap.caption":
    "Was das zeigt: Lkw-Tage pro Tag — der feste Zyklus braucht an meisten Tagen wenige Lkw, aber riesige Spitzen; alles am Fälligkeitstag zu sammeln bündelt die Arbeit in wenige, überlastete Tage. Warum das zählt: die Tagesverteilung glättet die Spitzen (Plan-Karte unten).",
  "charts.trap.basis": "Simulation auf Basis historischer Raten, keine Vorhersage der Realität — [Prognose].",
  "charts.outcomes.title": "Ergebnisse",
  "charts.outcomes.cost": "−{pct} Kosten über das Fenster",
  "charts.outcomes.eur": "−{eur} EUR",
  "charts.outcomes.service": "{overflow} simulierter Überlauf · heutiger Anker {pct} [beobachtet]",
  "charts.outcomes.basis":
    "Abgeleitet aus der beobachteten Basislinie und dem day_spread-Plan (§5.2.6) — ein Modellvergleich, nie eine gemessene Einsparung.",


  "overview.money.title": "Die Geld-Geschichte: beobachteter Betrieb vs. Plan",
  "overview.money.caption":
    "Der heutige Betrieb stammt aus den beobachteten Leerungsdaten; der Plan verteilt dieselben Sammlungen auf mehr Tage. Jede Kostenangabe steht mit ihrem Service-Level.",
  "overview.money.observedTitle": "Beobachteter Betrieb",
  "overview.money.observedServiceBasis": "beobachtete Leerungsdaten [beobachtet]",
  "overview.money.yearBasis":
    "Die Jahres-Basen unterscheiden sich: die beobachtete Basis ist auf ein 365-Tage-Jahr hochgerechnet; die Strategien rechnen mit {days} Betriebstagen [Demo-Annahme].",
  "overview.money.medianTrucks": "Lkw pro aktiven Tag (Median)",
  "overview.money.peakTrucks": "Lkw-Spitze",
  "overview.money.activeDays": "Aktive Tage / Kalendertage",
  "overview.money.typicalTrucks": "Übliche Lkw pro Tag",
  "overview.money.perYear": "Hochgerechnete Kosten pro Jahr",
  "overview.money.infeasibleDays": "Tage ohne Kapazitätsnachweis (offen ausgewiesen)",
  "overview.money.basisObserved": "[beobachtet × repräsentatives Zeitmodell]",
  "overview.money.planTitle": "Unser Plan: bedarfsorientiert + Tagesverteilung",
  "overview.money.basisPlan": "[Prognose — Simulation auf beobachteten Raten]",
  "overview.money.saved":
    "≈ {eur} EUR niedriger über das Fenster (−{pct} Kosten, abgeleitet) — bei besserem Service.",
  "overview.money.note":
    "Die Ersparnis ist aus den beiden API-Summen abgeleitet (Basis − Plan); der Plan ist eine Simulation auf beobachteten Raten, keine Vorhersage der Realität.",

  "scenarios.baseline.title": "Beobachteter Betrieb",
  "scenarios.baseline.medianTrucks": "Lkw pro aktiven Tag (Median)",
  "scenarios.baseline.peakTrucks": "Lkw-Spitze",
  "scenarios.baseline.activeDays": "Aktive Tage / Kalendertage",
  "scenarios.baseline.visits": "Leerungsdaten (Besuche)",
  "scenarios.baseline.infeasibleDays": "Tage ohne Kapazitätsnachweis (offen ausgewiesen)",
  "scenarios.baseline.basis": "[beobachtet × repräsentatives Zeitmodell]",
  "scenarios.spreadLabel": "Unser Plan: bedarfsorientiert + Tagesverteilung",
  "scenarios.spread.peakTrucks": "Lkw-Spitze pro Tag",
  "scenarios.spread.typicalTrucks": "Übliche Lkw pro Tag",
  "scenarios.spread.stopsPerTruckDay": "Stopps pro Lkw-Tag",
  "scenarios.spread.deferrals": "Verschobene Leerungen",
  "scenarios.spread.maxSuffix": "max",

  "demo.button": "Demo-Daten laden",
  "demo.loading": "Demo-Daten werden geladen",
  "demo.error": "Demo-Daten konnten nicht geladen werden",

  "overview.reason.at_or_above_threshold":
    "Voraussichtlich auf oder über der Leeren-Schwelle — Leeren empfohlen",
  "overview.reason.overfull_state":
    "Letzte Messung war übervoll — immer empfohlen",
  "overview.reason.below_threshold": "Noch Platz — kann warten",
  "overview.reason.no_forecast": "Keine Prognose möglich — bitte prüfen",

  "overview.state.loading": "Übersicht wird geladen",
  "overview.state.noDataset":
    "Noch keine Daten geladen — bitte CSV hochladen oder unten die Demo-Daten laden.",
  "overview.state.summaryError": "Datensatz-Übersicht konnte nicht geladen werden",
  "overview.state.recommendationLoading": "Empfehlung wird berechnet",
  "overview.state.recommendationError": "Empfehlung konnte nicht berechnet werden",
  "overview.state.noAsOf": "Kein letztes Messdatum vorhanden — Empfehlung übersprungen.",
  "overview.state.noFillStats":
    "Füllstands-Anteile sind für diese Datensatz-Übersicht nicht verfügbar.",
  "overview.state.comparisonLoading": "Vergleich fest-vs-optimiert wird berechnet",
  "overview.state.comparisonError": "Vergleich konnte nicht berechnet werden",
  "overview.state.comparisonNoDataset":
    "Keine Daten geladen — der Vergleich ist nach dem Laden verfügbar.",
  "overview.state.daysToFullLoading": "Tage-bis-voll-Schätzungen werden berechnet",
  "overview.state.simulationLoading": "Der beobachtete Tagesrhythmus wird geladen",
  "overview.state.simulationError": "Die Tagessimulation konnte nicht geladen werden",
  "overview.state.scenariosLoading": "Heute-vs-Plan-Vergleich wird berechnet",
  "overview.state.scenariosError": "Heute-vs-Plan-Vergleich konnte nicht berechnet werden",
  "overview.state.scenariosNoDataset":
    "Keine Daten geladen — der Heute-vs-Plan-Vergleich ist nach dem Laden verfügbar.",
  "overview.tech.assumptions": "Von der API zurückgegebene, gelabelte Annahmen",

  "techdetails.label": "Technische Details",

  "legend.brown": "Braunglas",
  "legend.green": "Grünglas",
  "legend.white": "Weißglas",
};

const DICTS: Record<Lang, Record<TranslationKey, string>> = { en, de };
export { DICTS };

/** Translate a key. Falls back to the key itself if a dict entry is missing. */
export function t(lang: Lang, key: TranslationKey): string {
  return DICTS[lang][key] ?? key;
}

/** Translate with {placeholder} substitution. */
export function tf(
  lang: Lang,
  key: TranslationKey,
  params: Record<string, string | number>,
): string {
  let text: string = DICTS[lang][key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

export const ALL_TRANSLATION_KEYS: readonly TranslationKey[] = Object.keys(en) as readonly TranslationKey[];
