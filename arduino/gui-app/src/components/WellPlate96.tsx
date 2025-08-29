import plateUrl from "../assets/96-Well_plate_blank.svg?url";
import type { Group } from "./GroupListTypes";

function hexToRgba(hex: string, alpha: number) {
    const v = hex.replace("#", "");
    const bigint = parseInt(v.length === 3 ? v.split("").map(c => c + c).join("") : v, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type WellPlate96Props = {
    selectedGroup: Group | null;
    currentColor?: string;
    selected: Set<number>;
    dimmed: Set<number>;
    ownerNameByIndex?: Record<number, string | undefined>;
    ownerColorByIndex?: Record<number, string | undefined>;
    onToggle: (index: number) => void;
};

const FREE_RING = "0 0 0 2px rgba(15,23,42,0.28), inset 0 0 0 1px rgba(255,255,255,0.6), 0 1px 2px rgba(2,6,23,0.06)";
const FREE_BG = "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0.75) 60%, rgba(255,255,255,0.55))";


const WellPlate96 = ({
    selectedGroup,
    currentColor = "#2563eb",
    selected,
    dimmed,
    ownerNameByIndex = {},
    ownerColorByIndex = {},
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
                    const isSelected = selected.has(i);
                    const isDimmed = !isSelected && dimmed.has(i);
                    const clickable = canEdit && !isDimmed;

                    const ownerColor = ownerColorByIndex[i] || "#64748b";

                    // Visuals
                    let background: string;
                    let boxShadow: string;
                    let ariaLabel = `Well ${i + 1}`;

                    if (isSelected) {
                        const tint = hexToRgba(currentColor, 0.28);
                        const ringStrong = hexToRgba(currentColor, 0.9);
                        const outerGlow = hexToRgba(currentColor, 0.18);

                        background = `radial-gradient(closest-side, ${hexToRgba(currentColor, 0.22)}, ${tint} 55%, ${hexToRgba(
                            currentColor,
                            0.12
                        )})`;
                        boxShadow = `0 0 0 2px ${ringStrong}, 0 0 0 6px ${outerGlow}, 0 1px 2px rgba(2,6,23,0.10)`;
                        ariaLabel += " (in current group)";
                    } else if (isDimmed) {
                        const tint = hexToRgba(ownerColor, 0.18);
                        const ring = hexToRgba(ownerColor, 0.4);
                        background = `radial-gradient(closest-side, ${tint}, ${hexToRgba(ownerColor, 0.12)} 55%, rgba(255,255,255,0.6))`;
                        boxShadow = `0 0 0 1px ${ring}, 0 1px 2px rgba(2,6,23,0.04)`;
                        ariaLabel += ` (already in ${ownerNameByIndex[i] ?? "another group"})`;
                    } else {
                        // Free, unselected well
                        background = FREE_BG;
                        boxShadow = FREE_RING;
                    }

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!clickable}
                            aria-pressed={isSelected}
                            aria-label={ariaLabel}
                            onClick={() => clickable && onToggle(i)}
                            className={[
                                "place-self-center w-[31px] h-[31px] rounded-full transition",
                                clickable ? "cursor-pointer hover:brightness-105" : "cursor-not-allowed opacity-85",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-black/20",
                            ].join(" ")}
                            style={{ background, boxShadow }}
                            title={ariaLabel}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default WellPlate96;
