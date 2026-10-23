import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { Printer, ScanLine } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { usePlanHandpick } from "@/features/stock_handpick/hooks/data/usePlanHandpick"
import { usePrintLabels } from "@/features/stock_handpick/hooks/ui/usePrintLabels"
import { labelSummary } from "@/features/stock_handpick/utils/codeLabelSheet"
import { buildEmplacementPaths } from "@/features/stock_handpick/utils/planHelpers"
import { groupEmplacementsForCodes } from "@/features/stock_handpick/utils/emplacementGroups"
import {
    findEmplacementByPath,
    parseEmplacementCode,
    planDetailOfEmplacement,
} from "@/features/stock_handpick/utils/emplacementCode"
import { CodeScanner } from "./CodeScanner"
import { CodeSelectionList } from "./CodeSelectionList"
import { CodeLabelSheet } from "./CodeLabelSheet"
import { EmplacementScanResult } from "./EmplacementScanResult"

/**
 * Onglet Codes : imprimer une étiquette QR par emplacement, et lire une
 * étiquette pour voir ce que contient l'emplacement.
 *
 * `codes/<id>` (URL portée par le QR) ouvre le résultat : l'appareil photo
 * natif du téléphone y mène directement. La sélection à imprimer est un état
 * d'affichage, hors de l'URL (docs/ROUTING.md).
 */
export default function CodesTab({ detail }: { detail?: string }) {
    const navigate = useNavigate()
    const { balles } = useBalleHandpickContext()
    const { zones, emplacements, ballesByEmplacement, pathFor, loading } = usePlanHandpick(balles)
    const [selected, setSelected] = useState<Set<string>>(() => new Set())
    const [scanning, setScanning] = useState(false)

    const groups = useMemo(() => groupEmplacementsForCodes(zones, emplacements), [zones, emplacements])
    const selectedItems = useMemo(
        () => groups.flatMap((group) => group.items.filter((item) => selected.has(item.id))),
        [groups, selected],
    )
    const labels = usePrintLabels(selectedItems)
    const segmentsById = useMemo(() => {
        const map = new Map<string, readonly string[]>()
        for (const [id, path] of buildEmplacementPaths(zones, emplacements)) map.set(id, path.segments)
        return map
    }, [zones, emplacements])

    const open = (id: string) => {
        setScanning(false)
        navigate(`${HANDPICK_ROUTE_BASE}/codes/${id}`)
    }
    const openManual = (text: string) => {
        const id = parseEmplacementCode(text) ?? findEmplacementByPath(text, segmentsById)
        if (!id) return false
        open(id)
        return true
    }

    if (loading) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                <Skeleton aria-hidden className="h-96 w-full rounded-2xl" />
            </div>
        )
    }

    const scanned = detail ? emplacements.find((e) => e.id === detail.toLowerCase()) : undefined

    return (
        <div className={HANDPICK_THEME.board.container}>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                    <h2 className={HANDPICK_THEME.section.title}>Codes des emplacements</h2>
                    <p className={cn(HANDPICK_THEME.section.description, "max-w-prose")}>
                        Imprimez une étiquette QR pour chaque emplacement, puis scannez-la au téléphone
                        pour voir ce qui y est rangé.
                    </p>
                </div>
                <Button size="lg" className="w-full sm:w-auto" onClick={() => setScanning(true)}>
                    <ScanLine size={18} aria-hidden />
                    Scanner une étiquette
                </Button>
            </header>

            {detail && (
                <EmplacementScanResult
                    emplacement={scanned}
                    path={scanned ? pathFor(scanned.id) : null}
                    balles={scanned ? ballesByEmplacement.get(scanned.id) ?? [] : []}
                    onClose={() => navigate(`${HANDPICK_ROUTE_BASE}/codes`)}
                    onOpenBalle={(id) => navigate(`${HANDPICK_ROUTE_BASE}/inventaire/${id}`)}
                    onShowInPlan={(id) => navigate(`${HANDPICK_ROUTE_BASE}/plan/${planDetailOfEmplacement(id)}`)}
                />
            )}

            <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
                <section className="space-y-3 lg:col-span-2" aria-labelledby="codes-emplacements">
                    <div>
                        <h3 id="codes-emplacements" className={HANDPICK_THEME.section.groupTitle}>
                            Emplacements
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Une case par emplacement ; touchez une travée (E1, E2…) pour la cocher entière.
                        </p>
                    </div>
                    <CodeSelectionList groups={groups} selected={selected} onChange={setSelected} />
                </section>

                <aside className="lg:sticky lg:top-4">
                    <CodeLabelSheet
                        items={selectedItems}
                        ready={labels.ready}
                        qrAt={labels.qrAt}
                        onPrint={labels.print}
                        onClear={() => setSelected(new Set())}
                    />
                </aside>
            </div>

            {/* Téléphone : le panneau passe sous la liste, l'impression reste à portée. */}
            {selectedItems.length > 0 && (
                <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur lg:hidden">
                    <span className="text-sm font-medium tabular-nums text-foreground">
                        {labelSummary(selectedItems.length)}
                    </span>
                    <Button onClick={labels.print} disabled={!labels.ready}>
                        <Printer size={16} aria-hidden />
                        Imprimer
                    </Button>
                </div>
            )}

            <CodeScanner open={scanning} onOpenChange={setScanning} onScan={open} onManual={openManual} />
        </div>
    )
}
