import './App.css';
import "./components/WellPlate96"
import WellPlate96 from './components/WellPlate96';
import GroupList from "./components/GroupList";
import type { Group } from "./components/GroupList";

const App = () => {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        <div className="overflow-x-auto">
          <div className="grid gap-6 grid-cols-[minmax(28rem,1.6fr)_minmax(20rem,1fr)] min-w-[52rem]">

            {/* Left column with two big rows */}
            <div className="grid grid-rows-2 gap-6 min-h-[70vh]">
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Select Wells</h2>
                <p className="text-sm text-gray-600">for group {/* put group number here */}</p>
                < WellPlate96 />
              </section>

              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <GroupList onSelect={(g: Group) => console.log("Selected group:", g)} />
              </section>
            </div>

            {/* Right column */}
            <aside className="rounded-2xl border bg-white p-6 shadow-sm min-h-[70vh]">
              <h2 className="text-xl font-semibold">Right Column</h2>
              <p className="text-sm text-gray-600">Sidebar/details go here…</p>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
