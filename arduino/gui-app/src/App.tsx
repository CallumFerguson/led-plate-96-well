import "./App.css";
import WellPlate96 from "./components/WellPlate96";
import GroupList from "./components/GroupList";
import type { Group } from "./components/GroupListTypes";
import { useMemo, useState } from "react";
import SequenceList from "./components/SequenceList";

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

/** Get the smallest available "Group N" name (N starts at 1) that isn't taken. */
function nextGroupName(existing: Group[]): string {
  const used = new Set(existing.map((g) => g.name));
  let n = 1;
  while (used.has(`Group ${n}`)) n++;
  return `Group ${n}`;
}

/**
 * Choose a color such that:
 * 1) Prefer a palette color not currently used by any existing group (no duplicates until all colors used).
 * 2) If all palette colors are already used, choose the least-used color to balance duplicates.
 * When a group is removed, its color becomes immediately available again due to (1).
 */
function nextGroupColor(existing: Group[], palette: string[]): string {
  const used = new Set(existing.map((g) => g.color));

  // Prefer completely unused (by current groups) colors.
  for (const c of palette) {
    if (!used.has(c)) return c;
  }

  // All colors are currently in use: choose the least-used color.
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

const App = () => {
  // Groups (owned here so color can be shared globally)
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId]
  );

  // Per-group selected wells: groupId -> Set of well indices (0..95)
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, Set<number>>>({});

  const addGroup = () => {
    const g: Group = {
      id: uid(),
      name: nextGroupName(groups),
      color: nextGroupColor(groups, PALETTE),
    };
    setGroups((prev) => [...prev, g]);
    setSelectedId(g.id);
  };

  // Toggle selection: clicking an already-selected group unselects it
  const selectGroup = (groupId: string) => {
    setSelectedId((curr) => (curr === groupId ? null : groupId));
  };

  // Remove a group and its well selections; unselect if it was selected
  const removeGroup = (groupId: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setSelectedByGroup((prev) => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
    setSelectedId((curr) => (curr === groupId ? null : curr));
  };

  // Convenience: selection for the currently selected group
  const selectedSet = useMemo(
    () =>
      selectedGroup
        ? selectedByGroup[selectedGroup.id] ?? new Set<number>()
        : new Set<number>(),
    [selectedGroup, selectedByGroup]
  );

  // Build index -> owner group id/name/color maps, plus sets for 'dimmed' (other groups)
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

    // Wells selected by any group that is NOT the currently selected group
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
    // Disallow selecting a well already owned by a different group
    if (currentOwner && currentOwner !== selectedGroup.id) {
      return; // silently ignore; you can add a toast if desired
    }

    setSelectedByGroup((prev) => {
      const currSet = new Set(prev[selectedGroup.id] ?? []);
      if (currSet.has(idx)) currSet.delete(idx);
      else currSet.add(idx);
      return { ...prev, [selectedGroup.id]: currSet };
    });
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
              {/* Scrolls when there are many steps */}
              <SequenceList selectedGroup={selectedGroup} />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
};

export default App;
