import { useState } from "react"
import { format } from "date-fns"
import { Bomb, ChevronDown, ChevronRight } from "lucide-react"
import { QUANTITY_UNIT_LABELS } from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { usineNameOf } from "@/features/stock_handpick/utils/balleDisplay"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

/** Préférence par navigateur : le volet reste comme on l'a laissé. */
const STORAGE_KEY = "stock_handpick.eclatees.open"

function readOpen(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
        return false
    }
}

function writeOpen(open: boolean) {
    try {
        localStorage.setItem(STORAGE_KEY, open ? "1" : "0")
    } catch {
        // Stockage indisponible (navigation privée…) : le volet marche quand même.
    }
}

interface BalleEclateesSectionProps {
    label: string
    balles: BalleHandpick[]
    onOpen: (balle: BalleHandpick) => void
}

/**
 * Groupe des balles éclatées : hors stock, donc en lignes compactes et dans
 * un volet fermé par défaut, pour ne pas noyer les balles réellement en stock.
 */
export function BalleEclateesSection({ label, balles, onOpen }: BalleEclateesSectionProps) {
    const [open, setOpen] = useState(readOpen)

    const weight = balles
        .filter((b) => b.packing_mode === "kilos" && b.packing !== null)
        .reduce((sum, b) => sum + (b.packing ?? 0), 0)

    const toggle = () => {
        setOpen((current) => {
            writeOpen(!current)
            return !current
        })
    }

    const Chevron = open ? ChevronDown : ChevronRight

    return (
        <section className="space-y-2" aria-label={label}>
            <h3 className="border-b border-border pb-1.5">
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={toggle}
                    className="flex w-full items-center gap-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                    <Chevron size={14} className="shrink-0" aria-hidden />
                    <Bomb size={14} className="shrink-0 text-destructive" aria-hidden />
                    {label}
                    <span className="text-xs font-normal tabular-nums">
                        {balles.length} balle{balles.length > 1 ? "s" : ""}
                        {weight > 0 && ` · ${numberFormatter.format(weight)} kg`}
                    </span>
                </button>
            </h3>

            {open && (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {balles.map((balle) => (
                        <li key={balle.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(balle)}
                                className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/40"
                            >
                                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                                    {balle.raw_name ?? "Sans libellé"}
                                </span>
                                <span className="hidden truncate sm:inline">
                                    {balle.category?.name ?? "Sans catégorie"}
                                </span>
                                <span className="hidden truncate md:inline">
                                    {usineNameOf(balle) ?? "Usine inconnue"}
                                </span>
                                {balle.packing !== null && (
                                    <span className="shrink-0 tabular-nums">
                                        {numberFormatter.format(balle.packing)}{" "}
                                        {balle.packing_mode === "pieces"
                                            ? QUANTITY_UNIT_LABELS.pieces
                                            : QUANTITY_UNIT_LABELS.kg}
                                    </span>
                                )}
                                {balle.eclatee_at && (
                                    <span className="shrink-0 tabular-nums">
                                        {format(new Date(balle.eclatee_at), "dd/MM/yy")}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
