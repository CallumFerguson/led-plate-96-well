import type { Group } from "./GroupListTypes";
import { useMemo } from "react";

export type Step = {
  id: string;
  msOn: string;            // integers (ms), ≥ 0
  msOff: string;           // integers (ms), ≥ 0
  intensity: string;       // 0–4095
  loopDurationMs: string;  // integers (ms), ≥ 0 (0 = forever)
};

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const digitsOnly = (s: string) => s.replace(/\D/g, "");

const clampNumberString = (s: string, min: number, max?: number) => {
  const n = Number(s);
  if (Number.isNaN(n)) return String(min);
  if (max == null) return String(Math.max(min, n));
  return String(Math.min(Math.max(min, n), max));
};

const MIN_INTENSITY = 0;
const MAX_INTENSITY = 4095;

export default function SequenceList({
  selectedGroup,
  steps,
  setSteps,
}: {
  selectedGroup: Group | null;
  steps: Step[];
  setSteps: (next: Step[]) => void;
}) {
  const safeSteps = useMemo<Step[]>(
    () => (selectedGroup ? steps ?? [] : []),
    [steps, selectedGroup]
  );

  const addStep = () => {
    if (!selectedGroup) return;
    const next: Step = {
      id: uid(),
      msOn: "1000",
      msOff: "1000",
      intensity: "10",
      loopDurationMs: "0", // 0 = forever
    };
    setSteps([...safeSteps, next]);
  };

  const updateField = (id: string, field: keyof Step, value: string) => {
    setSteps(safeSteps.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeStep = (id: string) => {
    setSteps(safeSteps.filter((s) => s.id !== id));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {selectedGroup ? (
            <>
              <span
                aria-hidden
                className="inline-block size-3 rounded-full ring-2"
                style={{
                  backgroundColor: selectedGroup.color,
                  boxShadow: `0 0 0 2px ${selectedGroup.color}44`,
                }}
              />
              <span>Sequence for {selectedGroup.name}</span>
            </>
          ) : (
            "No group selected"
          )}
        </h3>
        <button
          type="button"
          onClick={addStep}
          disabled={!selectedGroup}
          className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-50"
        >
          Add step
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
        {!selectedGroup ? (
          <div className="p-4 text-sm text-gray-500">
            Select a group to add steps.
          </div>
        ) : safeSteps.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">
            No steps yet. Click “Add step”.
          </div>
        ) : (
          <ul className="divide-y">
            {safeSteps.map((s, idx) => (
              <li key={s.id} className="p-3">
                <div className="mb-2 text-sm font-medium">Step {idx + 1}</div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* MS On */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">MS on</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g., 700"
                      value={s.msOn}
                      onChange={(e) =>
                        updateField(s.id, "msOn", digitsOnly(e.target.value))
                      }
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "msOn",
                          clampNumberString(e.target.value || "0", 0)
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>

                  {/* MS Off */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">MS off</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g., 300"
                      value={s.msOff}
                      onChange={(e) =>
                        updateField(s.id, "msOff", digitsOnly(e.target.value))
                      }
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "msOff",
                          clampNumberString(e.target.value || "0", 0)
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>

                  {/* Intensity (0–4095) */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Intensity</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0–4095"
                      value={s.intensity}
                      onChange={(e) =>
                        updateField(
                          s.id,
                          "intensity",
                          digitsOnly(e.target.value)
                        )
                      }
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "intensity",
                          clampNumberString(
                            e.target.value || "0",
                            MIN_INTENSITY,
                            MAX_INTENSITY
                          )
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>

                  {/* Loop duration (ms) */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">
                      Duration (ms)
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="e.g., 10000 (0 = forever)"
                      value={s.loopDurationMs}
                      onChange={(e) =>
                        updateField(
                          s.id,
                          "loopDurationMs",
                          digitsOnly(e.target.value)
                        )
                      }
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "loopDurationMs",
                          clampNumberString(e.target.value || "0", 0)
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => removeStep(s.id)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-gray-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
