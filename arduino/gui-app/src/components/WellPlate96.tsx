import plateUrl from "../assets/96-Well_plate_blank.svg?url";
import type { Group } from "./GroupListTypes";
import { useState, useRef, useCallback } from "react";

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
    onBulkToggle?: (indices: number[], add: boolean) => void;
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
    onBulkToggle,
}: WellPlate96Props) => {
    const canEdit = Boolean(selectedGroup);
    
    // Simple drag selection state
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null);
    const [dragEnd, setDragEnd] = useState<{ col: number; row: number } | null>(null);
    const [dragMode, setDragMode] = useState<'select' | 'unselect' | null>(null);
    const [hasMoved, setHasMoved] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);


    // Convert grid position to well index
    const getWellIndex = (col: number, row: number) => {
        if (col < 0 || col >= 12 || row < 0 || row >= 8) return -1;
        return col * 8 + row;
    };

    // Get wells in drag rectangle
    const getWellsInRect = useCallback(() => {
        if (!dragStart || !dragEnd) return [];
        
        const minCol = Math.min(dragStart.col, dragEnd.col);
        const maxCol = Math.max(dragStart.col, dragEnd.col);
        const minRow = Math.min(dragStart.row, dragEnd.row);
        const maxRow = Math.max(dragStart.row, dragEnd.row);
        
        const wells: number[] = [];
        for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
                const index = getWellIndex(col, row);
                if (index >= 0) wells.push(index);
            }
        }
        return wells;
    }, [dragStart, dragEnd]);

    // Handle mouse down
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!canEdit || !containerRef.current) return;
        
        // Prevent right-click context menu
        e.preventDefault();
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate grid position based on actual layout
        // Account for padding: 38px left, 37px right, 26px top/bottom
        const gridX = x - 38; // Subtract left padding
        const gridY = y - 26; // Subtract top padding
        
        // Calculate available grid area
        const gridWidth = rect.width - 38 - 37; // Total width minus left and right padding
        const gridHeight = rect.height - 26 - 26; // Total height minus top and bottom padding
        
        // Calculate cell dimensions
        const cellWidth = gridWidth / 12; // 12 columns
        const cellHeight = gridHeight / 8; // 8 rows
        
        // Calculate which cell the mouse is in
        const col = Math.floor(gridX / cellWidth);
        const row = Math.floor(gridY / cellHeight);
        
        if (col >= 0 && col < 12 && row >= 0 && row < 8) {
            const wellIndex = getWellIndex(col, row);
            if (wellIndex >= 0) {
                // Determine drag mode based on mouse button
                if (e.button === 0) { // Left click
                    setDragMode('select');
                } else if (e.button === 2) { // Right click
                    setDragMode('unselect');
                } else {
                    return; // Middle click or other buttons
                }
                
                // Initialize drag state but don't start dragging yet
                setDragStart({ col, row });
                setDragEnd({ col, row });
                setHasMoved(false);
                
                // Don't call onToggle here - wait to see if it becomes a drag
            }
        }
    }, [canEdit]);

    // Handle mouse move
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragStart || !containerRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate grid position based on actual layout
        const gridX = x - 38; // Subtract left padding
        const gridY = y - 26; // Subtract top padding
        
        // Calculate available grid area
        const gridWidth = rect.width - 38 - 37; // Total width minus left and right padding
        const gridHeight = rect.height - 26 - 26; // Total height minus top and bottom padding
        
        // Calculate cell dimensions
        const cellWidth = gridWidth / 12; // 12 columns
        const cellHeight = gridHeight / 8; // 8 rows
        
        // Calculate which cell the mouse is in
        const col = Math.floor(gridX / cellWidth);
        const row = Math.floor(gridY / cellHeight);
        
        if (col >= 0 && col < 12 && row >= 0 && row < 8) {
            // Check if we've moved to a different cell
            if (col !== dragStart.col || row !== dragStart.row) {
                if (!hasMoved) {
                    setHasMoved(true);
                    setIsDragging(true);
                }
                setDragEnd({ col, row });
            }
        }
    }, [dragStart, hasMoved]);

    // Handle mouse up
    const handleMouseUp = useCallback(() => {
        if (!dragStart || !dragMode) return;
        
        if (isDragging) {
            // This was a drag operation
            const wells = getWellsInRect();
            if (wells.length > 0 && onBulkToggle) {
                const isAdding = dragMode === 'select';
                onBulkToggle(wells, isAdding);
            }
        } else {
            // This was a single click - toggle the well
            const wellIndex = getWellIndex(dragStart.col, dragStart.row);
            if (wellIndex >= 0) {
                onToggle(wellIndex);
            }
        }
        
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setDragMode(null);
        setHasMoved(false);
    }, [dragStart, isDragging, dragMode, getWellsInRect, onBulkToggle, onToggle]);

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
                ref={containerRef}
                className="absolute inset-0 grid grid-cols-12 grid-rows-8 grid-flow-col p-[6%]"
                style={{
                    paddingTop: "26px",
                    paddingBottom: "26px",
                    paddingLeft: "38px",
                    paddingRight: "37px",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            >
                {Array.from({ length: 96 }, (_, i) => {
                    const isSelected = selected.has(i);
                    const isDimmed = !isSelected && dimmed.has(i);
                    const clickable = canEdit && !isDimmed;
                    
                    // Check if this well is in the drag selection
                    const dragWells = isDragging ? getWellsInRect() : [];
                    const isInDragSelection = dragWells.includes(i);

                    const ownerColor = ownerColorByIndex[i] || "#64748b";

                    // Visuals
                    let background: string = FREE_BG;
                    let boxShadow: string = FREE_RING;
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
                    } else if (isInDragSelection) {
                        // Well is in drag selection
                        if (dragMode === 'select') {
                            const tint = hexToRgba(currentColor, 0.2);
                            const ring = hexToRgba(currentColor, 0.6);
                            background = `radial-gradient(closest-side, ${tint}, ${hexToRgba(currentColor, 0.1)} 55%, rgba(255,255,255,0.8))`;
                            boxShadow = `0 0 0 2px ${ring}, 0 1px 2px rgba(2,6,23,0.08)`;
                            ariaLabel += " (will be selected)";
                        } else if (dragMode === 'unselect') {
                            const tint = hexToRgba('#ef4444', 0.2);
                            const ring = hexToRgba('#ef4444', 0.6);
                            background = `radial-gradient(closest-side, ${tint}, ${hexToRgba('#ef4444', 0.1)} 55%, rgba(255,255,255,0.8))`;
                            boxShadow = `0 0 0 2px ${ring}, 0 1px 2px rgba(2,6,23,0.08)`;
                            ariaLabel += " (will be unselected)";
                        }
                    }

                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={!clickable}
                            aria-pressed={isSelected}
                            aria-label={ariaLabel}
                            onContextMenu={(e) => e.preventDefault()}
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
