import { useMemo, useState } from "react"
import { addDays, format, parseISO } from "date-fns"
import { Container, Store } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { prochainLundi } from "@/features/commandes/utils/planning"

interface LivraisonFormSheetProps {
    open: boolean
    /** Livraison préparée pour cette commande (« Préparer une livraison »). */
    commandeId: string | null
    onClose: () => void
    onCreated: (id: string) => void
}

const plus = (day: string, n: number) => (day ? format(addDays(parseISO(day), n), "yyyy-MM-dd") : "")

/**
 * Création d'une livraison : sa boutique (imposée par la commande s'il y en
 * a une) et ses dates prévues, qui la placent au planning. Le contenu se
 * prépare ensuite dans sa fiche.
 */
export function LivraisonFormSheet({ open, commandeId, onClose, onCreated }: LivraisonFormSheetProps) {
    const { boutiques, commandes, createLivraison } = useCommandeContext()
    const commande = commandes.find((c) => c.id === commandeId) ?? null

    const [selectedCommande, setSelectedCommande] = useState("")
    const [boutiqueId, setBoutiqueId] = useState("")
    const [prep, setPrep] = useState("")
    const [exp, setExp] = useState("")
    const [arr, setArr] = useState("")
    const [note, setNote] = useState("")
    const [saving, setSaving] = useState(false)

    // (Ré)initialisation à chaque ouverture, AJUSTÉE PENDANT LE RENDU plutôt
    // que dans un effet : le formulaire s'affiche directement avec les bonnes
    // valeurs, sans une première passe sur celles de l'ouverture précédente.
    const openKey = open ? (commandeId ?? "new") : null
    const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey)
        if (openKey !== null) {
            // Par défaut : expédition le lundi qui vient, préparation la veille
            // ouvrée (vendredi), arrivée le lendemain. À ajuster, mais jamais vide.
            const lundi = prochainLundi(new Date())
            setSelectedCommande(commandeId ?? "")
            setBoutiqueId(commande?.boutique_id ?? "")
            setPrep(plus(lundi, -3))
            setExp(lundi)
            setArr(plus(lundi, 1))
            setNote("")
        }
    }

    const commandeChoisie = commandes.find((c) => c.id === selectedCommande) ?? null
    const boutique = commandeChoisie?.boutique_id ?? boutiqueId

    const commandeOptions = useMemo(
        () => [
            { value: "", label: "Hors commande (réassort)" },
            ...commandes.filter((c) => c.statut === "ouverte" || c.statut === "en_cours").map((c) => ({
                value: c.id, label: `${c.code} · ${c.boutique_nom}`, subLabel: `reste ${c.kg_reste.toLocaleString("fr-FR")} kg`,
            })),
        ],
        [commandes],
    )
    const boutiqueOptions = useMemo(
        () => boutiques.filter((b) => b.actif).map((b) => ({ value: b.id, label: b.nom, subLabel: b.code, icon: Store })),
        [boutiques],
    )

    const submit = async () => {
        if (!boutique) return
        setSaving(true)
        const id = await createLivraison({
            commande_id: selectedCommande || null,
            boutique_id: boutique,
            date_preparation_prevue: prep || null,
            date_expedition_prevue: exp || null,
            date_livraison_prevue: arr || null,
            note: note.trim() || null,
        })
        setSaving(false)
        if (id) onCreated(id)
    }

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            icon={Container}
            title={commandeChoisie ? `Préparer une livraison — ${commandeChoisie.code}` : "Nouvelle livraison"}
            description={commandeChoisie
                ? `Livraison partielle de la commande : il reste ${commandeChoisie.kg_reste.toLocaleString("fr-FR")} kg à servir. Les cartons se préparent ensuite.`
                : "Une livraison vers une boutique. Les cartons se préparent ensuite dans sa fiche."}
            size="md"
            onSubmit={submit}
            submitLabel="Créer et préparer"
            submitDisabled={!boutique}
            loading={saving}
        >
            <div className="mt-4 flex flex-col gap-5">
                {!commandeId && (
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-semibold">Commande</Label>
                        <SearchSelect options={commandeOptions} value={selectedCommande} onChange={(v) => setSelectedCommande(v)} variant="input" size="md" />
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold">Boutique <span className="text-destructive">*</span></Label>
                    {commandeChoisie
                        ? <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{commandeChoisie.boutique_nom} <span className="text-muted-foreground">(celle de la commande)</span></p>
                        : <SearchSelect options={boutiqueOptions} value={boutiqueId} onChange={(v) => setBoutiqueId(v)} placeholder="Choisir la boutique" variant="input" size="md" required />}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                        { id: "prep", label: "Préparation", value: prep, set: setPrep },
                        { id: "exp", label: "Expédition", value: exp, set: setExp },
                        { id: "arr", label: "Arrivée", value: arr, set: setArr },
                    ].map((f) => (
                        <div key={f.id} className="flex flex-col gap-2">
                            <Label htmlFor={`lf-${f.id}`} className="text-sm font-semibold">{f.label}</Label>
                            <Input id={`lf-${f.id}`} type="date" value={f.value} onChange={(e) => f.set(e.target.value)} className="h-10" />
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="lf-note" className="text-sm font-semibold">Note</Label>
                    <Textarea id="lf-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transporteur, créneau, consignes…" />
                </div>
            </div>
        </FormSheet>
    )
}
