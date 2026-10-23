import { useState } from "react"
import { CheckCircle2, PackageCheck, PackageX, Shuffle } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { cn } from "@/shared/lib/utils"
import { CARTON_ETAT_LABEL } from "@/features/commandes/constants"
import { verdictReception } from "@/features/commandes/utils/commandeAvancement"
import { parsePoids } from "@/shared/utils/poids"
import type { Carton, CartonEtat, ReceptionInput } from "@/features/commandes/types/commande.types"

interface CartonReceptionCardProps {
    carton: Carton
    /** Rend le verdict retenu par la base, ou `null` en échec. */
    onValidate: (input: ReceptionInput) => Promise<CartonEtat | null>
    onCancel: () => void
}

/**
 * Réception d'UN carton, au téléphone :
 *   1. le carton attendu s'affiche en gros (catégorie, poids) ;
 *   2. on pèse si on veut — sans pesée, le prévu fait foi ;
 *   3. on signale ce qui se voit : carton abîmé, pas la bonne catégorie ;
 *   4. on valide. Le verdict est annoncé AVANT la validation, et c'est la
 *      base qui tranche (`receptionner_carton`).
 */
export function CartonReceptionCard({ carton, onValidate, onCancel }: CartonReceptionCardProps) {
    const [poids, setPoids] = useState("")
    const [endommage, setEndommage] = useState(false)
    const [mauvaiseCategorie, setMauvaiseCategorie] = useState(false)
    const [note, setNote] = useState("")
    const [busy, setBusy] = useState(false)

    const poidsRecu = poids.trim() ? parsePoids(poids) : null
    const poidsInvalide = poids.trim() !== "" && poidsRecu === null
    const verdict = verdictReception({ poidsPrevu: carton.poids_kg_prevu, poidsRecu, endommage, mauvaiseCategorie })

    const validate = async () => {
        setBusy(true)
        await onValidate({ poidsRecu, endommage, mauvaiseCategorie, note: note.trim() || null })
        setBusy(false)
    }

    return (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-muted-foreground">{carton.code}</p>
                    <h3 className="truncate text-2xl font-bold">{carton.category_nom}</h3>
                    <p className="text-xs text-muted-foreground">{carton.palette_code ? `Palette ${carton.palette_code}` : "Hors palette"}</p>
                </div>
                <p className="shrink-0 text-right text-3xl font-bold tabular-nums">
                    {carton.poids_kg_prevu}
                    <span className="ml-1 text-base font-normal text-muted-foreground">kg</span>
                </p>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="rc-poids" className="text-sm font-medium">Poids pesé <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                <div className="relative">
                    <Input id="rc-poids" value={poids} onChange={(e) => setPoids(e.target.value)} inputMode="decimal" placeholder={String(carton.poids_kg_prevu)}
                        aria-invalid={poidsInvalide} className="h-14 pr-12 text-right text-2xl tabular-nums" />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-muted-foreground">kg</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <Signalement icon={PackageX} label="Carton abîmé" active={endommage} onToggle={() => setEndommage(!endommage)} />
                <Signalement icon={Shuffle} label="Pas la bonne catégorie" active={mauvaiseCategorie} onToggle={() => setMauvaiseCategorie(!mauvaiseCategorie)} />
            </div>
            {(endommage || mauvaiseCategorie || verdict === "ecart_poids") && (
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ce que vous constatez (facultatif)" className="h-12" />
            )}

            <p className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                verdict === "conforme" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                {verdict === "conforme" ? <PackageCheck size={18} /> : <PackageX size={18} />}
                <span>
                    Sera enregistré : <span className="font-semibold">{CARTON_ETAT_LABEL[verdict]}</span>
                    {verdict === "ecart_poids" && poidsRecu !== null && ` (${poidsRecu} kg au lieu de ${carton.poids_kg_prevu}, au-delà de 2 %)`}
                </span>
            </p>

            <div className="flex gap-2">
                <Button type="button" variant="ghost" className="h-14 flex-1" onClick={onCancel} disabled={busy}>Annuler</Button>
                <Button type="button" className="h-14 flex-[2] text-base" onClick={validate} disabled={busy || poidsInvalide}>
                    <CheckCircle2 size={20} />
                    {verdict === "conforme" ? "Valider : conforme" : "Valider avec écart"}
                </Button>
            </div>
        </div>
    )
}

/** Grande bascule au doigt : ce qui se constate en ouvrant le carton. */
function Signalement({ icon: Icon, label, active, onToggle }: { icon: typeof PackageX; label: string; active: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onToggle}
            className={cn(
                "flex min-h-14 items-center gap-2 rounded-xl border-2 px-3 text-left text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                active ? "border-warning bg-warning/10 text-warning" : "border-border bg-background hover:bg-muted",
            )}
        >
            <Icon size={18} className="shrink-0" />
            {label}
        </button>
    )
}
