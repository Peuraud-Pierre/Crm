import type { KeyboardEvent, ReactNode } from "react"
import { Maximize2, Minus, Plus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { useSvgPanZoom } from "@/features/stock_handpick/hooks/ui/useSvgPanZoom"
import {
    PLAN_ROW_LABELS,
    isPalletShelf,
    isPlanShelf,
    rowBays,
    shelfLevels,
    PLAN_ZONES,
    shelfLevelKey,
    type PlanIndex,
    type PlanRow,
    type PlanShelf,
    type PlanSelection,
    type PlanZoneCode,
} from "@/features/stock_handpick/utils/planLayout"
import { bayRects, type FloorLayout } from "@/features/stock_handpick/utils/floorPlan"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { Fixture, RectShape, rotateAround } from "./PlanFixture"

interface PlanFloorProps {
    floor: FloorLayout
    index: PlanIndex
    ballesIn: (ids: readonly (string | undefined)[]) => BalleHandpick[]
    selection: PlanSelection | null
    onSelect: (selection: PlanSelection) => void
    /**
     * Faux en mode édition : travées et zones ne réagissent plus au clic, la
     * couche `overlay` prend la main.
     */
    interactive?: boolean
    /** Couche dessinée par-dessus le plan (poignées de l'éditeur). */
    overlay?: ReactNode
}

/** Marge autour du contour, en mètres. */
const PAD = 1
/** Tailles de texte, en mètres (unités du SVG). */
const TEXT = { zone: 1.6, label: 0.62, count: 0.7 }

const ZONE_FILL: Record<PlanZoneCode, string> = {
    B: "fill-muted",
    A: "fill-muted/60",
    D: "fill-background",
}

/**
 * Plan d'étage, relevé sur le tableau : racks en rouge, bureaux en bleu,
 * portes d'entrée et de sortie en noir.
 *
 * Chaque travée d'un rack adressable est cliquable et affiche son nombre de
 * balles ; un clic sur le nom d'une zone liste les balles de la zone.
 */
export function PlanFloor({
    floor,
    index,
    ballesIn,
    selection,
    onSelect,
    interactive = true,
    overlay,
}: PlanFloorProps) {
    const zoneCount = (zone: PlanZoneCode) => ballesIn(index.byZone.get(zone) ?? []).length
    const bayCount = (row: PlanRow, shelf: PlanShelf) =>
        ballesIn(
            shelfLevels(row, shelf).map((level) => index.byPath.get(shelfLevelKey(row, shelf, level))),
        ).length

    const activate = (selection: PlanSelection) => (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelect(selection)
        }
    }

    const outline = floor.outline.map(([x, z]) => `${x},${z}`).join(" ")
    const panZoom = useSvgPanZoom({
        x: -PAD,
        y: -PAD,
        w: floor.width + PAD * 2,
        h: floor.depth + PAD * 2.6,
    })

    return (
        <div
            className={cn(
                "relative space-y-3 rounded-2xl border bg-card p-3 transition-colors duration-base",
                panZoom.active ? "border-primary/60" : "border-border",
            )}
        >
            {/* Zoom : boutons, pincer au pavé tactile, deux doigts pour se déplacer. */}
            <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={panZoom.zoomIn} aria-label="Zoomer">
                    <Plus size={14} />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={panZoom.zoomOut} aria-label="Dézoomer">
                    <Minus size={14} />
                </Button>
                {panZoom.isZoomed && (
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={panZoom.reset} aria-label="Vue d'ensemble">
                        <Maximize2 size={13} />
                    </Button>
                )}
            </div>
            <svg
                ref={panZoom.svgRef}
                viewBox={panZoom.viewBox}
                className={cn(
                    "mx-auto h-auto w-full max-w-3xl",
                    (!interactive || panZoom.isZoomed) && "touch-none select-none",
                    panZoom.isZoomed && "cursor-grab",
                )}
                role="group"
                aria-label="Plan d'étage de l'entrepôt"
            >
                {/* Sol et murs */}
                <polygon points={outline} className="fill-background" />
                {(Object.keys(floor.zones) as PlanZoneCode[]).map((zone) => (
                    <RectShape key={zone} rect={floor.zones[zone]} className={ZONE_FILL[zone]} />
                ))}
                <polygon
                    points={outline}
                    className="fill-none stroke-muted-foreground"
                    strokeWidth={0.18}
                    strokeLinejoin="round"
                />

                {floor.innerWalls.map((wall) => (
                    <line
                        key={wall.id}
                        x1={wall.from[0]} y1={wall.from[1]} x2={wall.to[0]} y2={wall.to[1]}
                        className={wall.tone === "black" ? "stroke-foreground/70" : "stroke-muted-foreground"}
                        strokeWidth={wall.tone === "black" ? 0.2 : 0.14}
                    />
                ))}

                {floor.fixtures.map((fixture) => (
                    <Fixture key={fixture.id} fixture={fixture} />
                ))}

                {/* Bureaux — bleu */}
                {floor.offices.map((office) => (
                    <g key={office.id} transform={rotateAround(office.rect, office.rotation)}>
                        <RectShape
                            rect={office.rect}
                            className="fill-chart-2/20 stroke-chart-2"
                            strokeWidth={0.12}
                        />
                        <text
                            x={office.rect.x + office.rect.w / 2}
                            y={office.rect.z + office.rect.d / 2}
                            fontSize={TEXT.label}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="fill-chart-2 font-semibold"
                        >
                            {office.label}
                        </text>
                    </g>
                ))}

                {/* Racks — rouge. Hors édition, chaque travée est cliquable. */}
                <g pointerEvents={interactive ? undefined : "none"}>
                    {floor.racks    .map((rack) => {
                            const row = rack.row
                            if (!row) {
                                return (
                                    <RectShape
                                        key={rack.id}
                                        rect={rack.rect}
                                        transform={rotateAround(rack.rect, rack.rotation)}
                                        className="fill-destructive/25 stroke-destructive"
                                        strokeWidth={0.08}
                                        strokeDasharray="0.25 0.18"
                                    >
                                        <title>Rack sans emplacement en base</title>
                                    </RectShape>
                                )
                            }
                            const vertical = rack.axis === "z"
                            // Travée trop étroite pour « E3·2 » : le nombre seul.
                            const bays = rowBays(row)
                            const compact = vertical || rack.rect.w / bays.length < 2
                            return (
                                <g key={rack.id} transform={rotateAround(rack.rect, rack.rotation)}>
                                    {bayRects(rack, bays.length).map((bay, i) => {
                                        const shelf = bays[i]
                                        // Travée démontée (R1/E4) : sa place reste vide.
                                        if (!isPlanShelf(row, shelf)) return null
                                        const count = bayCount(row, shelf)
                                        const selected =
                                            selection?.kind === "shelf" &&
                                            selection.row === row &&
                                            selection.shelf === shelf
                                        const target: PlanSelection = { kind: "shelf", row, shelf }
                                        return (
                                            <g
                                                key={shelf}
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={selected}
                                                aria-label={`Rack ${row}, travée ${shelf} : ${count} balle${count > 1 ? "s" : ""}`}
                                                onClick={() => onSelect(target)}
                                                onKeyDown={activate(target)}
                                                className="group cursor-pointer outline-none"
                                            >
                                                <RectShape
                                                    rect={bay}
                                                    strokeWidth={selected ? 0.22 : 0.08}
                                                    // Palette au sol, sans rack : contour pointillé.
                                                    strokeDasharray={isPalletShelf(row, shelf) ? "0.25 0.18" : undefined}
                                                    className={cn(
                                                        "transition-colors duration-base group-hover:fill-destructive/60 group-focus-visible:fill-destructive/60",
                                                        count > 0 ? "fill-destructive/50" : "fill-destructive/20",
                                                        selected ? "fill-destructive/75 stroke-foreground" : "stroke-destructive",
                                                    )}
                                                />
                                                <text
                                                    x={bay.x + bay.w / 2}
                                                    y={bay.z + bay.d / 2}
                                                    fontSize={TEXT.count}
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    className={cn(
                                                        "pointer-events-none font-mono font-bold",
                                                        count > 0 ? "fill-foreground" : "fill-destructive/70",
                                                    )}
                                                >
                                                    {compact ? count : `${shelf}·${count}`}
                                                </text>
                                            </g>
                                        )
                                    })}
                                    <text
                                        x={vertical ? rack.rect.x + rack.rect.w + 0.3 : rack.rect.x - 0.3}
                                        y={vertical ? rack.rect.z + rack.rect.d / 2 : rack.rect.z + rack.rect.d / 2}
                                        fontSize={TEXT.label}
                                        textAnchor={vertical ? "start" : "end"}
                                        dominantBaseline="central"
                                        className="pointer-events-none fill-destructive font-mono font-bold"
                                    >
                                        {row}
                                        <title>{`${row} — ${PLAN_ROW_LABELS[row]}`}</title>
                                    </text>
                                </g>
                            )
                        })}

                </g>

                {/* Portes d'entrée et de sortie — noir */}
                {floor.doors.map((door) => {
                    const [x1, z1] = door.from
                    const [x2, z2] = door.to
                    const onLeftWall = x1 === 0 && x2 === 0
                    return (
                        <g key={door.id}>
                            <line
                                x1={x1} y1={z1} x2={x2} y2={z2}
                                className="stroke-foreground"
                                strokeWidth={0.5}
                                strokeLinecap="round"
                            >
                                <title>{door.label}</title>
                            </line>
                            <text
                                x={onLeftWall ? x1 - 0.35 : (x1 + x2) / 2}
                                // Mur du haut : libellé au-dessus du mur, hors du plan.
                                y={onLeftWall ? (z1 + z2) / 2 : z1 === 0 ? -0.5 : z1 + 0.85}
                                fontSize={TEXT.label}
                                textAnchor="middle"
                                dominantBaseline="central"
                                transform={
                                    onLeftWall
                                        ? `rotate(-90 ${x1 - 0.35} ${(z1 + z2) / 2})`
                                        : undefined
                                }
                                className="pointer-events-none fill-foreground font-semibold"
                            >
                                {door.label}
                            </text>
                        </g>
                    )
                })}

                {/* Noms de zones, cliquables hors édition */}
                <g pointerEvents={interactive ? undefined : "none"}>
                    {(Object.keys(floor.zones) as PlanZoneCode[]).map((zone) => {
                        const rect = floor.zones[zone]
                        const count = zoneCount(zone)
                        const selected = selection?.kind === "zone" && selection.zone === zone
                        const target: PlanSelection = { kind: "zone", zone }
                        // A : sous les tables de jeans, à l'écart de la passerelle. D : dans
                        // l'allée centrale, entre les îlots.
                        const cx = zone === "B" ? rect.x + 9 : zone === "A" ? 26.2 : 21.25
                        const cz = zone === "B" ? 7.3 : zone === "A" ? 10.0 : 18.9
                        return (
                            <g
                                key={zone}
                                role="button"
                                tabIndex={0}
                                aria-pressed={selected}
                                aria-label={`Zone ${zone} (${PLAN_ZONES[zone].label}) : ${count} balle${count > 1 ? "s" : ""}`}
                                onClick={() => onSelect(target)}
                                onKeyDown={activate(target)}
                                className="group cursor-pointer outline-none"
                            >
                                <text
                                    x={cx}
                                    y={cz}
                                    fontSize={TEXT.zone}
                                    textAnchor="middle"
                                    className={cn(
                                        "font-black transition-colors duration-base",
                                        selected
                                            ? "fill-foreground"
                                            : "fill-muted-foreground/60 group-hover:fill-foreground group-focus-visible:fill-foreground",
                                    )}
                                >
                                    {zone}
                                </text>
                                <text
                                    x={cx}
                                    y={cz + 0.9}
                                    fontSize={TEXT.label}
                                    textAnchor="middle"
                                    className="fill-muted-foreground"
                                >
                                    {PLAN_ZONES[zone].label} · {count} balle{count > 1 ? "s" : ""}
                                </text>
                            </g>
                        )
                    })}
                </g>

                {overlay}
            </svg>

            <p className="text-center text-2xs text-muted-foreground">
                {panZoom.active
                    ? "Pincer pour zoomer · deux doigts ou glisser pour se déplacer une fois zoomé"
                    : "Cliquez dans le plan pour le piloter au pavé tactile · pincer pour zoomer"}
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <Legend swatch="bg-destructive/50 border-destructive" label="Racks" />
                <Legend swatch="bg-chart-2/20 border-chart-2" label="Bureaux" />
                <Legend swatch="bg-foreground border-foreground" label="Portes d'entrée / sortie" />
                <Legend swatch="bg-muted border-muted-foreground/50" label="Aménagements" />
            </ul>
        </div>
    )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
    return (
        <li className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded-sm border", swatch)} aria-hidden />
            {label}
        </li>
    )
}
