import { useState } from "react";

export type Group = {
    id: string;
    name: string;
};

export type GroupListProps = {
    onSelect?: (group: Group) => void;
    className?: string;
};

const uid = (): string =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function GroupList({ onSelect, className = "" }: GroupListProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const addGroup = () => {
        const newGroup: Group = { id: uid(), name: `Group ${groups.length + 1}` };
        setGroups((prev) => [...prev, newGroup]);
        setSelectedId(newGroup.id);
        onSelect?.(newGroup);
    };

    const select = (g: Group) => {
        setSelectedId(g.id);
        onSelect?.(g);
    };

    return (
        <div className={`flex h-full flex-col ${className}`}>
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Groups</h3>
                <button
                    onClick={addGroup}
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                    type="button"
                >
                    Add group
                </button>
            </div>

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
                                        onClick={() => select(g)}
                                        className={[
                                            "block w-full text-left px-3 py-2",
                                            isSelected
                                                ? "bg-blue-50 ring-2 ring-blue-400"
                                                : "hover:bg-gray-50",
                                            "focus:outline-none",
                                        ].join(" ")}
                                        type="button"
                                    >
                                        {g.name}
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
