import './App.css';

const App = () => {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl p-6">
        {/* Allow horizontal scroll on tiny screens instead of stacking */}
        <div className="overflow-x-auto">
          {/* Always 2 columns; give each a reasonable minimum width so they don't crush */}
          <div className="grid gap-6 grid-cols-[minmax(28rem,1.6fr)_minmax(20rem,1fr)] min-w-[52rem]">

            {/* Left column with two big rows */}
            <div className="grid grid-rows-2 gap-6 min-h-[70vh]">
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Top Left</h2>
                <p className="text-sm text-gray-600">Put your content here…</p>
              </section>

              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-xl font-semibold">Bottom Left</h2>
                <p className="text-sm text-gray-600">More content…</p>
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
