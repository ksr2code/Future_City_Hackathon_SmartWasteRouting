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
  "nav.forecast": "Forecast & candidates",
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
  "overview.toggle.today": "Modelled 28-day cycle [demo assumption]",
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

  "overview.compare.serviceAnchor":
    "{pct} of emptying records full-or-overfull — observed service anchor, shown beside every cost (§6)",
  "overview.compare.serviceAnchorUnavailable":
    "Service level unavailable for this run — cost is shown with the anchor once the API reports it.",
  "overview.compare.flatModeNote":
    "Flat travel-time mode: visiting order cannot change total duration — distance differences are distance-only (no time effect).",

  "overview.calmnote":
    "Please note: locations, vehicles and densities in this prototype are demo assumptions. Distances are straight-line estimates — not real road distances.",

  "overview.presentation.open": "Presentation",
  "presentation.stepOf": "Step {i} of {n}",
  "presentation.hint": "← → to navigate · Esc closes",
  "presentation.close": "Close",
  "presentation.unavailable": "Data not available for this step.",
  "presentation.bundle.error":
    "Bundled presentation data is missing or invalid — the presentation cannot start.",
  "presentation.bundle.hint":
    "Problem with the capture bundle: {detail}. Restore frontend/src/test/fixtures/real-capture/presentation/ and rebuild the app.",
  "presentation.s1.title": "Why we are here",
  "presentation.s1.basis":
    "All figures in this presentation are precalculated from real data (captured {date}) — observed data, predictions and demo assumptions stay labelled on every slide.",
  "presentation.s2.title": "Observed today",
  "presentation.s2.note":
    "of emptying records with fill at or above {thr} % (threshold: demo assumption)",
  "presentation.s2.basis": "Basis: observed emptying records [observed].",
  "presentation.s2.chartCaption": "Emptying visits per day [observed]",
  "presentation.s2.median": "median {n} per active day",
  "presentation.s3.title": "How it works",
  "presentation.s3.illustration": "Illustration — not data",
  "presentation.s3.fillTrigger": "fill rises → 80 % trigger → emptied (reset)",
  "presentation.s3.histogramTitle": "Predicted days to full",
  "presentation.s3.histogramCount": "{n} series [predicted]",
  "presentation.s3.bin30": "≤30",
  "presentation.s3.bin60": "31–60",
  "presentation.s3.bin90": "61–90",
  "presentation.s3.bin120": "91–120",
  "presentation.s3.bin180": "121–180",
  "presentation.s3.bin365": "181–365",
  "presentation.s3.binMore": ">365",
  "presentation.s3.basis": "Basis: predicted from emptying records — not measurements.",
  "presentation.s4.title": "The trap: same-day service clusters the trucks",
  "presentation.s4.legendFixed": "Fixed cycle (status quo) [predicted]",
  "presentation.s4.legendDemand": "Demand-driven, same-day (no spacing) [predicted]",
  "presentation.s4.caption":
    "Same-day service clusters visits onto a few days — truck-days pile up in spikes even though fewer collections happen. Without day spreading, demand-driven costs more, not less.",
  "presentation.s4.basis": "Basis: simulation on observed rates — not a prediction of reality.",
  "presentation.s5.title": "Our plan — the money story",
  "presentation.s5.saved":
    "≈ {eur} EUR lower (−{pct} cost, derived) — with better service.",
  "presentation.s5.truckDays": "Truck-days: {from} → {to}",
  "presentation.s5.trucksPerDay": "Trucks per day: typical {typical} · peak {peak}",
  "presentation.s5.basis":
    "Basis: observed emptying records × representative time model · plan = simulation on observed rates, not a prediction.",
  "presentation.s6.title": "What this means",
  "presentation.s6.outcomeCost": "lower window cost (derived: baseline − plan ÷ baseline)",
  "presentation.s6.outcomeEur": "saved over the window (derived)",
  "presentation.s6.outcomeService":
    "simulated overflow — vs {anchor} observed emptying events full-or-overfull [observed]",
  "presentation.s6.basis":
    "Precalculated from real data (captured {date}). Labels: [observed] × representative time model · [predicted] simulation — never a measurement.",
  "presentation.calmbasis":
    "All values labelled: observed · predicted · [demo assumption]. Precalculated from real data (captured {date}); full details in the dashboard views.",

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
  "nav.forecast": "Prognose & Kandidaten",
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
  "overview.toggle.today": "Modellierter 28-Tage-Zyklus [Demo-Annahme]",
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

  "overview.compare.serviceAnchor":
    "{pct} der Leerungsdaten voll oder übervoll — beobachteter Serviceniveau-Anker, neben jeder Kostenangabe gezeigt (§6)",
  "overview.compare.serviceAnchorUnavailable":
    "Serviceniveau für diesen Lauf nicht verfügbar — Kosten werden gezeigt, sobald die API den Anker liefert.",
  "overview.compare.flatModeNote":
    "Flacher Fahrzeit-Modus: die Besuchsreihenfolge kann die Gesamtdauer nicht ändern — Strecken-Differenzen sind rein Strecke (kein Zeiteffekt).",

  "overview.calmnote":
    "Hinweis: Standorte, Fahrzeuge und Dichten in diesem Prototyp sind Demo-Annahmen. Entfernungen sind Luftlinien-Schätzungen — keine echten Straßen-Kilometer.",

  "overview.presentation.open": "Präsentation",
  "presentation.stepOf": "Schritt {i} von {n}",
  "presentation.hint": "← → zum Blättern · Esc schließt",
  "presentation.close": "Schließen",
  "presentation.unavailable": "Daten für diesen Schritt nicht verfügbar.",
  "presentation.bundle.error":
    "Mitgelieferte Präsentationsdaten fehlen oder sind ungültig — die Präsentation kann nicht starten.",
  "presentation.bundle.hint":
    "Problem mit dem Capture-Bundle: {detail}. Bitte frontend/src/test/fixtures/real-capture/presentation/ wiederherstellen und die App neu bauen.",
  "presentation.s1.title": "Warum wir hier sind",
  "presentation.s1.basis":
    "Alle Zahlen dieser Präsentation sind aus echten Daten vorberechnet (erfasst am {date}) — beobachtete Daten, Prognosen und Demo-Annahmen bleiben auf jeder Folie gelabelt.",
  "presentation.s2.title": "Heute beobachtet",
  "presentation.s2.note":
    "der Leerungsdaten mit Füllstand ab {thr} % (Schwelle: Demo-Annahme)",
  "presentation.s2.basis": "Basis: beobachtete Leerungsdaten [beobachtet].",
  "presentation.s2.chartCaption": "Leerungs-Besuche pro Tag [beobachtet]",
  "presentation.s2.median": "Median {n} pro aktivem Tag",
  "presentation.s3.title": "Wie es funktioniert",
  "presentation.s3.illustration": "Illustration — keine Daten",
  "presentation.s3.fillTrigger": "Füllstand steigt → 80 %-Schwelle → geleert (Reset)",
  "presentation.s3.histogramTitle": "Prognostizierte Tage bis voll",
  "presentation.s3.histogramCount": "{n} Serien [Prognose]",
  "presentation.s3.bin30": "≤30",
  "presentation.s3.bin60": "31–60",
  "presentation.s3.bin90": "61–90",
  "presentation.s3.bin120": "91–120",
  "presentation.s3.bin180": "121–180",
  "presentation.s3.bin365": "181–365",
  "presentation.s3.binMore": ">365",
  "presentation.s3.basis": "Basis: prognostiziert aus Leerungsdaten — keine Messungen.",
  "presentation.s4.title": "Die Falle: Same-Day-Service bündelt die Lkw",
  "presentation.s4.legendFixed": "Fester Zyklus (Status quo) [Prognose]",
  "presentation.s4.legendDemand": "Bedarfsorientiert, gleicher Tag (ohne Staffelung) [Prognose]",
  "presentation.s4.caption":
    "Der Same-Day-Service bündelt Besuche auf wenige Tage — die Lkw-Tage häufen sich in Spitzen, obwohl weniger Sammlungen stattfinden. Ohne Tagesverteilung kostet bedarfsorientiert mehr, nicht weniger.",
  "presentation.s4.basis": "Basis: Simulation auf beobachteten Raten — keine Vorhersage der Realität.",
  "presentation.s5.title": "Unser Plan — die Geld-Geschichte",
  "presentation.s5.saved":
    "≈ {eur} EUR niedriger (−{pct} Kosten, abgeleitet) — bei besserem Service.",
  "presentation.s5.truckDays": "Lkw-Tage: {from} → {to}",
  "presentation.s5.trucksPerDay": "Lkw pro Tag: üblich {typical} · Spitze {peak}",
  "presentation.s5.basis":
    "Basis: beobachtete Leerungsdaten × repräsentatives Zeitmodell · Plan = Simulation auf beobachteten Raten, keine Vorhersage.",
  "presentation.s6.title": "Was das bedeutet",
  "presentation.s6.outcomeCost": "niedrigere Kosten im Fenster (abgeleitet: Basis − Plan ÷ Basis)",
  "presentation.s6.outcomeEur": "eingespart im Fenster (abgeleitet)",
  "presentation.s6.outcomeService":
    "simulierter Überlauf — gegenüber {anchor} beobachteten Leerungs-Ereignissen voll oder übervoll [beobachtet]",
  "presentation.s6.basis":
    "Aus echten Daten vorberechnet (erfasst am {date}). Labels: [beobachtet] × repräsentatives Zeitmodell · [Prognose] Simulation — nie eine Messung.",
  "presentation.calmbasis":
    "Alle Werte gelabelt: beobachtet · Prognose · [Demo-Annahme]. Aus echten Daten vorberechnet (erfasst am {date}); Details stehen in den Dashboard-Ansichten.",

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
