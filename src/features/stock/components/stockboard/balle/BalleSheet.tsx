import { useState } from "react"
import {
    Package, Scale, Tag, MapPin, Calendar,
    TrendingUp, Wrench, ArrowRight, CheckCircle2,
    Send, Info, TrendingDown, Minus,
    Truck, GitFork, ArrowUpRight, ExternalLink,
} from "lucide-react"
import {
    DetailRow, DetailSheet, InfoTile,
} from "@/shared/ui/organisms/detail-sheet"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/shared/ui/atoms/table"
import { cn } from "@/shared/lib/utils"
import {
    useBalleContext,
    useDeliveryContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { BALLE_STATUS_CONFIG, UUID_DISPLAY_LENGTH } from "@/features/stock/constants"

const MARGIN_PRESETS = [5, 10, 15, 20]

/**
 * Fiche de consultation d'une balle.
 *
 * La coque (en-tête, zone scrollable, pied) et les briques `InfoTile` /
 * `DetailRow` vivent dans `shared/ui/organisms/detail-sheet`, partagées avec le
 * stock handpick. Ne restent ici que les quatre sections métier et leurs
 * calculs.
 *
 * Contrairement au handpick, l'ouverture est encore pilotée par un state de
 * contexte et non par le segment `detail` de l'URL : cet écran n'est donc pas
 * partageable. Dette connue, distincte de ce chantier.
 */
export default function BalleSheet() {
    const {
        selectedBalle,
        balles,
        balleDetailSheetOpen,
        setBalleDetailSheetOpen,
        setSelectedBalle,
    } = useBalleContext()
    const {
        deliveries,
        setSelectedDelivery,
        setDeliveryDetailSheetOpen,
    } = useDeliveryContext()
    const { categories, fournisseurs } = useReferentialContext()

    const [margin, setMargin] = useState(10)

    function handleOpenChange(open: boolean) {
        setBalleDetailSheetOpen(open)
        if (!open) setSelectedBalle(null)
    }

    if (!selectedBalle) return null

    const balle = selectedBalle

    const category    = categories.find((c) => c.id === balle.category_id)
    const fournisseur = fournisseurs.find((f) => f.id === balle.fournisseur_id)

    const categoryName       = balle.category?.name          ?? category?.name                    ?? "—"
    const fournisseurName    = balle.fournisseur?.name       ?? fournisseur?.name                 ?? "—"
    const fournisseurCountry = balle.fournisseur?.siege_localisation ?? fournisseur?.siege_localisation ?? "—"
    const unitPrice      = category?.unit_price ?? 0
    const marketValue    = balle.packing * unitPrice                    // prix marché live
    const purchasePrice  = balle.purchase_price ?? null                 // prix figé à la création
    const treatmentCost  = balle.treatment_cost ?? null
    // La rentabilité est calculée sur le prix actuel : si la balle vaut plus, elle se revend plus cher
    const costBase       = marketValue + (treatmentCost ?? 0)
    const minResalePrice = costBase * (1 + margin / 100)

    const priceDelta    = purchasePrice !== null && unitPrice > 0 ? marketValue - purchasePrice : null
    const priceDeltaPct = purchasePrice !== null && purchasePrice > 0 && priceDelta !== null
        ? (priceDelta / purchasePrice) * 100
        : null

    const status       = balle.status ?? "stocked"
    const statusConfig = BALLE_STATUS_CONFIG[status] ?? BALLE_STATUS_CONFIG.stocked

    const linkedDelivery = balle.delivery_id
        ? (deliveries ?? []).find((d) => d.id === balle.delivery_id) ?? null
        : null
    const parentBalle = balle.parent_balle_id
        ? (balles ?? []).find((b) => b.id === balle.parent_balle_id) ?? null
        : null
    const childBalles = (balles ?? []).filter((b) => b.parent_balle_id === balle.id)

    function navigateToDelivery() {
        if (!linkedDelivery) return
        setSelectedDelivery(linkedDelivery)
        setDeliveryDetailSheetOpen(true)
        handleOpenChange(false)
    }

    const importDate = balle.import_date
        ? new Date(balle.import_date).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "long", year: "numeric",
          })
        : "—"

    return (
        <DetailSheet
            open={balleDetailSheetOpen}
            onOpenChange={handleOpenChange}
            icon={Package}
            title={balle.bin}
            titleClassName="font-mono"
            subtitle={
                <>
                    <Calendar size={11} className="shrink-0" />
                    <span className="truncate">{importDate}</span>
                </>
            }
            badge={
                <Badge className={cn("border text-xs shrink-0", statusConfig.className)}>
                    {statusConfig.label}
                </Badge>
            }
            footer={
                <>
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled>
                        <Send size={13} />
                        <span>Envoyer</span>
                    </Button>
                    <Button size="sm" className="flex-1 gap-1.5 text-xs sm:text-sm" disabled>
                        <CheckCircle2 size={13} />
                        <span>Prendre en charge</span>
                    </Button>
                </>
            }
        >
            {/* ── Section 1 : Informations ── */}
            <section className="space-y-3">
                <h3 className={GESTION_THEME.section.groupTitle}>Informations</h3>

                {/* Trio primaire */}
                <div className="grid grid-cols-3 gap-2">
                    <InfoTile icon={<Scale size={12} />} label="Poids">
                        <span className="text-2xl font-black text-foreground tracking-tighter">{balle.packing}</span>
                        <span className="text-xs text-muted-foreground font-medium">kilogrammes</span>
                    </InfoTile>

                    <InfoTile icon={<Tag size={12} />} label="Catégorie">
                        <span className="text-sm font-bold text-foreground leading-tight">{categoryName}</span>
                        {unitPrice > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">{unitPrice.toFixed(2)} €/kg</span>
                        )}
                    </InfoTile>

                    <InfoTile icon={<MapPin size={12} />} label="Fournisseur">
                        <span className="text-sm font-bold text-foreground leading-tight line-clamp-1">{fournisseurName}</span>
                        <span className="text-xs text-muted-foreground font-medium truncate">{fournisseurCountry}</span>
                    </InfoTile>
                </div>

                {/* Lignes financières */}
                <div className="space-y-2">
                    {/* Prix achat → actuel sur une seule ligne */}
                    <DetailRow
                        icon={<TrendingUp size={14} className="text-success" />}
                        label="Prix"
                        rowClassName={GESTION_THEME.settings.section.row}
                    >
                        <div className="flex items-center gap-2">
                            {/* Prix d'achat figé */}
                            {purchasePrice !== null && (
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-muted-foreground">
                                        {purchasePrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-3xs text-muted-foreground leading-none">achat</span>
                                </div>
                            )}

                            {purchasePrice !== null && unitPrice > 0 && (
                                <ArrowRight size={12} className="text-muted-foreground/50 shrink-0" />
                            )}

                            {/* Prix actuel */}
                            {unitPrice > 0 ? (
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-foreground">
                                        {marketValue.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                                    </span>
                                    <span className="text-3xs text-muted-foreground leading-none">actuel</span>
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">Prix unitaire non défini</span>
                            )}

                            {/* Badge delta % */}
                            {priceDeltaPct !== null && (
                                <span className={cn(
                                    "flex items-center gap-0.5 text-2xs font-bold px-1.5 py-0.5 rounded-md shrink-0",
                                    priceDeltaPct > 0 ? "bg-success-light text-success" :
                                    priceDeltaPct < 0 ? "bg-destructive-light text-destructive" :
                                    "bg-muted text-muted-foreground"
                                )}>
                                    {priceDeltaPct > 0  ? <TrendingUp size={11} />   :
                                     priceDeltaPct < 0  ? <TrendingDown size={11} /> :
                                     <Minus size={11} />}
                                    {priceDeltaPct > 0 ? "+" : ""}{priceDeltaPct.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </DetailRow>

                    <DetailRow
                        icon={<Wrench size={14} className="text-warning" />}
                        label="Coût de traitement"
                        rowClassName={GESTION_THEME.settings.section.row}
                    >
                        {treatmentCost !== null ? (
                            <span className="font-bold text-foreground">
                                {treatmentCost.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">Non renseigné</span>
                        )}
                    </DetailRow>

                    {balle.delivery_id && (
                        <DetailRow
                            icon={<Truck size={14} className="text-muted-foreground" />}
                            label="Livraison"
                            rowClassName={GESTION_THEME.settings.section.row}
                        >
                            {linkedDelivery ? (
                                <button
                                    onClick={navigateToDelivery}
                                    className="flex items-center gap-1 text-sm font-bold font-mono text-success hover:underline"
                                >
                                    {linkedDelivery.din}
                                    <ExternalLink size={11} />
                                </button>
                            ) : (
                                <span className="text-xs text-muted-foreground font-mono italic">{balle.delivery_id.slice(0, UUID_DISPLAY_LENGTH)}…</span>
                            )}
                        </DetailRow>
                    )}
                </div>
            </section>

            <Separator />

            {/* ── Section 2 : Rentabilité ── */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className={GESTION_THEME.section.groupTitle}>Rentabilité</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Info size={11} />
                        <span>Basé sur prix actuel{treatmentCost !== null ? " + traitement" : ""}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <span className={GESTION_THEME.filterBar.panelLabel}>Marge souhaitée</span>
                    <div className="flex flex-wrap gap-2">
                        {MARGIN_PRESETS.map((m) => (
                            <button
                                key={m}
                                onClick={() => setMargin(m)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors",
                                    margin === m
                                        ? // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte posé sur un aplat saturé fixe (identique dans les deux thèmes) : non tokenisable (design system §12.4)
                                          "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500"
                                        : "bg-background dark:bg-card text-muted-foreground border-border hover:border-success/40"
                                )}
                            >
                                {m}%
                            </button>
                        ))}
                        <div className="flex items-center gap-1 border border-border rounded-lg px-2.5 bg-background dark:bg-card">
                            <input
                                type="number"
                                min={1}
                                max={500}
                                value={margin}
                                onChange={(e) => setMargin(Number(e.target.value))}
                                className="w-10 text-xs font-bold text-center bg-transparent outline-none text-foreground py-1.5"
                            />
                            <span className="text-xs text-muted-foreground font-bold">%</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-success-light border border-success/20">
                        <div className="flex items-center gap-1.5 mb-2">
                            <ArrowRight size={12} className="text-success" />
                            <span className="text-3xs font-bold uppercase tracking-wider text-success">Prix de revente min.</span>
                        </div>
                        {unitPrice > 0 ? (
                            <span className="text-xl font-black text-success tracking-tighter">
                                {minResalePrice.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-muted/50 border border-border">
                        <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp size={12} className="text-muted-foreground" />
                            <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">Indice de rentabilité</span>
                        </div>
                        <span className="text-xl font-black text-muted-foreground/40 tracking-tighter">—</span>
                        <p className="text-3xs text-muted-foreground mt-1 italic">Bientôt disponible</p>
                    </div>
                </div>
            </section>

            <Separator />

            {/* ── Section 3 : Traçabilité ── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2">
                    <GitFork size={13} className="text-muted-foreground" />
                    <h3 className={GESTION_THEME.section.groupTitle}>Traçabilité</h3>
                </div>

                {parentBalle && (
                    <DetailRow
                        icon={<ArrowUpRight size={14} className="text-muted-foreground" />}
                        label="Balle parente"
                        rowClassName={GESTION_THEME.settings.section.row}
                    >
                        <button
                            onClick={() => setSelectedBalle(parentBalle)}
                            className="flex items-center gap-1 text-sm font-bold font-mono text-success hover:underline"
                        >
                            {parentBalle.bin}
                            <ExternalLink size={11} />
                        </button>
                    </DetailRow>
                )}

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className={GESTION_THEME.filterBar.panelLabel}>Balles enfants</span>
                        {childBalles.length > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">
                                {childBalles.length} balle{childBalles.length > 1 ? "s" : ""}
                            </span>
                        )}
                    </div>

                    {childBalles.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-dashed border-border bg-muted/30">
                            <GitFork size={14} className="text-muted-foreground/50 shrink-0" />
                            <p className="text-xs text-muted-foreground italic">
                                {parentBalle ? "Balle enfant — aucune subdivision créée" : "Balle d'origine — aucune balle enfant créée"}
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl border border-primary/20 overflow-hidden">
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                                        {["BIN", "Catégorie", "Poids", "Statut"].map((h) => (
                                            <TableHead key={h} className="h-auto px-3 py-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                                {h}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {childBalles.map((child) => {
                                        const childCat = categories.find((c) => c.id === child.category_id)
                                        const childCatName = child.category?.name ?? childCat?.name ?? "—"
                                        const childStatusConfig = BALLE_STATUS_CONFIG[child.status ?? "stocked"] ?? BALLE_STATUS_CONFIG.stocked
                                        return (
                                            <TableRow
                                                key={child.id}
                                                onClick={() => setSelectedBalle(child)}
                                                className="border-border hover:bg-muted/30 cursor-pointer"
                                            >
                                                <TableCell className="px-3 py-2.5 font-mono font-bold text-foreground whitespace-nowrap">
                                                    {child.bin}
                                                </TableCell>
                                                <TableCell className="px-3 py-2.5 text-foreground">
                                                    {childCatName}
                                                </TableCell>
                                                <TableCell className="px-3 py-2.5 text-foreground font-medium whitespace-nowrap">
                                                    {child.packing} kg
                                                </TableCell>
                                                <TableCell className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className={cn("inline-flex px-1.5 py-0.5 rounded text-3xs font-bold border", childStatusConfig.className)}>
                                                        {childStatusConfig.label}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </section>

            <Separator />

            {/* ── Section 4 : Données brutes ── */}
            <section className="space-y-3">
                <h3 className={GESTION_THEME.section.groupTitle}>Données brutes</h3>
                <div className="rounded-xl border border-primary/20 overflow-hidden">
                    <Table className="text-xs">
                        <TableHeader>
                            <TableRow className="bg-muted/50 border-border hover:bg-muted/50">
                                {["Date", "Poids", "Fournisseur", "Catégorie", "Pays"].map((h) => (
                                    <TableHead key={h} className="h-auto px-3 py-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                                        {h}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableCell className="px-3 py-3 text-foreground font-medium whitespace-nowrap">
                                    {balle.import_date
                                        ? new Date(balle.import_date).toLocaleDateString("fr-FR")
                                        : "—"}
                                </TableCell>
                                <TableCell className="px-3 py-3 text-foreground font-bold whitespace-nowrap">
                                    {balle.packing} kg
                                </TableCell>
                                <TableCell className="px-3 py-3 text-foreground">{fournisseurName}</TableCell>
                                <TableCell className="px-3 py-3 text-foreground">{categoryName}</TableCell>
                                <TableCell className="px-3 py-3 text-foreground">{balle.provenance ?? "—"}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </section>
        </DetailSheet>
    )
}
