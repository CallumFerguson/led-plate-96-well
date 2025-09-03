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
  - Uses ms on/off and per-step loop_duration_ms (0 = forever)
  - Runs ALL GROUPS CONCURRENTLY (no delay()) using your sequenceIntensity()
*/

#include "Adafruit_TLC5947.h"

#define PIN_DATA 3
#define PIN_CLOCK 5
#define PIN_LATCH 9
#define PIN_BLANK 6

#define NUM_TLC5947 4
constexpr uint16_t NUM_CHANNELS = NUM_TLC5947 * 24;

Adafruit_TLC5947 tlc(NUM_TLC5947, PIN_CLOCK, PIN_DATA, PIN_LATCH);

struct SequenceStep
{
    uint32_t on_ms;            // ON window length
    uint32_t off_ms;           // OFF window length
    uint16_t intensity;        // value to return while ON
    uint32_t loop_duration_ms; // duration to run this step (0 = forever)
};

// Returns current intensity for the sequence.
// - 0 if we're in an OFF window or sequence has ended
// - step.intensity if we're in an ON window
// Safe across millis() rollover.
uint16_t sequenceIntensity(const SequenceStep *steps, size_t count)
{
    uint32_t elapsed = millis(); // rollover-safe elapsed time

    // Walk through steps, subtracting their durations until we find the active one.
    for (size_t i = 0; i < count; ++i)
    {
        const SequenceStep &s = steps[i];
        uint32_t dur = s.loop_duration_ms;

        // If this step is infinite or the remaining time falls within this step, evaluate it.
        if (dur == 0 || elapsed < dur)
        {
            // Edge cases
            if (s.intensity == 0)
                return 0; // explicitly off
            if (s.on_ms == 0)
                return 0; // never turns on
            if (s.off_ms == 0)
                return s.intensity; // always on within this step

            // Regular blinking within the step
            uint64_t period = (uint64_t)s.on_ms + (uint64_t)s.off_ms; // avoid overflow
            if (period == 0)
                return 0; // both zero -> off

            uint64_t phase = (uint64_t)elapsed % period;
            return (phase < s.on_ms) ? s.intensity : 0;
        }

        // Otherwise, move to the next step
        elapsed -= dur;
    }

    // Past the end of all steps -> off
    return 0;
}

// =========================
// ===== START GENERATED CODE =====
// (the exporter injects wellGroup and per-group sequences here)
`;

const INO_TEMPLATE_SUFFIX = String.raw`
// ===== END GENERATED CODE =====
// ===========================

constexpr int numGroups =
#if defined(NUM_GROUPS_EXPORTED_LITERAL)
NUM_GROUPS_EXPORTED_LITERAL;
#else
0;
#endif

void setup()
{
    Serial.begin(115200);

    /*
        The TLC5947 BLANK pin keeps all the LEDs off when it is high. The board has
        a pull up resistor on the BLANK pin so the LEDs will be off by default. It is
        important to set all the LEDs to 0 intensity before setting the BLANK pin to
        low so the LEDs do not flash on during start up.
    */

    // turn all LEDs off
    tlc.begin();
    for (uint16_t i = 0; i < NUM_CHANNELS; i++)
    {
        tlc.setPWM(i, 0);
    }
    tlc.write();

    // set blank pin to low
    pinMode(PIN_BLANK, OUTPUT);
    digitalWrite(PIN_BLANK, LOW);
}

unsigned long lastReportMs = 0;
unsigned long loopCount = 0;

void loop()
{
    loopCount++;

    unsigned long now = millis();
    if (now - lastReportMs >= 1000)
    {
        float hz = (loopCount * 1000.0f) / (now - lastReportMs);
        Serial.print(F("loop() ≈ "));
        Serial.print(hz, 1);
        Serial.println(F(" Hz"));
        loopCount = 0;
        lastReportMs = now;
    }

    for (int group = 0; group < numGroups; group++)
    {
        uint16_t intensity = sequenceIntensity(groupSequences[group], groupSequenceStepCount[group]);
        for (uint16_t well = 0; well < NUM_CHANNELS; well++)
        {
            if (wellGroup[well] == group)
            {
                tlc.setPWM(well, intensity);
            }
        }
    }

    tlc.write();
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
  for (const c of palette) if (!used.has(c)) return c;

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

  // Per-group sequence steps for export (now ms-based)
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
        ? (selectedByGroup[selectedGroup.id] ?? new Set<number>())
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
    if (currentOwner && currentOwner !== selectedGroup.id) return;

    setSelectedByGroup((prev) => {
      const currSet = new Set(prev[selectedGroup.id] ?? []);
      if (currSet.has(idx)) currSet.delete(idx);
      else currSet.add(idx);
      return { ...prev, [selectedGroup.id]: currSet };
    });
  };

  /** Build and download a concurrent, template-based Arduino sketch (.ino). */
  const exportIno = () => {
    // Collect + normalize UI data (ms-based)
    const serialGroups = groups.map((g, gi) => {
      const wells = Array.from(selectedByGroup[g.id] ?? []).sort((a, b) => a - b);
      const rawSteps = stepsByGroup[g.id] ?? [];
      const steps = rawSteps.map((s) => ({
        on_ms: toInt(s.msOn, 0, 0xffffffff),
        off_ms: toInt(s.msOff, 0, 0xffffffff),
        intensity: toInt(s.intensity, 0, 4095),
        loop_duration_ms: toInt(s.loopDurationMs, 0, 0xffffffff), // 0 = forever
      }));
      return { wells, steps, index: gi };
    });

    const NUM_CHANNELS = 96; // 4 TLC5947 * 24 channels each

    // Build wellGroup: initialize to -1
    const wellGroup: number[] = Array(NUM_CHANNELS).fill(-1);
    serialGroups.forEach((g, gi) => {
      g.wells.forEach((idx) => {
        if (idx >= 0 && idx < NUM_CHANNELS) wellGroup[idx] = gi;
      });
    });

    const groupsCount = serialGroups.length;

    // Emit the generated code section
    const lines: string[] = [];

    // NUM_GROUPS literal (used to set numGroups via macro trick in the suffix)
    lines.push(`#define NUM_GROUPS_EXPORTED_LITERAL ${groupsCount}`);
    lines.push(``);

    // wellGroup array (pretty-print in rows of 8)
    lines.push(`int8_t wellGroup[NUM_CHANNELS] = {`);
    for (let i = 0; i < NUM_CHANNELS; i += 8) {
      const row = wellGroup.slice(i, i + 8).join(", ");
      lines.push(`    ${row}${i + 8 < NUM_CHANNELS ? "," : ""}`);
    }
    lines.push(`};`);
    lines.push(``);

    // Per-group SequenceStep arrays
    serialGroups.forEach((g, gi) => {
      if (g.steps.length > 0) {
        lines.push(`static const SequenceStep group${gi}SequenceSteps[] = {`);
        g.steps.forEach((st, si) => {
          lines.push(
            `    { ${st.on_ms}, ${st.off_ms}, ${st.intensity}, ${st.loop_duration_ms} }${si + 1 < g.steps.length ? "," : ""}`
          );
        });
        lines.push(`};`);
      } else {
        // No steps for this group -> we'll map to NULL in groupSequences
        lines.push(`// group${gi} has no steps`);
      }
    });
    lines.push(``);

    // Counts
    {
      const counts = serialGroups.map((g) => g.steps.length);
      const size = Math.max(1, groupsCount);
      const payload =
        groupsCount === 0 ? "0" : counts.join(", ");
      lines.push(
        `static const uint8_t groupSequenceStepCount[${size}] = { ${payload} };`
      );
    }

    // Pointers array
    {
      const size = Math.max(1, groupsCount);
      const entries =
        groupsCount === 0
          ? "NULL"
          : serialGroups
            .map((g, gi) =>
              g.steps.length > 0
                ? `group${gi}SequenceSteps`
                : `NULL`
            )
            .join(", ");
      lines.push(
        `static const SequenceStep *const groupSequences[${size}] = { ${entries} };`
      );
    }

    const ino = INO_TEMPLATE_PREFIX + lines.join("\n") + INO_TEMPLATE_SUFFIX;

    // Download
    const blob = new Blob([ino], { type: "text/x-arduino" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "WellPlate_ms_template.ino";
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
