import { useMemo } from 'react';
import type React from 'react';
import plateUrl from '../assets/96-Well_plate.svg?url';

type Padding =
    | number
    | {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
    };

export type WellPlate96Props = {
    /** % inset from each edge (uniform number or per-side object).
        Per-side props (padTop/Right/Bottom/Left) override this if provided. */
    padding?: Padding;
    /** Explicit per-side padding overrides in % (take precedence if set). */
    padTop?: number;
    padRight?: number;
    padBottom?: number;
    padLeft?: number;

    /** circle diameter in px */
    circlePx?: number;
    /** extra horizontal spacing between wells in px (fine-tunes column spacing) */
    colGapPx?: number;
    /** extra vertical spacing between wells in px (fine-tunes row spacing) */
    rowGapPx?: number;
    /** tiny global horizontal offset of the whole overlay, in % of its own size (positive = right) */
    nudgeXPct?: number;
    /** tiny global vertical offset of the whole overlay, in % of its own size (positive = down) */
    nudgeYPct?: number;
    /** non-uniform stretch of the overlay grid if the printed grid isn't perfectly square */
    scaleX?: number;
    scaleY?: number;

    /** set true to show A1..H12 */
    showLabels?: boolean;
    /** e.g., "w-full max-w-3xl" */
    className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const WellPlate96 = ({
    /* ─────────────────────────────────────────────────────────────
       QUICK ALIGNMENT KNOBS
  
       • padTop / padRight / padBottom / padLeft  → % per-side insets
         (use these first; they override `padding` if set).
       • circlePx                                → marker size (px)
       • colGapPx / rowGapPx                     → inter-well spacing (px)
       • nudgeXPct / nudgeYPct                   → tiny global shift (%)
       • scaleX / scaleY                         → slight stretch/squash
       ──────────────────────────────────────────────────────────── */
    padding = 6,
    padTop = 20,
    padRight,
    padBottom,
    padLeft,

    circlePx = 18,
    colGapPx = 0,
    rowGapPx = 0,
    nudgeXPct = 0,
    nudgeYPct = 0,
    scaleX = 1,
    scaleY = 1,

    showLabels = false,
    className = '',
    ...rest
}: WellPlate96Props) => {
    const rows = 8;
    const cols = 12;

    // Resolve padding: start from `padding`, then override with explicit per-side props if present
    const pad = useMemo(() => {
        const base =
            typeof padding === 'number'
                ? { top: padding, right: padding, bottom: padding, left: padding }
                : {
                    top: padding.top ?? 6,
                    right: padding.right ?? 6,
                    bottom: padding.bottom ?? 6,
                    left: padding.left ?? 6,
                };

        return {
            top: padTop ?? base.top,
            right: padRight ?? base.right,
            bottom: padBottom ?? base.bottom,
            left: padLeft ?? base.left,
        };
    }, [padding, padTop, padRight, padBottom, padLeft]);

    const wells = useMemo(
        () =>
            Array.from({ length: rows * cols }, (_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                return { id: `${String.fromCharCode(65 + r)}${c + 1}` }; // A1..H12
            }),
        []
    );

    // Scale label to circle size (keeps labels readable if you tweak circlePx)
    const labelFontPx = Math.max(9, Math.round(circlePx * 0.55));

    return (
        <div className={`relative inline-block ${className}`} {...rest}>
            {/* Base image */}
            <img
                src={plateUrl}
                alt="96-well plate"
                className="block select-none pointer-events-none max-w-full h-auto"
                draggable={false}
                loading="lazy"
            />

            {/* Overlay grid of 96 circles */}
            <div
                className="absolute grid"
                style={{
                    top: `${pad.top}%`,
                    right: `${pad.right}%`,
                    bottom: `${pad.bottom}%`,
                    left: `${pad.left}%`,
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                    placeItems: 'center',
                    columnGap: colGapPx,
                    rowGap: rowGapPx,
                    transform: `translate(${nudgeXPct}%, ${nudgeYPct}%) scale(${scaleX}, ${scaleY})`,
                    transformOrigin: 'center',
                }}
                aria-label="96-well overlay"
            >
                {wells.map((w) => (
                    <div key={w.id} className="flex items-center justify-center">
                        <div
                            className="rounded-full border border-blue-500/70 bg-blue-500/20 flex items-center justify-center"
                            style={{ width: circlePx, height: circlePx }}
                            title={w.id}
                        >
                            {showLabels && (
                                <span
                                    className="leading-none select-none"
                                    style={{ fontSize: labelFontPx }}
                                >
                                    {w.id}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WellPlate96;
