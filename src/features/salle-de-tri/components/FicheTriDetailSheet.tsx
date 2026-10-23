import { useEffect, useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    AlertTriangle,
    Building2,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Clock,
    Gauge,
    Pencil,
    Scale,
    Star,
    Trash2,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import { EntityTimeline } from "@/features/stock"
import { useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import {
    formatDuree,
    formatEcart,
    formatHoraires,
    formatKg,
    isBalleEcart,
    kgParHeure,
} from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriBalle, FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"
import { QualiteStars } from "./QualiteStars"
import { RepartitionBar } from "./RepartitionBar"
import { RepartitionGauge } from "./RepartitionGauge"

interface FicheTriDetailSheetProps {
    fiche: FicheTriComplete | null
    onClose: () => void
    onEdit?: () => void
    onDeleted: () => void
    canDelete: boolean
    /** Place de la fiche dans la liste affichée, pour passer à la voisine. */
    nav?: FicheNav
}

export interface FicheNav {
    /** 1 pour la première. */
    position: number
    total: number
    onPrev?: () => void
    onNext?: () => void
}

/**
 * Fiche résumé d'une feuille de tri : écarts signalés en tête, chiffres
 * clés, répartition globale, chaque balle avec sa propre répartition, et
 * l'historique de la fiche (saisie, corrections).
 */
export function FicheTriDetailSheet({ fiche, onClose, onEdit, onDeleted, canDelete, nav }: FicheTriDetailSheetProps) {
    const { deleteFiche } = useTriContext()
    const [confirmDelete, setConfirmDelete] = useState(false)

    // ← → passent d'une fiche à l'autre, sauf pendant une saisie ou une
    // confirmation : la flèche y garde son sens habituel.
    const open = fiche !== null
    const onPrev = nav?.onPrev
    const onNext = nav?.onNext
    useEffect(() => {
        if (!open || confirmDelete) return
        const onKey = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            const target = event.target instanceof Element ? event.target : null
            if (target?.closest("input, textarea, select, [contenteditable=true], [role=menu], [role=listbox]")) return
            if (event.key === "ArrowLeft" && onPrev) onPrev()
            else if (event.key === "ArrowRight" && onNext) onNext()
            else return
            event.preventDefault()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, confirmDelete, onPrev, onNext])

    if (!fiche) return null
    const productivite = kgParHeure([fiche])
    const horaires = formatHoraires(fiche.heure_debut, fiche.heure_fin)

    return (
        <DetailSheet
            open={fiche !== null}
            onOpenChange={(open) => !open && onClose()}
            icon={ClipboardList}
            title={fiche.code}
            titleClassName="font-mono"
            subtitle={`${fiche.trieur_nom} · ${format(new Date(`${fiche.date_tri}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr })}`}
            size="wide"
            badge={nav && nav.total > 1 && <FicheNavigation {...nav} />}
            footer={
                <div className="flex w-full items-center justify-between gap-2">
                    {canDelete ? (
                        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                            <Trash2 size={16} />
                            Supprimer
                        </Button>
                    ) : <span />}
                    {onEdit && (
                        <Button onClick={onEdit}>
                            <Pencil size={16} />
                            Modifier
                        </Button>
                    )}
                </div>
            }
        >
            <div className="flex flex-col gap-6">
                {fiche.nb_balles_ecart > 0 && <EcartBanner fiche={fiche} />}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <InfoTile icon={<Scale size={14} />} label="Poids trié">
                        <span className="text-lg font-bold tabular-nums">{formatKg(fiche.poids_initial_kg)}</span>
                        <span className="text-xs text-muted-foreground">
                            {fiche.nb_balles} balle{fiche.nb_balles > 1 ? "s" : ""} · {formatKg(fiche.poids_reparti_kg)} répartis
                        </span>
                    </InfoTile>
                    <InfoTile icon={<Star size={14} />} label="Qualité moyenne">
                        <QualiteStars value={fiche.qualite_moyenne} size="sm" />
                        <span className="text-xs text-muted-foreground">
                            {fiche.qualite_moyenne?.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) ?? "—"} / 3, pondérée par le poids
                        </span>
                    </InfoTile>
                    <InfoTile icon={<Building2 size={14} />} label={fiche.fournisseur_ids.length > 1 ? "Fournisseurs" : "Fournisseur"}>
                        <span className="line-clamp-2 font-medium">{fiche.fournisseurs_noms ?? "—"}</span>
                    </InfoTile>
                    <InfoTile icon={<Clock size={14} />} label="Horaires">
                        <span className="text-lg font-bold tabular-nums">{horaires ?? "—"}</span>
                        {fiche.duree_minutes !== null && (
                            <span className="text-xs text-muted-foreground">{formatDuree(fiche.duree_minutes)}</span>
                        )}
                    </InfoTile>
                    <InfoTile icon={<Gauge size={14} />} label="Productivité">
                        <span className="text-lg font-bold tabular-nums">
                            {productivite === null ? "—" : `${Math.round(productivite)} kg/h`}
                        </span>
                    </InfoTile>
                </div>

                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Répartition de la fiche</h3>
                    <RepartitionBar balles={fiche.balles} />
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Balles</h3>
                    <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
                        {fiche.balles.map((b, i) => <BalleRow key={b.id} balle={b} index={i} />)}
                    </ol>
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays size={14} />
                        Historique de la fiche
                    </h3>
                    <EntityTimeline entityType="fiche_tri" entityIds={[fiche.id]} version={fiche.updated_at} />
                </section>
            </div>

            <ConfirmAction
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title={`Supprimer la fiche ${fiche.code} ?`}
                description={`${formatKg(fiche.poids_initial_kg)} triés par ${fiche.trieur_nom} disparaîtront de l'historique et des statistiques. La suppression reste tracée dans le journal.`}
                confirmLabel="Supprimer"
                destructive
                onConfirm={async () => {
                    const ok = await deleteFiche(fiche.id)
                    if (ok) onDeleted()
                    return ok
                }}
            />
        </DetailSheet>
    )
}

/** Avertissement en tête de fiche : des kilos ne retombent pas juste. */
function EcartBanner({ fiche }: { fiche: FicheTriComplete }) {
    const n = fiche.nb_balles_ecart
    return (
        <div role="status" className="flex gap-3 rounded-xl border border-warning/30 bg-warning-light p-3 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <div className="flex flex-col gap-0.5">
                <p className="font-semibold text-foreground">
                    {n} balle{n > 1 ? "s" : ""} sur {fiche.nb_balles} en écart
                </p>
                <p className="text-muted-foreground">
                    La répartition ne retombe pas sur le poids initial (écart total {formatEcart(fiche.ecart_kg)}).
                    À vérifier avec le trieur : pesée, perte ou part oubliée.
                </p>
            </div>
        </div>
    )
}

/** ‹ 3 / 18 › : la fiche voisine dans la liste, sans refermer. */
function FicheNavigation({ position, total, onPrev, onNext }: FicheNav) {
    return (
        // Marge à droite : la croix de fermeture de la sheet occupe le coin.
        <div className="mr-7 flex shrink-0 items-center gap-0.5" role="group" aria-label="Fiches voisines">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 md:h-8 md:w-8" onClick={onPrev} disabled={!onPrev} aria-label="Fiche précédente" title="Fiche précédente (←)">
                <ChevronLeft size={16} />
            </Button>
            <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
                {position} / {total}
            </span>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 md:h-8 md:w-8" onClick={onNext} disabled={!onNext} aria-label="Fiche suivante" title="Fiche suivante (→)">
                <ChevronRight size={16} />
            </Button>
        </div>
    )
}

function BalleRow({ balle, index }: { balle: FicheTriBalle; index: number }) {
    const { categoryName, sorties } = useTriContext()
    const ecart = isBalleEcart(balle)
    // Les parts dans l'ordre du référentiel : MAG reste à gauche de KS partout.
    const parts = sorties
        .map((s) => ({ sortieId: s.id, kg: balle.repartition.find((r) => r.sortie_id === s.id)?.poids_kg ?? 0, code: s.code }))
    return (
        <li className="flex flex-col gap-2.5 px-3 py-3">
            {/* Le bloc de droite passe sous le nom d'un seul tenant quand la place manque. */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="flex min-w-40 flex-1 items-center gap-3">
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{categoryName(balle.category_id)}</span>
                        <span className="truncate text-xs text-muted-foreground">{balle.fournisseur_nom ?? "Fournisseur inconnu"}</span>
                    </span>
                </span>
                <span className="ml-auto flex items-center gap-3">
                    {ecart && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-light px-1.5 py-0.5 text-xs font-medium text-warning">
                            <AlertTriangle size={11} aria-hidden />
                            Écart {formatEcart(balle.ecart_kg)}
                        </span>
                    )}
                    <QualiteStars value={balle.qualite} size="sm" />
                    <span className="min-w-16 text-right font-semibold tabular-nums">{formatKg(balle.poids_initial_kg)}</span>
                </span>
            </div>
            <RepartitionGauge parts={parts} initial={balle.poids_initial_kg} />
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {parts.filter((p) => p.kg > 0).map((p) => (
                    <li key={p.sortieId} className="tabular-nums">
                        <span className="font-mono font-semibold text-foreground">{p.code}</span> {formatKg(p.kg)}
                    </li>
                ))}
            </ul>
            {balle.note && <p className="text-xs italic text-muted-foreground">« {balle.note} »</p>}
        </li>
    )
}
