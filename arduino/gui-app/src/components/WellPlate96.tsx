// components/WellPlate96.tsx
import plateUrl from "../assets/96-Well_plate.svg?url";
import type { Group } from "./GroupList";

type WellPlate96Props = {
    /** Currently selected group (clicks disabled if null) */
    selectedGroup: Group | null;
    /** Set of selected indices (0..95) for the selected group */
    selected: Set<number>;
    /** Wells selected by other groups (dim highlight, non-clickable) */
    dimmed: Set<number>;
    /** Optional: map of well index -> owner name (used for title tooltips) */
    ownerNameByIndex?: Record<number, string | undefined>;
    /** Toggle handler for current group */
    onToggle: (index: number) => void;
};

const WellPlate96 = ({
    selectedGroup,
    selected,
    dimmed,
    ownerNameByIndex = {},
    onToggle,
}: WellPlate96Props) => {
    const canEdit = Boolean(selectedGroup);

    return (
        <div className="relative inline-block">
            <img
                src={plateUrl}
                alt="96-well plate"
                className="block select-none pointer-events-none max-w-full h-auto"
                draggable={false}
                loading="lazy"
            />

            {/* Overlay matches image size exactly */}
            <div
                className="absolute inset-0 grid grid-cols-12 grid-rows-8 grid-flow-col p-[6%]"
                style={{
                    paddingTop: "26px",
                    paddingBottom: "26px",
                    paddingLeft: "38px",
                    paddingRight: "37px",
                }}
            >
                {Array.from({ length: 96 }, (_, i) => {
                    const isSelected = selected.has(i);       // owned by current group
                    const isDimmed = !isSelected && dimmed.has(i); // owned by another group
                    const clickable = canEdit && !isDimmed;   // cannot click if owned by another group

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!clickable}
                            aria-pressed={isSelected}
                            onClick={() => clickable && onToggle(i)}
                            className={[
                                "place-self-center w-[31px] h-[31px] rounded-full transition",
                                // Visual states
                                isSelected
                                    ? "bg-blue-500/70 ring-2 ring-blue-500"
                                    : isDimmed
                                        ? "bg-blue-500/20 ring-1 ring-blue-400/25"
                                        : "bg-black/40 hover:bg-black/50",
                                clickable ? "cursor-pointer" : "cursor-not-allowed opacity-80",
                                "focus:outline-none focus:ring-2 focus:ring-blue-400",
                            ].join(" ")}
                            title={
                                isSelected
                                    ? `Well ${i + 1} (in current group)`
                                    : isDimmed
                                        ? `Well ${i + 1} (already in ${ownerNameByIndex[i] ?? "another group"})`
                                        : `Well ${i + 1}`
                            }
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default WellPlate96;
