import { useMemo, useState } from "react";
import type { Group } from "./GroupListTypes";

type Step = {
  id: string;
  secondsOn: string;   // strings for clean typing UX
  secondsOff: string;
  intensity: string;   // 0–4095
  repeats: string;     // integer ≥ 1
};

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const digitsOnly = (s: string) => s.replace(/\D/g, "");
const decimalOnly = (s: string) => s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

const clampNumberString = (s: string, min: number, max?: number) => {
  const n = Number(s);
  if (Number.isNaN(n)) return String(min);
  if (max == null) return String(Math.max(min, n));
  return String(Math.min(Math.max(min, n), max));
};

const MIN_INTENSITY = 0;
const MAX_INTENSITY = 4095;

export default function SequenceList({ selectedGroup }: { selectedGroup: Group | null }) {
  // Per-group store: { [groupId]: Step[] }
  const [perGroup, setPerGroup] = useState<Record<string, Step[]>>({});

  const steps = useMemo<Step[]>(
    () => (selectedGroup ? perGroup[selectedGroup.id] ?? [] : []),
    [perGroup, selectedGroup]
  );

  const setStepsForSelected = (next: Step[]) => {
    if (!selectedGroup) return;
    setPerGroup((prev) => ({ ...prev, [selectedGroup.id]: next }));
  };

  const addStep = () => {
    if (!selectedGroup) return;
    const next: Step = {
      id: uid(),
      secondsOn: "1",
      secondsOff: "1",
      intensity: String(MAX_INTENSITY), // default full scale (4095)
      repeats: "1",
    };
    setStepsForSelected([...steps, next]);
  };

  const updateField = (id: string, field: keyof Step, value: string) => {
    setStepsForSelected(
      steps.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeStep = (id: string) => {
    setStepsForSelected(steps.filter((s) => s.id !== id));
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
                style={{ backgroundColor: selectedGroup.color, boxShadow: `0 0 0 2px ${selectedGroup.color}44` }}
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
          <div className="p-4 text-sm text-gray-500">Select a group to add steps.</div>
        ) : steps.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No steps yet. Click “Add step”.</div>
        ) : (
          <ul className="divide-y">
            {steps.map((s, idx) => (
              <li key={s.id} className="p-3">
                <div className="mb-2 text-sm font-medium">Step {idx + 1}</div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Seconds On */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Seconds on</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 1.5"
                      value={s.secondsOn}
                      onChange={(e) => updateField(s.id, "secondsOn", decimalOnly(e.target.value))}
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "secondsOn",
                          clampNumberString(e.target.value || "0", 0)
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>

                  {/* Seconds Off */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Seconds off</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g., 0.5"
                      value={s.secondsOff}
                      onChange={(e) => updateField(s.id, "secondsOff", decimalOnly(e.target.value))}
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "secondsOff",
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
                      onChange={(e) => updateField(s.id, "intensity", digitsOnly(e.target.value))}
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "intensity",
                          clampNumberString(e.target.value || "0", MIN_INTENSITY, MAX_INTENSITY)
                        )
                      }
                      className="w-full rounded-md border px-2 py-1.5"
                    />
                  </label>

                  {/* Repeats (≥ 1) */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Repeat</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1"
                      value={s.repeats}
                      onChange={(e) => updateField(s.id, "repeats", digitsOnly(e.target.value))}
                      onBlur={(e) =>
                        updateField(
                          s.id,
                          "repeats",
                          clampNumberString(e.target.value || "1", 1)
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
