import { Badge } from "@/shared/ui/atoms/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { type Balle } from "@/features/sorters/types/type_gestion"
import { fetchSortingReportByBalle } from "@/features/sorters/services/sortersService"
import { type ReactNode, useEffect, useState } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { type SortingReport } from "../struct"
import { QualityField } from "../Modal/fields/QualityField"

export default function Modal({
    open,
    onOpenChange,
    balle,
    setIsAssignDialogOpen,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    balle: Balle | null
    setIsAssignDialogOpen?: (open: boolean) => void
}) {
    const [report, setReport] = useState<SortingReport | null>(null)

    useEffect(() => {
        if (!balle?.id) return
        fetchSortingReportByBalle(balle.id).then(setReport)
    }, [balle])

    if (!balle) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-6 rounded-xl shadow-xl border border-neutral-800 bg-neutral-900 text-neutral-200">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-neutral-100">
                        Rapport de Tri
                    </DialogTitle>
                </DialogHeader>

                {!report ? (
                    <div className="text-center py-5 text-neutral-400">
                        Aucun rapport trouvé pour cette balle.
                    </div>
                ) : (
                    <div className="mt-4 space-y-6">
                        {/* SECTION 1 — Infos générales */}
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-400 mb-2">
                                Informations générales
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <InfoLine
                                    label="Catégorie"
                                    value={report.category}
                                />
                                <InfoLine
                                    label="Quantité"
                                    value={report.quantity}
                                />
                                <QualityField form={report} />
                            </div>
                        </div>

                        {/* SECTION 2 — Détails */}
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-400 mb-2">
                                Détails du tri
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <UnitLine
                                    label="MAG"
                                    v={report.mag_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="MAG"
                                    v={report.mag_kg}
                                    u={true}
                                />
                                <UnitLine
                                    label="KS Été"
                                    v={report.kssummer_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="KS Été"
                                    v={report.kssummer_kg}
                                    u={true}
                                />

                                <UnitLine
                                    label="KS Hiver"
                                    v={report.kswinter_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="KS Hiver"
                                    v={report.kswinter_kg}
                                    u={true}
                                />
                                <UnitLine
                                    label="SO3"
                                    v={report.so3_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="SO3"
                                    v={report.so3_kg}
                                    u={true}
                                />
                                <UnitLine
                                    label="Export"
                                    v={report.export_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="Export"
                                    v={report.export_kg}
                                    u={true}
                                />
                                <UnitLine
                                    label="Client"
                                    v={report.client_piece}
                                    u={false}
                                />
                                <UnitLine
                                    label="Client"
                                    v={report.client_kg}
                                    u={true}
                                />
                            </div>
                        </div>

                        {/* SECTION 3 — Notes */}
                        {report.comments && (
                            <div>
                                <h3 className="text-sm font-semibold text-neutral-400 mb-2">
                                    Commentaires
                                </h3>
                                <p className="text-neutral-300 bg-neutral-800 p-3 rounded-md text-sm leading-relaxed border border-neutral-700">
                                    {report.comments}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <Button
                    onClick={() => {
                        onOpenChange(false)
                        setIsAssignDialogOpen?.(true)
                    }}
                >
                    Réassigner
                </Button>
            </DialogContent>
        </Dialog>
    )
}

/* 📌 Small reusable UI components */

function InfoLine({
    label,
    value,
}: {
    label: string
    value: ReactNode
}) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className="font-medium text-neutral-200">{value ?? "—"}</span>
        </div>
    )
}

function UnitLine({
    label,
    v,
    u,
}: {
    label: string
    v: number | string | null | undefined
    u: boolean
}) {
    return (
        <div className="flex flex-col">
            <span className="text-xs text-neutral-500">{label}</span>
            <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-200">{v ?? "—"}</span>
                {u && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                        {"Pièce" + (typeof v === "number" && v > 1 ? "s" : "")}
                    </Badge>
                )}
                {!u && (
                    <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                        Kg
                    </Badge>
                )}
            </div>
        </div>
    )
}
