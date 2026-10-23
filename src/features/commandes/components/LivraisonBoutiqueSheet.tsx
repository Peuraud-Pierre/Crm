import { useState, type ReactNode } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
    Ban, CalendarClock, Container, Lock, Printer, Scale, ScanLine, Send, Store, Trash2, Truck,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { cn } from "@/shared/lib/utils"
import { DetailSheet, InfoTile } from "@/shared/ui/organisms/detail-sheet"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { COMMANDES_PERMISSIONS } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { useAvancement, useLivraisonDetail } from "@/features/commandes/hooks/data/useCommandes"
import { usePrintCommande } from "@/features/commandes/hooks/ui/usePrintCommande"
import { formatKg, recapCartons } from "@/features/commandes/utils/commandeAvancement"
import { isEnRetard, toDay } from "@/features/commandes/utils/planning"
import type { LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { EntityTimeline } from "@/features/stock"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { CartonQuickAdd } from "./CartonQuickAdd"
import { EcartsPanel } from "./EcartsPanel"
import { LivraisonSteps } from "./LivraisonSteps"
import { PaletteTree } from "./PaletteTree"
import { LivraisonBadge, ProgressCount } from "./commandeUi"

interface LivraisonBoutiqueSheetProps {
    livraison: LivraisonBoutique | null
    onClose: () => void
    onOpenCommande: (commandeId: string) => void
    onOpenReception: (livraison: LivraisonBoutique) => void
}

type Pending = "expedier" | "annuler" | "supprimer" | "cloturer" | null

const fmtDay = (d: string | null) => (d ? format(new Date(d.length === 10 ? `${d}T12:00:00` : d), "EEE d MMM", { locale: fr }) : "—")

/**
 * Une livraison vers une boutique, de la préparation à la réception.
 *
 *   planifiée / en préparation → on remplit l'arbre palettes → cartons,
 *                                on imprime, on expédie ;
 *   expédiée / en réception    → l'arbre montre l'état de chaque carton ;
 *   réceptionnée / en litige   → les écarts chiffrés.
 */
export function LivraisonBoutiqueSheet({ livraison, onClose, onOpenCommande, onOpenReception }: LivraisonBoutiqueSheetProps) {
    const { hasPermission } = useAuth()
    const ctx = useCommandeContext()
    const { palettes, cartons } = useLivraisonDetail(livraison?.id ?? null, ctx.version)
    const { lignes: reste } = useAvancement(livraison?.commande_id ?? null, ctx.version)
    const printing = usePrintCommande(livraison, palettes, cartons)
    const [pending, setPending] = useState<Pending>(null)

    if (!livraison) return null

    const manage = hasPermission(COMMANDES_PERMISSIONS.manage)
    const boutique = hasPermission(COMMANDES_PERMISSIONS.boutique)
    const editable = manage && (livraison.statut === "planifiee" || livraison.statut === "preparation")
    const enRoute = livraison.statut === "expediee" || livraison.statut === "en_reception"
    const close = livraison.statut === "receptionnee" || livraison.statut === "litige" || livraison.statut === "annulee"
    const recap = recapCartons(cartons)
    const retard = isEnRetard(livraison, toDay(new Date()))

    return (
        <DetailSheet
            open
            onOpenChange={(open) => !open && onClose()}
            icon={Container}
            title={livraison.code}
            titleClassName="font-mono"
            subtitle={<>{livraison.boutique_nom}{livraison.commande_code && <> · commande{" "}
                <button type="button" className="font-mono underline-offset-2 hover:underline" onClick={() => onOpenCommande(livraison.commande_id!)}>
                    {livraison.commande_code}
                </button></>}</>}
            badge={<LivraisonBadge statut={livraison.statut} />}
            size="wide"
            toolbar={
                <div className="flex flex-wrap gap-2">
                    {cartons.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={!printing.ready}>
                                    <Printer size={14} />
                                    Imprimer
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                <DropdownMenuItem onClick={printing.printCartons}>Étiquettes cartons ({cartons.length})</DropdownMenuItem>
                                {palettes.length > 0 && <DropdownMenuItem onClick={printing.printPalettes}>Étiquettes palettes ({palettes.length})</DropdownMenuItem>}
                                <DropdownMenuItem onClick={printing.printBordereau}>Bordereau de livraison</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    {enRoute && (boutique || manage) && (
                        <Button size="sm" variant="ghost" onClick={() => setPending("cloturer")}>
                            Clôturer la réception
                        </Button>
                    )}
                    {editable && (
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setPending("annuler")}>
                            <Ban size={14} />
                            Annuler
                        </Button>
                    )}
                    {manage && (editable || livraison.statut === "annulee") && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPending("supprimer")}>
                            <Trash2 size={14} />
                        </Button>
                    )}
                </div>
            }
        >
            <div className="flex flex-col gap-6">
                <LivraisonSteps livraison={livraison}>
                    {editable && cartons.length === 0 && (
                        <Consigne>Ajoutez les cartons ci-dessous : un clic sur une catégorie restante de la commande les prépare d'un coup.</Consigne>
                    )}
                    {editable && cartons.length > 0 && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Consigne>{cartons.length} carton{cartons.length > 1 ? "s" : ""} · {formatKg(recap.kg)}. Imprimez les étiquettes, collez-les, puis expédiez.</Consigne>
                            <div className="flex shrink-0 gap-2">
                                <Button variant="outline" className="h-11" onClick={printing.printCartons} disabled={!printing.ready}>
                                    <Printer size={16} />
                                    Étiquettes
                                </Button>
                                <Button className="h-11" onClick={() => setPending("expedier")}>
                                    <Send size={16} />
                                    Expédier
                                </Button>
                            </div>
                        </div>
                    )}
                    {enRoute && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Consigne>La boutique scanne chaque carton à l'arrivée.</Consigne>
                                <ProgressCount done={livraison.nb_recus} total={livraison.nb_cartons} tone={livraison.nb_ecarts > 0 ? "warning" : "success"} />
                            </div>
                            {boutique ? (
                                <Button className="h-11 shrink-0" onClick={() => onOpenReception(livraison)}>
                                    <ScanLine size={16} />
                                    Réceptionner
                                </Button>
                            ) : (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:max-w-56">
                                    <Lock size={12} className="shrink-0" />
                                    Le scan se fait dans l'espace Boutique (permission « {COMMANDES_PERMISSIONS.boutique} »).
                                </p>
                            )}
                        </div>
                    )}
                    {livraison.statut === "receptionnee" && <Consigne tone="success">Livraison validée par la boutique : tout est conforme.</Consigne>}
                    {livraison.statut === "litige" && <Consigne tone="destructive">{formatKg(livraison.kg_ecart)} en écart sur {livraison.nb_ecarts} carton{livraison.nb_ecarts > 1 ? "s" : ""} : le détail est ci-dessous.</Consigne>}
                    {livraison.statut === "annulee" && <Consigne>Livraison annulée : elle ne compte plus dans l'avancement de la commande.</Consigne>}
                </LivraisonSteps>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    <InfoTile icon={<Store size={14} />} label="Boutique">
                        <span className="truncate font-medium">{livraison.boutique_nom}</span>
                        <span className="font-mono text-xs text-muted-foreground">{livraison.boutique_code}</span>
                    </InfoTile>
                    <InfoTile icon={<Truck size={14} />} label="Expédition">
                        <span className={retard && !livraison.expediee_at ? "font-semibold text-destructive" : "font-medium"}>
                            {livraison.expediee_at ? `Partie ${fmtDay(livraison.expediee_at)}` : `Prévue ${fmtDay(livraison.date_expedition_prevue)}`}
                        </span>
                        <span className="text-xs text-muted-foreground">Arrivée prévue {fmtDay(livraison.date_livraison_prevue)}</span>
                    </InfoTile>
                    <InfoTile icon={<Container size={14} />} label="Contenu">
                        <span className="font-medium tabular-nums">{livraison.nb_palettes} pal. · {livraison.nb_cartons} cartons</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{formatKg(recap.kg)}</span>
                    </InfoTile>
                    <InfoTile icon={<Scale size={14} />} label={livraison.kg_ecart > 0 ? "Reçu · écart" : "Catégories"}>
                        {livraison.kg_ecart > 0
                            ? <>
                                <span className="font-medium tabular-nums">{formatKg(livraison.kg_recu)} reçus</span>
                                <span className="text-xs font-semibold tabular-nums text-destructive">− {formatKg(livraison.kg_ecart)} en écart</span>
                            </>
                            : <>
                                <span className="font-medium tabular-nums">{recap.parCategorie.length || "—"}</span>
                                <span className="truncate text-xs text-muted-foreground">{recap.parCategorie.slice(0, 3).map((c) => c.nom).join(", ")}</span>
                            </>}
                    </InfoTile>
                </div>

                {(enRoute || close) && livraison.nb_cartons > 0 && <EcartsPanel cartons={cartons} />}

                {editable && <CartonQuickAdd livraisonId={livraison.id} palettes={palettes} reste={livraison.commande_id ? reste : []} />}

                <section className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Palettes et cartons</h3>
                    <PaletteTree livraison={livraison} palettes={palettes} cartons={cartons} editable={editable} />
                </section>

                {editable && <LivraisonDates livraison={livraison} />}

                <section className="flex flex-col gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarClock size={14} />Historique de la livraison</h3>
                    <EntityTimeline entityType="livraison_boutique" entityIds={[livraison.id]} version={livraison.updated_at} />
                    {cartons.some((c) => c.recu_at) && (
                        <>
                            <h4 className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scans de réception</h4>
                            <EntityTimeline entityType="carton" entityIds={cartons.map((c) => c.id)} version={`${livraison.updated_at}-${livraison.nb_recus}`} />
                        </>
                    )}
                </section>
            </div>

            <ConfirmAction
                open={pending === "expedier"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Expédier ${livraison.code} ?`}
                description={<>
                    {cartons.length} carton{cartons.length > 1 ? "s" : ""} ({formatKg(recap.kg)}) partent
                    vers {livraison.boutique_nom}. Le contenu est figé et la boutique est prévenue.
                    {!printing.ready ? null : <><br /><br />Pensez à imprimer les étiquettes avant de fermer les cartons.</>}
                </>}
                confirmLabel="Expédier"
                onConfirm={() => ctx.expedierLivraison(livraison.id)}
            />
            <ConfirmAction
                open={pending === "cloturer"}
                onOpenChange={(o) => !o && setPending(null)}
                title="Clôturer la réception ?"
                description={`${livraison.nb_cartons - livraison.nb_recus} carton(s) jamais scanné(s) seront déclarés manquants. La livraison passera en litige s'il reste le moindre écart.`}
                confirmLabel="Clôturer"
                destructive
                onConfirm={() => ctx.cloturerLivraison(livraison.id)}
            />
            <ConfirmAction
                open={pending === "annuler"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Annuler ${livraison.code} ?`}
                description="La livraison reste visible, barrée, et ne compte plus dans l'avancement de la commande."
                confirmLabel="Annuler la livraison"
                destructive
                onConfirm={() => ctx.annulerLivraison(livraison.id)}
            />
            <ConfirmAction
                open={pending === "supprimer"}
                onOpenChange={(o) => !o && setPending(null)}
                title={`Supprimer ${livraison.code} ?`}
                description="La livraison, ses palettes et ses cartons sont supprimés. La suppression reste tracée dans le journal."
                confirmLabel="Supprimer"
                destructive
                onConfirm={async () => {
                    const ok = await ctx.deleteLivraison(livraison.id)
                    if (ok) onClose()
                    return ok
                }}
            />
        </DetailSheet>
    )
}

/** Consigne de l'étape courante, sous le fil de la livraison. */
function Consigne({ tone, children }: { tone?: "success" | "destructive"; children: ReactNode }) {
    return (
        <p className={cn("min-w-0 flex-1 text-sm",
            tone === "success" ? "font-medium text-success" : tone === "destructive" ? "font-medium text-destructive" : "text-muted-foreground")}>
            {children}
        </p>
    )
}

/** Dates prévues, modifiables tant que la livraison n'est pas partie. */
function LivraisonDates({ livraison }: { livraison: LivraisonBoutique }) {
    const { updateLivraison } = useCommandeContext()
    const save = (key: "date_preparation_prevue" | "date_expedition_prevue" | "date_livraison_prevue", value: string) => {
        if ((livraison[key] ?? "") === value) return
        void updateLivraison(livraison.id, { [key]: value || null })
    }
    const fields = [
        { key: "date_preparation_prevue", label: "Préparation" },
        { key: "date_expedition_prevue", label: "Expédition" },
        { key: "date_livraison_prevue", label: "Arrivée en boutique" },
    ] as const
    return (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {fields.map((f) => (
                <div key={f.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`liv-${f.key}`} className="text-xs text-muted-foreground">{f.label} prévue</Label>
                    <Input
                        id={`liv-${f.key}`}
                        type="date"
                        defaultValue={livraison[f.key] ?? ""}
                        onBlur={(e) => save(f.key, e.target.value)}
                        className="h-9"
                    />
                </div>
            ))}
        </section>
    )
}
