// App.tsx
import './App.css';
import WellPlate96 from './components/WellPlate96';
import GroupList from "./components/GroupList";
import type { Group } from "./components/GroupList";
import { useState } from "react";
import SequenceList from "./components/SequenceList"; // <-- add

const App = () => {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

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
                  for {selectedGroup ? selectedGroup.name : "no group selected"}
                </p>
                <WellPlate96 />
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
