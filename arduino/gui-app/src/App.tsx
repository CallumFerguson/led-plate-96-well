// App.tsx
import "./App.css";
import WellPlate96 from "./components/WellPlate96";
import GroupList from "./components/GroupList";
import type { Group } from "./components/GroupList";
import { useMemo, useState } from "react";
import SequenceList from "./components/SequenceList";

const App = () => {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Per-group selected wells: groupId -> Set of well indices (0..95)
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, Set<number>>>({});

  // Convenience: selection for the currently selected group
  const selectedSet = useMemo(
    () => (selectedGroup ? (selectedByGroup[selectedGroup.id] ?? new Set<number>()) : new Set<number>()),
    [selectedGroup, selectedByGroup]
  );

  // Build index -> owner group id/name maps, plus sets for 'dimmed' (other groups)
  const { ownerIdByIndex, ownerNameByIndex, otherGroupsSelected } = useMemo(() => {
    const ownerId: Record<number, string> = {};
    const ownerName: Record<number, string> = {};
    Object.entries(selectedByGroup).forEach(([gid, set]) => {
      set.forEach((i) => {
        ownerId[i] = gid;
      });
    });

    // You may have access to group names inside GroupList; if not, we'll only show the ID.
    // We'll try to infer the selectedGroup name for current; others default to their id.
    // (If you keep a list of groups in App later, populate names here.)
    Object.entries(selectedByGroup).forEach(([gid, set]) => {
      set.forEach((i) => {
        ownerName[i] = gid; // fallback to id; GroupList could expose names later
      });
    });

    // Wells selected by any group that is NOT the currently selected group
    const others = new Set<number>();
    Object.entries(selectedByGroup).forEach(([gid, set]) => {
      if (!selectedGroup || gid !== selectedGroup.id) {
        set.forEach((i) => others.add(i));
      }
    });

    return { ownerIdByIndex: ownerId, ownerNameByIndex: ownerName, otherGroupsSelected: others };
  }, [selectedByGroup, selectedGroup]);

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
                <h2 className="text-xl font-semibold">Select Wells</h2>
                <p className="text-sm text-gray-600">
                  {selectedGroup ? `for ${selectedGroup.name}` : "No group selected"}
                </p>

                <WellPlate96
                  selectedGroup={selectedGroup}
                  selected={selectedSet}
                  dimmed={otherGroupsSelected}
                  ownerNameByIndex={ownerNameByIndex}
                  onToggle={toggleWell}
                />
              </section>

              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <GroupList onSelect={setSelectedGroup} />
              </section>
            </div>

            {/* Right column */}
            <aside className="rounded-2xl border bg-white p-6 shadow-sm min-h-[70vh]">
              <SequenceList selectedGroup={selectedGroup} />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
};

export default App;
