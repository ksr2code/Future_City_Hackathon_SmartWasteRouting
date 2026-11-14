import { useEffect, useState } from "react";
import { fetchHealth, type Health } from "./lib/health";

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((payload) => {
        if (!cancelled) setHealth(payload);
      })
      .catch(() => {
        if (!cancelled) setError("API unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-900">WasteRouting.AI</h1>
      <p className="mt-2 text-sm text-slate-500">
        Glass-waste collection forecasting &amp; routing (prototype)
      </p>
      <p className="mt-4 text-sm text-slate-700" data-testid="health">
        API health:{" "}
        {error ? (
          <span className="font-semibold text-red-600">{error}</span>
        ) : health ? (
          <span className="font-semibold text-green-700">{health.status}</span>
        ) : (
          "checking…"
        )}
      </p>
    </main>
  );
}
