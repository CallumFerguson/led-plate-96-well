import type { Group } from "./GroupListTypes";

export type GroupListProps = {
  groups: Group[];
  selectedId: string | null;
  onAdd: () => void;
  onSelect: (groupId: string) => void;
  onRemove: (groupId: string) => void;
  className?: string;
};

export default function GroupList({
  groups,
  selectedId,
  onAdd,
  onSelect,
  onRemove,
  className = "",
}: GroupListProps) {
  return (
    <div className={`flex h-full flex-col ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Groups</h3>
        <button
          onClick={onAdd}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          type="button"
        >
          Add group
        </button>
      </div>

      {/* Scrolls when there are many groups */}
      <div
        role="listbox"
        aria-label="Groups"
        className="min-h-0 flex-1 overflow-auto rounded-xl border"
      >
        {groups.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No groups yet.</div>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => {
              const isSelected = g.id === selectedId;
              return (
                <li key={g.id}>
                  <button
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => onSelect(g.id)}
                    className={[
                      "group grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 text-left focus:outline-none",
                      isSelected ? "bg-gray-100" : "hover:bg-gray-50",
                    ].join(" ")}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="inline-block size-3 rounded-full ring-2"
                        style={{
                          backgroundColor: g.color,
                          boxShadow: isSelected
                            ? `0 0 0 3px ${g.color}44`
                            : `0 0 0 2px ${g.color}44`,
                        }}
                      />
                      <span className="font-medium">{g.name}</span>
                    </div>

                    {/* Remove button (doesn't trigger selection) */}
                    <div className="justify-self-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(g.id);
                        }}
                        className="rounded-md border px-2.5 py-1 text-xs hover:bg-gray-50"
                        aria-label={`Remove ${g.name}`}
                        title="Remove group"
                      >
                        Remove
                      </button>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
