import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Ban, CalendarClock, CheckCheck, Container, Pencil, Scale, Store, Target } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import { ShipmentTimeline, type ShipmentTone } from "@/shared/ui/organisms/shipment-timeline"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { COMMANDES_PERMISSIONS } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { useAvancement } from "@/features/commandes/hooks/data/useCommandes"
import { pourcentageRecu } from "@/features/commandes/utils/commandeAvancement"
import { isEnRetard, toDay } from "@/features/commandes/utils/planning"
import { livraisonEnPreparation } from "@/features/commandes/utils/fileDeTravail"
import type { AvancementLigne, CommandeBoutique, CommandeEspace, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { EntityTimeline } from "@/features/stock"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { AvancementBar, AvancementLegende, CommandeBadge, LivraisonBadge } from "./commandeUi"

interface CommandeDetailSheetProps {
    commande: CommandeBoutique | null
    /**
     * Espace d'où on la consulte. Côté boutique : modifier ou annuler tant
     * que rien n'est parti, suivre le reste ; la préparation et la clôture
     * du reliquat restent à l'entrepôt.
     */
    espace: CommandeEspace
    /** Préparation en cours de création : bouton figé. */
    busy?: boolean
    onClose: () => void
    onEdit: (lignes: AvancementLigne[]) => void
    onPrepare: () => void
    onOpenLivraison: (livraison: LivraisonBoutique) => void
}

const kg = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`

function tone(l: LivraisonBoutique, today: string): ShipmentTone {
    if (l.statut === "litige" || isEnRetard(l, today)) return "alert"
    if (l.statut === "receptionnee") return "done"
    if (l.statut === "expediee" || l.statut === "en_reception") return "upcoming"
    return "neutral"
}

/**
 * Une commande et son avancement : ce qui est reçu, en transit, préparé,
 * manquant et reste à servir, ligne par ligne ; puis ses livraisons
 * partielles, chacune sur sa frise préparation → expédition → boutique.
 */
export function CommandeDetailSheet({ commande, espace, busy, onClose, onEdit, onPrepare, onOpenLivraison }: CommandeDetailSheetProps) {
    const { hasPermission } = useAuth()
    const ctx = useCommandeContext()
    const { lignes } = useAvancement(commande?.id ?? null, ctx.version)
    const [pending, setPending] = useState<"cloturer" | "annuler" | null>(null)
    const [motif, setMotif] = useState("")

    if (!commande) return null
    const entrepot = espace === "entrepot" && hasPermission(COMMANDES_PERMISSIONS.manage)
    const ouverte = commande.statut === "ouverte" || commande.statut === "en_cours"
    // Même règle que la RLS (`commande_modifiable_boutique`) : rien n'est parti.
    const modifiable = entrepot
        ? ouverte
        : hasPermission(COMMANDES_PERMISSIONS.boutique) && commande.statut === "ouverte" && commande.nb_livraisons === 0
    const livraisons = ctx.livraisons.filter((l) => l.commande_id === commande.id).sort((a, b) => a.numero - b.numero)
    const enPreparation = livraisonEnPreparation(commande.id, ctx.livraisons)
    const today = toDay(new Date())

    return (
        <DetailSheet
            open
            onOpenChange={(o) => !o && onClose()}
            icon={Store}
            title={commande.code}
            titleClassName="font-mono"
            subtitle={`${commande.boutique_nom} · créée le ${format(new Date(commande.created_at), "d MMMM yyyy", { locale: fr })}`}
            badge={<CommandeBadge statut={commande.statut} />}
            size="wide"
            toolbar={modifiable ? (
                <div className="flex flex-wrap gap-2">
                    {entrepot && (enPreparation
                        ? (
                            <Button size="sm" onClick={() => onOpenLivraison(enPreparation)}>
                                <Container size={14} />
                                Continuer {enPreparation.code}
                            </Button>
                        )
                        : (
                            <Button size="sm" onClick={onPrepare} disabled={busy || commande.kg_reste <= 0}>
                                <Container size={14} />
                                {commande.nb_livraisons > 0 ? "Préparer la suite" : "Préparer"}
                            </Button>
                        ))}
                    <Button size="sm" variant="outline" onClick={() => onEdit(lignes)}>
                        <Pencil size={14} />
                        Modifier
                    </Button>
                    {entrepot && (
                        <Button size="sm" variant="ghost" onClick={() => { setMotif(""); setPending("cloturer") }}>
                            <CheckCheck size={14} />
                            Clôturer le reliquat
                        </Button>
                    )}
                    {commande.nb_livraisons === 0 && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setPending("annuler")}>
                            <Ban size={14} />
                            Annuler
                        </Button>
                    )}
                </div>
            ) : undefined}
        >
            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <InfoTile icon={<Target size={14} />} label="Demandé">
                        <span className="text-lg font-bold tabular-nums">{kg(commande.kg_demande)}</span>
                        <span className="text-xs text-muted-foreground">{commande.nb_lignes} catégorie{commande.nb_lignes > 1 ? "s" : ""}, poids brut</span>
                    </InfoTile>
                    <InfoTile icon={<CheckCheck size={14} />} label="Reçu">
                        <span className="text-lg font-bold tabular-nums text-success">{Math.round(pourcentageRecu(commande))} %</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{kg(commande.kg_recu)}</span>
                    </InfoTile>
                    <InfoTile icon={<Scale size={14} />} label="En cours / reste">
                        <span className="font-medium tabular-nums">{kg(commande.kg_expedie + commande.kg_prepare)} en cours</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{kg(commande.kg_reste)} à servir</span>
                    </InfoTile>
                    <InfoTile icon={<CalendarClock size={14} />} label="Souhaitée le">
                        <span className="font-medium">{commande.date_souhaitee ? format(new Date(`${commande.date_souhaitee}T12:00:00`), "EEE d MMM", { locale: fr }) : "—"}</span>
                        <span className="text-xs text-muted-foreground">{commande.nb_livraisons} livraison{commande.nb_livraisons > 1 ? "s" : ""}</span>
                    </InfoTile>
                </div>

                {commande.motif_cloture && (
                    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                        Reliquat clôturé : <span className="italic">« {commande.motif_cloture} »</span>
                    </p>
                )}

                <section className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm font-semibold">Avancement par catégorie</h3>
                        <AvancementLegende />
                    </div>
                    <ul className="flex flex-col gap-3">
                        {lignes.map((l) => (
                            <li key={l.ligne_id} className="flex flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-x-2 text-sm">
                                    <span className="min-w-0 flex-1 truncate font-medium">{l.category_nom}</span>
                                    <span className="tabular-nums">
                                        <span className="font-semibold">{kg(l.kg_recu)}</span>
                                        <span className="text-muted-foreground"> / {kg(l.kg_demande)}</span>
                                    </span>
                                </div>
                                <AvancementBar ligne={l} />
                                {l.kg_manquant > 0 && (
                                    <span className="text-xs text-destructive">{kg(l.kg_manquant)} manquant(s) ou erroné(s), à renvoyer</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold">Livraisons</h3>
                    {livraisons.length === 0 && <p className="text-sm text-muted-foreground">Aucune livraison préparée pour l'instant{espace === "boutique" ? " : l'entrepôt s'en occupe." : "."}</p>}
                    {livraisons.map((l) => (
                        <div key={l.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                            <button
                                type="button"
                                // Côté boutique, une livraison ne s'ouvre qu'en route : pour la réceptionner.
                                disabled={espace === "boutique" && l.statut !== "expediee" && l.statut !== "en_reception"}
                                onClick={() => onOpenLivraison(l)}
                                className="flex flex-wrap items-center gap-2 rounded-md text-left enabled:hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                                <span className="font-mono font-semibold">{l.code}</span>
                                <LivraisonBadge statut={l.statut} />
                                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                                    {l.nb_cartons} cartons · {kg(l.kg_prevu)}{l.kg_ecart > 0 && ` · écart ${kg(l.kg_ecart)}`}
                                </span>
                            </button>
                            {l.statut !== "annulee" && (
                                <ShipmentTimeline
                                    stops={[
                                        { label: "Préparation", date: l.date_preparation_prevue, vehicle: "forklift" },
                                        { label: l.expediee_at ? "Expédiée" : "Expédition", date: l.expediee_at ?? l.date_expedition_prevue, vehicle: "truck" },
                                    ]}
                                    arrival={{ label: l.receptionnee_at ? "Reçue" : "Boutique", at: l.receptionnee_at ?? l.date_livraison_prevue }}
                                    tone={tone(l, today)}
                                />
                            )}
                        </div>
                    ))}
                </section>

                <section className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={14} />Historique de la commande</h3>
                    <EntityTimeline entityType="commande" entityIds={[commande.id]} version={commande.updated_at} />
                </section>
            </div>

            <ConfirmAction
                open={pending === "cloturer"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Clôturer le reliquat de ${commande.code} ?`}
                description={`La commande est soldée en l'état : les ${kg(commande.kg_reste)} restants ne seront pas servis. Le motif est conservé.`}
                confirmLabel="Clôturer"
                confirmDisabled={!motif.trim()}
                onConfirm={() => ctx.cloturerCommande(commande.id, motif)}
            >
                <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={2} placeholder="Motif (obligatoire) : catégorie épuisée, boutique servie autrement…" aria-label="Motif de clôture" />
            </ConfirmAction>
            <ConfirmAction
                open={pending === "annuler"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Annuler ${commande.code} ?`}
                description="Aucune livraison n'a été préparée : la commande est simplement annulée. Elle reste visible dans la liste."
                confirmLabel="Annuler la commande"
                destructive
                onConfirm={() => ctx.annulerCommande(commande.id)}
            />
        </DetailSheet>
    )
}
