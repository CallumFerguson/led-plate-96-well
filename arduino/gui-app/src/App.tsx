// src/App.tsx
import "./App.css";
import WellPlate96 from "./components/WellPlate96";
import GroupList from "./components/GroupList";
import type { Group } from "./components/GroupListTypes";
import { useMemo, useState } from "react";
import SequenceList, { type Step } from "./components/SequenceList";

/** Locked-in Arduino sketch template: only inject between the DATA markers. */
const INO_TEMPLATE_PREFIX = String.raw`/*
  Auto-generated from your 96-well UI.
  - Runs ALL GROUPS CONCURRENTLY with non-blocking scheduling (no delay()).
  - Pins and startup behavior match your example.
  - Only the DATA section below changes between exports.
*/

#include "Adafruit_TLC5947.h"

#define PIN_DATA 3
#define PIN_CLOCK 5
#define PIN_LATCH 9
#define PIN_BLANK 6

#define NUM_TLC5947 4
#define TOTAL_CHANNELS (NUM_TLC5947 * 24)

/** Behavior after finishing all steps:
    1 = loop forever (restart all groups), 0 = run once and stop (leave wells off). */
#define PROGRAM_LOOP 1

Adafruit_TLC5947 tlc(NUM_TLC5947, PIN_CLOCK, PIN_DATA, PIN_LATCH);

struct Step {
  float secondsOn;    // >= 0
  float secondsOff;   // >= 0
  uint16_t intensity; // 0..4095
  uint16_t repeats;   // >= 1
};

/* =========================
   ==== BEGIN GENERATED DATA ====
   (the exporter injects NUM_GROUPS, well/step arrays & offsets here)
`;

const INO_TEMPLATE_SUFFIX = String.raw`
   ==== END GENERATED DATA ====
   =========================== */

enum Phase : uint8_t { PHASE_ON = 0, PHASE_OFF = 1, PHASE_DONE = 2 };

struct GroupState {
  uint16_t step_idx;
  uint16_t repeat_left;
  Phase phase;
  unsigned long next_ms;
};

GroupState g_states[NUM_GROUPS];

static inline unsigned long secs_to_ms(float s) {
  if (s <= 0.0f) return 0UL;
  return (unsigned long)(s * 1000.0f);
}

static inline void set_group_wells(uint16_t g, uint16_t value) {
  const uint32_t start = WELL_OFFSETS[g];
  const uint32_t end   = WELL_OFFSETS[g + 1];
  for (uint32_t i = start; i < end; ++i) {
    tlc.setPWM(WELLS_FLAT[i], value);
  }
}

// Returns pointer to this group's current Step (safe even if empty: returns a dummy)
static const Step& current_step(uint16_t g) {
  static const Step EMPTY = {0,0,0,1};
  const uint32_t s0 = STEP_OFFSETS[g];
  const uint32_t s1 = STEP_OFFSETS[g + 1];
  if (s0 >= s1) return EMPTY; // no steps
  const Step* base = &STEPS_FLAT[s0];
  uint16_t idx = g_states[g].step_idx;
  if (idx >= (s1 - s0)) idx = (s1 - s0) - 1;
  return base[idx];
}

static void start_group(uint16_t g, unsigned long now) {
  g_states[g].step_idx = 0;
  const Step& st = current_step(g);
  g_states[g].repeat_left = st.repeats ? st.repeats : 1;
  g_states[g].phase = PHASE_ON;

  // Apply ON immediately
  set_group_wells(g, st.intensity);
  g_states[g].next_ms = now + secs_to_ms(st.secondsOn);
}

static bool advance_group_once(uint16_t g, unsigned long now, bool &dirtyPwm) {
  GroupState &S = g_states[g];
  if (S.phase == PHASE_DONE) return false;

  const Step& st = current_step(g);

  // Handle zero-length phases by collapsing them immediately.
  auto collapse_zero = [&](void) {
    int safety = 8; // avoid infinite churn on pathological 0/0 steps
    while (safety-- > 0) {
      if (S.phase == PHASE_ON) {
        // If ON duration is zero, go straight to OFF
        if (st.secondsOn <= 0.0f) {
          set_group_wells(g, 0);
          dirtyPwm = true;
          S.phase = PHASE_OFF;
          if (st.secondsOff <= 0.0f) {
            // OFF also zero: advance to next repeat/step immediately
            if (--S.repeat_left > 0) {
              // next repeat of the same step -> ON again
              S.phase = PHASE_ON;
              set_group_wells(g, st.intensity);
              // keep dirty flag; next_ms for ON phase is now + 0 (handled below)
              continue;
            } else {
              // move to next step
              const uint32_t s0 = STEP_OFFSETS[g];
              const uint32_t s1 = STEP_OFFSETS[g + 1];
              if (s0 >= s1) { S.phase = PHASE_DONE; break; } // empty
              S.step_idx++;
              if (s0 + S.step_idx >= s1) {
                if (PROGRAM_LOOP) {
                  S.step_idx = 0;
                } else {
                  S.phase = PHASE_DONE;
                  break;
                }
              }
              const Step& st2 = current_step(g);
              S.repeat_left = st2.repeats ? st2.repeats : 1;
              S.phase = PHASE_ON;
              set_group_wells(g, st2.intensity);
              dirtyPwm = true;
              // and loop again in case durations are also zero
              continue;
            }
          } else {
            // OFF has time > 0, schedule it
            S.next_ms = now + secs_to_ms(st.secondsOff);
            return true;
          }
        } else {
          // ON has time > 0, schedule it
          S.next_ms = now + secs_to_ms(st.secondsOn);
          return true;
        }
      } else { // PHASE_OFF
        if (st.secondsOff <= 0.0f) {
          // advance cycle immediately
          if (--S.repeat_left > 0) {
            S.phase = PHASE_ON;
            set_group_wells(g, st.intensity);
            dirtyPwm = true;
            continue; // ON may also be zero; loop
          } else {
            // next step
            const uint32_t s0 = STEP_OFFSETS[g];
            const uint32_t s1 = STEP_OFFSETS[g + 1];
            if (s0 >= s1) { S.phase = PHASE_DONE; break; } // empty
            S.step_idx++;
            if (s0 + S.step_idx >= s1) {
              if (PROGRAM_LOOP) {
                S.step_idx = 0;
              } else {
                S.phase = PHASE_DONE;
                break;
              }
            }
            const Step& st2 = current_step(g);
            S.repeat_left = st2.repeats ? st2.repeats : 1;
            S.phase = PHASE_ON;
            set_group_wells(g, st2.intensity);
            dirtyPwm = true;
            continue;
          }
        } else {
          // schedule OFF duration
          S.next_ms = now + secs_to_ms(st.secondsOff);
          return true;
        }
      }
    }
    return false; // either DONE or fully collapsed with no scheduling needed
  };

  if (S.next_ms == 0UL) {
    // (first time) or (we just rebuilt states)
    return collapse_zero();
  }

  if ((long)(now - S.next_ms) < 0) {
    return false; // not time yet
  }

  // Time to transition this group once
  if (S.phase == PHASE_ON) {
    // Turn OFF
    set_group_wells(g, 0);
    dirtyPwm = true;
    S.phase = PHASE_OFF;
    if (st.secondsOff > 0.0f) S.next_ms = now + secs_to_ms(st.secondsOff);
    else return collapse_zero();
    return true;
  } else if (S.phase == PHASE_OFF) {
    // Next repeat or step
    if (--S.repeat_left > 0) {
      S.phase = PHASE_ON;
      set_group_wells(g, st.intensity);
      dirtyPwm = true;
      if (st.secondsOn > 0.0f) S.next_ms = now + secs_to_ms(st.secondsOn);
      else return collapse_zero();
      return true;
    } else {
      // Advance to next step
      const uint32_t s0 = STEP_OFFSETS[g];
      const uint32_t s1 = STEP_OFFSETS[g + 1];
      if (s0 >= s1) { S.phase = PHASE_DONE; return true; } // empty
      S.step_idx++;
      if (s0 + S.step_idx >= s1) {
        if (PROGRAM_LOOP) {
          S.step_idx = 0;
        } else {
          S.phase = PHASE_DONE;
          return true;
        }
      }
      const Step& st2 = current_step(g);
      S.repeat_left = st2.repeats ? st2.repeats : 1;
      S.phase = PHASE_ON;
      set_group_wells(g, st2.intensity);
      dirtyPwm = true;
      if (st2.secondsOn > 0.0f) S.next_ms = now + secs_to_ms(st2.secondsOn);
      else return collapse_zero();
      return true;
    }
  }
  return false;
}

void setup() {
  /*
    The TLC5947 BLANK pin keeps all the LEDs off when it is high.
    The board has a pull-up on BLANK so LEDs are off by default.
    Important: Set all LEDs to 0 before pulling BLANK low so they don't flash.
  */
  tlc.begin();
  for (uint16_t i = 0; i < TOTAL_CHANNELS; i++) {
    tlc.setPWM(i, 0);
  }
  tlc.write();

  pinMode(PIN_BLANK, OUTPUT);
  digitalWrite(PIN_BLANK, LOW);

  // Initialize runtime state for each group
  const unsigned long now = millis();
  for (uint16_t g = 0; g < NUM_GROUPS; ++g) {
    g_states[g] = {0, 1, PHASE_ON, 0UL};
    start_group(g, now);
  }
}

void loop() {
  const unsigned long now = millis();
  bool dirty = false;

  // Advance any group that needs it. Limit total transitions per loop to avoid
  // pathological churn with many zero-length steps across groups.
  int transitions_budget = 64;
  bool progressed = true;
  while (progressed && transitions_budget-- > 0) {
    progressed = false;
    for (uint16_t g = 0; g < NUM_GROUPS; ++g) {
      if (advance_group_once(g, now, dirty)) progressed = true;
    }
  }

  if (dirty) tlc.write();
}
`;

// ------------ UI helpers / palette ------------
const PALETTE = [
  "#2563eb", // blue-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
  "#84cc16", // lime-500
];

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function nextGroupName(existing: Group[]): string {
  const used = new Set(existing.map((g) => g.name));
  let n = 1;
  while (used.has(`Group ${n}`)) n++;
  return `Group ${n}`;
}

function nextGroupColor(existing: Group[], palette: string[]): string {
  const used = new Set(existing.map((g) => g.color));

  for (const c of palette) {
    if (!used.has(c)) return c;
  }

  const counts: Record<string, number> = {};
  for (const c of palette) counts[c] = 0;
  for (const g of existing) counts[g.color] = (counts[g.color] ?? 0) + 1;

  let candidate = palette[0];
  let min = counts[candidate] ?? 0;
  for (const c of palette) {
    const cnt = counts[c] ?? 0;
    if (cnt < min) {
      min = cnt;
      candidate = c;
    }
  }
  return candidate;
}

// ------------ small coercion helpers for export ------------
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
const toInt = (s: string, min: number, max: number) => clamp(Math.round(Number(s || "0")), min, max);
const toFloat = (s: string, min: number) => Math.max(Number(s || "0"), min);

const App = () => {
  // Groups and selection state
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId]
  );

  // Per-group selected wells: groupId -> Set<index>
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, Set<number>>>({});

  // Per-group sequence steps for export
  const [stepsByGroup, setStepsByGroup] = useState<Record<string, Step[]>>({});

  const stepsForSelected = useMemo<Step[]>(
    () => (selectedGroup ? stepsByGroup[selectedGroup.id] ?? [] : []),
    [selectedGroup, stepsByGroup]
  );

  const setStepsForSelected = (next: Step[]) => {
    if (!selectedGroup) return;
    setStepsByGroup((prev) => ({ ...prev, [selectedGroup.id]: next }));
  };

  const addGroup = () => {
    const g: Group = {
      id: uid(),
      name: nextGroupName(groups),
      color: nextGroupColor(groups, PALETTE),
    };
    setGroups((prev) => [...prev, g]);
    setSelectedId(g.id);
  };

  const selectGroup = (groupId: string) => {
    setSelectedId((curr) => (curr === groupId ? null : groupId));
  };

  const removeGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setSelectedByGroup((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setStepsByGroup((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setSelectedId((curr) => (curr === groupId ? null : curr));
  };

  const selectedSet = useMemo(
    () =>
      selectedGroup
        ? selectedByGroup[selectedGroup.id] ?? new Set<number>()
        : new Set<number>(),
    [selectedGroup, selectedByGroup]
  );

  const { ownerIdByIndex, ownerNameByIndex, ownerColorByIndex, otherGroupsSelected } = useMemo(() => {
    const ownerId: Record<number, string> = {};
    const ownerName: Record<number, string> = {};
    const ownerColor: Record<number, string> = {};

    Object.entries(selectedByGroup).forEach(([gid, set]) => {
      const g = groups.find((gg) => gg.id === gid);
      set.forEach((i) => {
        ownerId[i] = gid;
        ownerName[i] = g?.name ?? gid;
        ownerColor[i] = g?.color ?? "#64748b";
      });
    });

    const others = new Set<number>();
    Object.entries(selectedByGroup).forEach(([gid, set]) => {
      if (!selectedGroup || gid !== selectedGroup.id) {
        set.forEach((i) => others.add(i));
      }
    });

    return {
      ownerIdByIndex: ownerId,
      ownerNameByIndex: ownerName,
      ownerColorByIndex: ownerColor,
      otherGroupsSelected: others,
    };
  }, [selectedByGroup, selectedGroup, groups]);

  const toggleWell = (idx: number) => {
    if (!selectedGroup) return;

    const currentOwner = ownerIdByIndex[idx];
    if (currentOwner && currentOwner !== selectedGroup.id) {
      return;
    }

    setSelectedByGroup((prev) => {
      const currSet = new Set(prev[selectedGroup.id] ?? []);
      if (currSet.has(idx)) currSet.delete(idx);
      else currSet.add(idx);
      return { ...prev, [selectedGroup.id]: currSet };
    });
  };

  /** Build and download a concurrent, template-based Arduino sketch (.ino). */
  const exportIno = () => {
    // Collect and normalize the UI data
    const serialGroups = groups.map((g) => {
      const wells = Array.from(selectedByGroup[g.id] ?? []).sort((a, b) => a - b);
      const rawSteps = stepsByGroup[g.id] ?? [];
      const steps = rawSteps.map((s) => ({
        on: Math.max(Number(s.secondsOn || "0"), 0),
        off: Math.max(Number(s.secondsOff || "0"), 0),
        intensity: Math.min(Math.max(Math.round(Number(s.intensity || "0")), 0), 4095),
        repeats: Math.max(Math.round(Number(s.repeats || "1")), 1),
      }));
      return { wells, steps };
    });

    const numGroups = serialGroups.length;

    // Flatten wells and offsets
    const wellOffsets: number[] = [0];
    const wellsFlat: number[] = [];
    for (const g of serialGroups) {
      wellsFlat.push(...g.wells);
      wellOffsets.push(wellsFlat.length);
    }

    // Flatten steps and offsets
    const stepOffsets: number[] = [0];
    type StepOut = { on: number; off: number; intensity: number; repeats: number };
    const stepsFlat: StepOut[] = [];
    for (const g of serialGroups) {
      stepsFlat.push(...g.steps);
      stepOffsets.push(stepsFlat.length);
    }

    // Emit C arrays
    const dataLines: string[] = [];
    dataLines.push(`#define NUM_GROUPS ${numGroups}`);
    dataLines.push(``);

    // Wells
    dataLines.push(`// Flattened wells for all groups`);
    dataLines.push(
      wellsFlat.length
        ? `const uint16_t WELLS_FLAT[] = { ${wellsFlat.join(", ")} };`
        : `const uint16_t WELLS_FLAT[] = { /* empty */ };`
    );
    dataLines.push(
      `const uint32_t WELL_OFFSETS[NUM_GROUPS + 1] = { ${wellOffsets.join(", ")} };`
    );
    dataLines.push(``);

    // Steps
    dataLines.push(`// Flattened steps for all groups`);
    if (stepsFlat.length) {
      const stepRows = stepsFlat
        .map(
          (s) =>
            `{ ${s.on.toFixed(3)}f, ${s.off.toFixed(3)}f, ${s.intensity}, ${s.repeats} }`
        )
        .join(",\n  ");
      dataLines.push(`const Step STEPS_FLAT[] = {\n  ${stepRows}\n};`);
    } else {
      dataLines.push(`const Step STEPS_FLAT[] = { /* empty */ };`);
    }
    dataLines.push(
      `const uint32_t STEP_OFFSETS[NUM_GROUPS + 1] = { ${stepOffsets.join(", ")} };`
    );
    dataLines.push(``);

    const ino = INO_TEMPLATE_PREFIX + dataLines.join("\n") + INO_TEMPLATE_SUFFIX;

    // Download
    const blob = new Blob([ino], { type: "text/x-arduino" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "WellPlateConcurrent.ino";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="overflow-x-auto">
          <div className="grid gap-6 grid-cols-[minmax(28rem,1.6fr)_minmax(20rem,1fr)] min-w-[52rem]">
            {/* Left column */}
            <div className="grid grid-rows-2 gap-6 min-h-[70vh]">
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  {selectedGroup && (
                    <span
                      aria-hidden
                      className="inline-block size-3 rounded-full ring-2"
                      style={{
                        backgroundColor: selectedGroup.color,
                        boxShadow: `0 0 0 2px ${selectedGroup.color}44`,
                      }}
                    />
                  )}
                  <h2 className="text-xl font-semibold">Select Wells</h2>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedGroup ? `for ${selectedGroup.name}` : "No group selected"}
                </p>

                <WellPlate96
                  selectedGroup={selectedGroup}
                  currentColor={selectedGroup?.color}
                  selected={selectedSet}
                  dimmed={otherGroupsSelected}
                  ownerNameByIndex={ownerNameByIndex}
                  ownerColorByIndex={ownerColorByIndex}
                  onToggle={toggleWell}
                />
              </section>

              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <GroupList
                  groups={groups}
                  selectedId={selectedId}
                  onAdd={addGroup}
                  onSelect={selectGroup}
                  onRemove={removeGroup}
                />
              </section>
            </div>

            {/* Right column */}
            <aside className="rounded-2xl border bg-white p-6 shadow-sm min-h-[70vh]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-lg font-semibold">Program Sequence</div>
                <button
                  type="button"
                  onClick={exportIno}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  title="Export Arduino sketch"
                >
                  Export .ino
                </button>
              </div>

              <SequenceList
                selectedGroup={selectedGroup}
                steps={stepsForSelected}
                setSteps={setStepsForSelected}
              />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
};

export default App;
