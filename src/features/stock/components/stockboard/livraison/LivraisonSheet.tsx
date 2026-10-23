import { useState } from "react"
import {
    Truck, Calendar, MapPin, Package,
    Scale, Send, CheckCircle2, PackageX,
    ChevronLeft, ChevronRight,
} from "lucide-react"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/shared/ui/atoms/table"
import { cn } from "@/shared/lib/utils"
import {
    useDeliveryContext,
    useBalleContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import {
    BALLE_STATUS_CONFIG,
    DELIVERY_ITEMS_PER_PAGE as ITEMS_PER_PAGE,
} from "@/features/stock/constants"
import type { Balle, BalleType } from "@/features/stock/types/stock.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

const TYPE_CONFIG: Record<BalleType, { label: string; className: string }> = {
    push:    { label: "Push",    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-900/60" },
    bags:    { label: "Bags",    className: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-400 dark:border-violet-900/60" },
    balle:   { label: "Balle",   className: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-900/60" },
    palette: { label: "Palette", className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-400 dark:border-orange-900/60" },
    other:   { label: "Autre",   className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" },
}

export default function DeliverySheet() {
    const {
        selectedDelivery,
        deliveryDetailSheetOpen,
        setDeliveryDetailSheetOpen,
        setSelectedDelivery,
    } = useDeliveryContext()

    const { balles, setSelectedBalle, setBalleDetailSheetOpen } = useBalleContext()
    const { categories, fournisseurs } = useReferentialContext()

    const [currentPage, setCurrentPage] = useState(1)

    function navigateToBalle(balle: Balle) {
        setSelectedBalle(balle)
        setBalleDetailSheetOpen(true)
        handleOpenChange(false)
    }

    function handleOpenChange(open: boolean) {
        setDeliveryDetailSheetOpen(open)
        if (!open) {
            setSelectedDelivery(null)
            setCurrentPage(1)
        }
    }

    if (!selectedDelivery) return null

    const delivery = selectedDelivery

    const fournisseur = fournisseurs.find((f) => f.id === delivery.fournisseur_id)
    const fournisseurName    = delivery.fournisseur?.name              ?? fournisseur?.name              ?? "—"
    const fournisseurCountry = delivery.fournisseur?.siege_localisation ?? fournisseur?.siege_localisation ?? "—"

    const deliveryDate = delivery.delivery_date
        ? new Date(delivery.delivery_date).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "long", year: "numeric",
          })
        : "—"

    const typeConfig = delivery.delivery_type
        ? (TYPE_CONFIG[delivery.delivery_type] ?? TYPE_CONFIG.other)
        : null

    // Balles appartenant à cette livraison
    const deliveryBalles = (balles ?? []).filter((b) => b.delivery_id === delivery.id)
    const totalPacking   = deliveryBalles.reduce((acc, b) => acc + (b.packing ?? 0), 0)

    const totalPages = Math.ceil(deliveryBalles.length / ITEMS_PER_PAGE)
    const pageStart  = (currentPage - 1) * ITEMS_PER_PAGE
    const pageBalles = deliveryBalles.slice(pageStart, pageStart + ITEMS_PER_PAGE)

    return (
        <Sheet open={deliveryDetailSheetOpen} onOpenChange={handleOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl p-0 flex flex-col gap-0 overflow-hidden"
            >
                {/* ── HEADER ── */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 sm:p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                                <Truck size={18} className="text-slate-500 dark:text-slate-400" />
                            </div>
                            <div className="min-w-0">
                                <SheetTitle className="font-mono text-base sm:text-lg font-black tracking-tight truncate">
                                    {delivery.din}
                                </SheetTitle>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <Calendar size={11} className="text-slate-400 shrink-0" />
                                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{deliveryDate}</span>
                                </div>
                            </div>
                        </div>
                        {typeConfig && (
                            <Badge className={cn("border text-xs shrink-0", typeConfig.className)}>
                                {typeConfig.label}
                            </Badge>
                        )}
                    </div>
                </SheetHeader>

                {/* ── SCROLLABLE CONTENT ── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* ── Section 1 : Informations ── */}
                    <section className="space-y-3">
                        <h3 className={GESTION_THEME.section.groupTitle}>Informations</h3>

                        <div className="grid grid-cols-3 gap-2">
                            <InfoTile icon={<MapPin size={12} />} label="Fournisseur">
                                <span className="text-sm font-bold text-slate-900 dark:text-foreground leading-tight line-clamp-1">{fournisseurName}</span>
                                <span className="text-xs text-slate-400 font-medium truncate">{fournisseurCountry}</span>
                            </InfoTile>

                            <InfoTile icon={<Package size={12} />} label="Balles">
                                <span className="text-2xl font-black text-slate-900 dark:text-foreground tracking-tighter">
                                    {delivery.balles_count ?? deliveryBalles.length}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">unités</span>
                            </InfoTile>

                            <InfoTile icon={<Scale size={12} />} label="Poids total">
                                <span className="text-2xl font-black text-slate-900 dark:text-foreground tracking-tighter">
                                    {totalPacking > 0 ? Math.round(totalPacking * 100) / 100 : (delivery.packing ?? "—")}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">kilogrammes</span>
                            </InfoTile>
                        </div>
                    </section>

                    <Separator />

                    {/* ── Section 2 : Balles de la livraison ── */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className={GESTION_THEME.section.groupTitle}>Balles de la livraison</h3>
                            {deliveryBalles.length > 0 && (
                                <span className="text-xs text-slate-400 font-medium">
                                    {deliveryBalles.length} balle{deliveryBalles.length > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>

                        {deliveryBalles.length === 0 ? (
                            <EmptyState
                                size="sm"
                                icon={PackageX}
                                title="Aucune balle associée"
                                description="Cette livraison ne contient encore aucune balle."
                                className="rounded-xl border border-border bg-muted/30"
                            />
                        ) : (
                            <div className="space-y-2">
                                <div className="rounded-xl border border-primary/20 overflow-hidden">
                                    <Table className="text-xs">
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                {["BIN", "Catégorie", "Poids", "Statut"].map((h) => (
                                                    <TableHead key={h} className="h-auto px-3 py-2 text-3xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                                        {h}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pageBalles.map((balle) => {
                                                const cat = categories.find((c) => c.id === balle.category_id)
                                                const catName = balle.category?.name ?? cat?.name ?? "—"
                                                const statusLabel = BALLE_STATUS_CONFIG[balle.status ?? "stocked"]?.label ?? balle.status ?? "—"
                                                return (
                                                    <TableRow key={balle.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                                        <TableCell className="px-3 py-2.5 whitespace-nowrap">
                                                            <button
                                                                onClick={() => navigateToBalle(balle)}
                                                                className="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                                            >
                                                                {balle.bin}
                                                            </button>
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                                                            {catName}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                                            {balle.packing} kg
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 whitespace-nowrap">
                                                            <span className={cn(
                                                                "inline-flex px-1.5 py-0.5 rounded text-3xs font-bold",
                                                                BALLE_STATUS_CONFIG[balle.status ?? "stocked"]?.className ?? BALLE_STATUS_CONFIG.stocked.className
                                                            )}>
                                                                {statusLabel}
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between px-1">
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft size={15} />
                                        </button>
                                        <span className="text-2xs text-slate-400 font-medium">
                                            {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, deliveryBalles.length)} sur {deliveryBalles.length}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRight size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <Separator />

                    {/* ── Section 3 : Données brutes ── */}
                    <section className="space-y-3">
                        <h3 className={GESTION_THEME.section.groupTitle}>Données brutes</h3>
                        <div className="rounded-xl border border-primary/20 overflow-hidden">
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        {["Date", "Type", "Fournisseur", "Balles", "Poids (kg)"].map((h) => (
                                            <TableHead key={h} className="h-auto px-3 py-2 text-3xs font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent dark:hover:bg-transparent">
                                        <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                            {delivery.delivery_date
                                                ? new Date(delivery.delivery_date).toLocaleDateString("fr-FR")
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">
                                            {delivery.delivery_type
                                                ? (TYPE_CONFIG[delivery.delivery_type]?.label ?? delivery.delivery_type)
                                                : "—"}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{fournisseurName}</TableCell>
                                        <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300 font-bold">
                                            {delivery.balles_count ?? deliveryBalles.length}
                                        </TableCell>
                                        <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300 font-bold">
                                            {totalPacking > 0 ? Math.round(totalPacking * 100) / 100 : (delivery.packing ?? "—")}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                </div>

                {/* ── FOOTER ── */}
                <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-row gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled>
                        <Send size={13} />
                        <span>Envoyer</span>
                    </Button>
                    <Button size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled>
                        <CheckCircle2 size={13} />
                        <span>Prendre en charge</span>
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function InfoTile({
    icon, label, children,
}: {
    icon: React.ReactNode
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-1 p-2 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-400">
                {icon}
                <span className="text-3xs font-bold uppercase tracking-wider truncate">{label}</span>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">{children}</div>
        </div>
    )
}
