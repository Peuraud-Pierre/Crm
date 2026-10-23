import { useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, ArrowLeft, CheckCircle2, Container, PartyPopper, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { CodeScanner, type CodeScannerTexts } from "@/shared/ui/organisms/code-scanner"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { CARTON_ETAT_LABEL, CARTON_STATUS_CONFIG } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { useLivraisonDetail } from "@/features/commandes/hooks/data/useCommandes"
import { canonicalCartonCode, parseCartonCode } from "@/features/commandes/utils/commandeCode"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import type { Carton, CartonEtat, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { CartonReceptionCard } from "./CartonReceptionCard"
import { LivraisonBadge, ProgressCount } from "./commandeUi"
import { ReceptionChecklist } from "./ReceptionChecklist"

const CARTON_TEXTS: CodeScannerTexts = {
    title: "Scanner un carton",
    description: "Visez le QR de l'étiquette logistique (LIV-…-C…).",
    rejected: "Ce n'est pas une étiquette de carton.",
    manualNotFound: "Code de carton illisible : LIV-0042-C07.",
    manualPlaceholder: "Ou tapez le code : LIV-0042-C07",
    manualLabel: "Code du carton",
    insecure: "La caméra exige une connexion HTTPS. Saisissez le code du carton.",
}

/** Un scan qui ne mène pas à une réception, et pourquoi. */
type Refus = { titre: string; detail: string; autre?: LivraisonBoutique }

interface ReceptionViewProps {
    /** La boutique courante : seules ses livraisons sont attendues ici. */
    boutiqueId: string | null
    /** Livraison en cours de réception (segment `detail` de l'URL). */
    livraisonId: string | null
    onSelect: (livraisonId: string | null) => void
    /** Ouvre le scanner d'emblée (bouton « Scanner » de l'accueil). */
    autoScan?: boolean
}

/**
 * L'écran de la BOUTIQUE, simulé dans nokk_project pour cette V1. Pensé pour
 * le téléphone : un gros bouton, un carton à la fois, un verdict clair, la
 * liste des cartons cochée au fil des scans, et un écran de fin quand la
 * livraison est validée.
 *
 * Toute erreur de scan est dite en clair plutôt que silencieuse : carton
 * inconnu, destiné à une autre boutique, d'une autre livraison, pas encore
 * parti, déjà reçu.
 */
export function ReceptionView({ boutiqueId, livraisonId, onSelect, autoScan = false }: ReceptionViewProps) {
    const ctx = useCommandeContext()
    const enRoute = ctx.livraisons.filter((l) => (l.statut === "expediee" || l.statut === "en_reception") && l.boutique_id === boutiqueId)
    const livraison = ctx.livraisons.find((l) => l.id === livraisonId) ?? null
    const { cartons } = useLivraisonDetail(livraison?.id ?? null, ctx.version)

    const [scanning, setScanning] = useState(autoScan)
    const [carton, setCarton] = useState<Carton | null>(null)
    const [refus, setRefus] = useState<Refus | null>(null)
    const [dernier, setDernier] = useState<{ code: string; etat: CartonEtat } | null>(null)
    const [cloture, setCloture] = useState(false)

    const lireCode = async (code: string) => {
        setScanning(false)
        setRefus(null)
        const ref = parseCartonCode(code)
        if (!ref) return
        const found = await ctx.findCartonByCode(ref).catch(() => null)
        if (!found) {
            setRefus({ titre: `Carton ${code} inconnu`, detail: "Aucun carton ne porte ce code. Vérifiez l'étiquette, ou signalez-le à l'entrepôt." })
            return
        }
        if (boutiqueId && found.boutique_id !== boutiqueId) {
            const destination = ctx.boutiqueById.get(found.boutique_id)?.nom ?? "une autre boutique"
            setRefus({ titre: `${found.code} est destiné à ${destination}`, detail: "Ce carton n'est pas pour votre boutique. Mettez-le de côté et prévenez l'entrepôt." })
            return
        }
        if (livraison && found.livraison_id !== livraison.id) {
            const autre = ctx.livraisons.find((l) => l.id === found.livraison_id)
            setRefus({
                titre: `Ce carton n'est pas de ${livraison.code}`,
                detail: `Il appartient à ${autre?.code ?? "une autre livraison"}${autre ? ` (${autre.boutique_nom})` : ""}. Mettez-le de côté : c'est peut-être une erreur d'expédition.`,
                autre,
            })
            return
        }
        if (found.statut === "prepare") {
            setRefus({ titre: `${found.code} n'est pas encore parti`, detail: "Sa livraison n'a pas été expédiée par l'entrepôt." })
            return
        }
        if (found.statut !== "expedie") {
            setRefus({
                titre: `${found.code} déjà traité`,
                detail: `${CARTON_STATUS_CONFIG[found.statut].label}${found.etat ? ` (${CARTON_ETAT_LABEL[found.etat]})` : ""}${found.recu_at ? ` le ${format(new Date(found.recu_at), "d MMM à HH:mm", { locale: fr })}` : ""}.`,
            })
            return
        }
        if (!livraison) onSelect(found.livraison_id)
        setCarton(found)
    }

    const valider = async (input: Parameters<typeof ctx.receptionnerCarton>[1]) => {
        if (!carton) return null
        const etat = await ctx.receptionnerCarton(carton.id, input)
        if (etat) {
            setDernier({ code: carton.code, etat })
            setCarton(null)
            if (etat === "conforme") toast.success(`${carton.code} reçu conforme`)
            else toast.warning(`${carton.code} reçu : ${CARTON_ETAT_LABEL[etat].toLowerCase()}`)
        }
        return etat
    }

    const restants = cartons.filter((c) => c.statut === "expedie")
    const enCours = livraison !== null && (livraison.statut === "expediee" || livraison.statut === "en_reception")
    const terminee = livraison !== null && (livraison.statut === "receptionnee" || livraison.statut === "litige")
    const quitter = () => {
        onSelect(null)
        setCarton(null)
        setRefus(null)
        setDernier(null)
    }

    return (
        <div className="flex flex-col gap-4">
            {livraison ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="font-mono text-lg font-bold">{livraison.code}</p>
                            <p className="truncate text-sm text-muted-foreground">{livraison.boutique_nom}{livraison.commande_code && ` · ${livraison.commande_code}`}</p>
                        </div>
                        <LivraisonBadge statut={livraison.statut} />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tabular-nums">{livraison.nb_recus}</span>
                        <span className="text-lg text-muted-foreground">/ {livraison.nb_cartons} cartons reçus</span>
                    </div>
                    <ProgressCount done={livraison.nb_recus} total={livraison.nb_cartons} tone={livraison.nb_ecarts ? "warning" : "success"} />
                    <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onClick={quitter}>
                            <ArrowLeft size={14} />
                            Autre livraison
                        </Button>
                        {enCours && (
                            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCloture(true)}>Terminer la réception</Button>
                        )}
                    </div>
                </div>
            ) : enRoute.length === 0 ? (
                <EmptyState icon={Container} title="Aucune livraison en route" description="Vos livraisons apparaissent ici dès que l'entrepôt les expédie. Vous pouvez aussi scanner directement un carton." />
            ) : (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted-foreground">Quelle livraison recevez-vous ? Ou scannez directement un carton.</p>
                    {enRoute.map((l) => (
                        <button key={l.id} type="button" onClick={() => onSelect(l.id)}
                            className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <span className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold">{l.code}</span>
                                <LivraisonBadge statut={l.statut} />
                            </span>
                            <span className="text-sm text-muted-foreground">{l.nb_cartons} cartons</span>
                            <ProgressCount done={l.nb_recus} total={l.nb_cartons} />
                        </button>
                    ))}
                </div>
            )}

            {refus && (
                <div className="flex flex-col gap-2 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-4" role="alert">
                    <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle size={18} />{refus.titre}</p>
                    <p className="text-sm">{refus.detail}</p>
                    {refus.autre && (refus.autre.statut === "expediee" || refus.autre.statut === "en_reception") && (
                        <Button variant="outline" size="sm" className="self-start" onClick={() => { onSelect(refus.autre!.id); setRefus(null) }}>
                            Passer à {refus.autre.code}
                        </Button>
                    )}
                </div>
            )}

            {dernier && !carton && !refus && !terminee && (
                <p className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
                    dernier.etat === "conforme" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                    {dernier.etat === "conforme" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    {dernier.code} : {CARTON_ETAT_LABEL[dernier.etat]}
                </p>
            )}

            {terminee && livraison ? (
                <FinReception livraison={livraison} onRetour={quitter} />
            ) : carton ? (
                <CartonReceptionCard carton={carton} onValidate={valider} onCancel={() => setCarton(null)} />
            ) : (
                <Button size="lg" className="h-16 text-lg shadow-md" onClick={() => setScanning(true)}>
                    <ScanLine size={24} />
                    {dernier ? "Scanner le carton suivant" : "Scanner un carton"}
                </Button>
            )}

            {livraison && !carton && <ReceptionChecklist cartons={cartons} />}

            <CodeScanner
                open={scanning}
                onOpenChange={setScanning}
                formats="qr"
                parse={canonicalCartonCode}
                texts={CARTON_TEXTS}
                onScan={(code) => void lireCode(code)}
                onManual={(text) => {
                    const code = canonicalCartonCode(text)
                    if (!code) return false
                    void lireCode(code)
                    return true
                }}
            />

            {livraison && (
                <ConfirmAction
                    open={cloture}
                    onOpenChange={setCloture}
                    title={`Terminer la réception de ${livraison.code} ?`}
                    description={restants.length
                        ? `${restants.length} carton(s) jamais scanné(s) seront déclarés MANQUANTS, et l'entrepôt sera prévenu du litige.`
                        : "Tous les cartons ont été scannés : la réception est close."}
                    confirmLabel="Terminer"
                    destructive={restants.length > 0}
                    onConfirm={() => ctx.cloturerLivraison(livraison.id)}
                />
            )}
        </div>
    )
}

/** L'écran de fin : la livraison est validée, ou close avec des écarts signalés. */
function FinReception({ livraison, onRetour }: { livraison: LivraisonBoutique; onRetour: () => void }) {
    const ok = livraison.statut === "receptionnee"
    return (
        <div className={cn("flex flex-col items-center gap-3 rounded-2xl border-2 p-6 text-center",
            ok ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5")} role="status">
            <span className={cn("flex h-14 w-14 items-center justify-center rounded-full", ok ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground")}>
                {ok ? <PartyPopper size={28} /> : <AlertTriangle size={28} />}
            </span>
            <p className="text-lg font-bold">{ok ? "Livraison validée" : "Réception terminée avec des écarts"}</p>
            <p className="text-sm text-muted-foreground">
                {ok
                    ? `${livraison.nb_cartons} cartons reçus conformes · ${formatKg(livraison.kg_recu)}.`
                    : `${livraison.nb_ecarts} carton${livraison.nb_ecarts > 1 ? "s" : ""} en écart (${formatKg(livraison.kg_ecart)}). L'entrepôt est prévenu.`}
            </p>
            <Button variant="outline" className="h-11" onClick={onRetour}>Retour aux livraisons</Button>
        </div>
    )
}
