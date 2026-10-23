import { useMemo, useState } from "react"
import { Info, ShoppingCart, Store, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { KG_PAS_RAPIDES, POIDS_BRUT_AIDE } from "@/features/commandes/constants"
import { useCommandeContext } from "@/features/commandes/hooks/context/CommandeContext"
import { useHistoriqueBoutique } from "@/features/commandes/hooks/data/useCommandes"
import { categoriesHabituelles, derniereCommande } from "@/features/commandes/utils/commandeSuggestions"
import { formatKg } from "@/features/commandes/utils/commandeAvancement"
import { parsePoids } from "@/shared/utils/poids"
import type { CommandeBoutique, CommandeLigneInput } from "@/features/commandes/types/commande.types"
import { CategorieAjout } from "./CategorieAjout"

interface Draft {
    category_id: string
    kg: string
}

interface CommandeFormSheetProps {
    open: boolean
    /** Commande à modifier (avec ses lignes demandées) ; absente : création. */
    commande: CommandeBoutique | null
    lignesInitiales?: { category_id: string; kg_demande: number }[]
    /**
     * Boutique imposée : celle de l'espace boutique. Absente (espace
     * entrepôt), elle se choisit dans le formulaire.
     */
    boutiqueFixe?: string | null
    onClose: () => void
    onSaved: (id: string) => void
}

const kgTexte = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")

/**
 * Ce que la boutique demande : des KILOS BRUTS par catégorie de vêtements.
 * On touche les catégories voulues, on donne un poids à chacune. La commande
 * ne dit rien du découpage en livraisons — elles viendront, partielles, au
 * fil des préparations de l'entrepôt.
 */
export function CommandeFormSheet({ open, commande, lignesInitiales, boutiqueFixe, onClose, onSaved }: CommandeFormSheetProps) {
    const { boutiques, boutiqueById, commandes, categories, categoryNom, version, createCommande, saveCommande } = useCommandeContext()
    const [boutiqueId, setBoutiqueId] = useState("")
    const [date, setDate] = useState("")
    const [note, setNote] = useState("")
    const [lignes, setLignes] = useState<Draft[]>([])
    const [touched, setTouched] = useState(false)
    const [saving, setSaving] = useState(false)

    // (Ré)initialisation à chaque ouverture, AJUSTÉE PENDANT LE RENDU plutôt
    // que dans un effet : le formulaire s'affiche directement avec les bonnes
    // valeurs, sans une première passe sur celles de l'ouverture précédente.
    const openKey = open ? (commande?.id ?? "new") : null
    const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey)
        if (openKey !== null) {
            setBoutiqueId(commande?.boutique_id ?? boutiqueFixe ?? "")
            setDate(commande?.date_souhaitee ?? "")
            setNote(commande?.note ?? "")
            setLignes(lignesInitiales?.map((l) => ({ category_id: l.category_id, kg: kgTexte(l.kg_demande) })) ?? [])
            setTouched(false)
        }
    }

    const boutiqueOptions = useMemo(
        () => boutiques.filter((b) => b.actif || b.id === boutiqueId).map((b) => ({ value: b.id, label: b.nom, subLabel: b.code, icon: Store })),
        [boutiques, boutiqueId],
    )

    const selected = useMemo(() => new Set(lignes.map((l) => l.category_id)), [lignes])
    const historique = useHistoriqueBoutique(open && boutiqueId ? boutiqueId : null, commandes, version)
    const habituelles = useMemo(() => categoriesHabituelles(historique.lignes), [historique.lignes])
    const derniere = derniereCommande(historique.commandes, historique.lignes, commande?.id)
    const lignesValides = lignes.length > 0 && lignes.every((l) => parsePoids(l.kg) !== null)
    const valid = !!boutiqueId && lignesValides
    const totalKg = lignes.reduce((s, l) => s + (parsePoids(l.kg) ?? 0), 0)
    // Une commande déjà livrée ne change pas de destinataire : ses livraisons
    // sont rattachées à cette boutique.
    const boutiqueVerrouillee = !!boutiqueFixe || (commande !== null && commande.nb_livraisons > 0)

    // La dernière ajoutée en tête : elle reste visible au-dessus de la recherche.
    const ajouterLigne = (categoryId: string, kg?: number) => {
        if (!selected.has(categoryId)) setLignes([{ category_id: categoryId, kg: kg ? kgTexte(kg) : "" }, ...lignes])
    }
    const retirer = (categoryId: string) => setLignes(lignes.filter((l) => l.category_id !== categoryId))
    const patch = (categoryId: string, kg: string) => setLignes(lignes.map((l) => (l.category_id === categoryId ? { ...l, kg } : l)))
    const ajouter = (categoryId: string, pas: number) => {
        const l = lignes.find((x) => x.category_id === categoryId)
        patch(categoryId, kgTexte((parsePoids(l?.kg ?? "") ?? 0) + pas))
    }

    const submit = async () => {
        setTouched(true)
        if (!valid) return
        setSaving(true)
        const input = { boutique_id: boutiqueId, date_souhaitee: date || null, note: note.trim() || null }
        const payload: CommandeLigneInput[] = lignes.map((l) => ({ category_id: l.category_id, poids_kg_demande: parsePoids(l.kg) as number }))
        const id = commande
            ? ((await saveCommande(commande.id, input, payload)) ? commande.id : null)
            : await createCommande(input, payload)
        setSaving(false)
        if (id) onSaved(id)
    }

    return (
        <FormSheet
            open={open}
            onClose={onClose}
            icon={ShoppingCart}
            title={commande ? `Modifier ${commande.code}` : "Nouvelle commande"}
            description="Des kilos bruts par catégorie de vêtements. L'entrepôt prépare ensuite une ou plusieurs livraisons."
            size="lg"
            onSubmit={submit}
            submitLabel={commande ? "Enregistrer" : "Passer la commande"}
            loading={saving}
            submitDisabled={touched && !valid}
            footerSummary={
                <p className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">{lignes.length} catégorie{lignes.length > 1 ? "s" : ""}</span>
                    <span className="text-base font-bold tabular-nums">{formatKg(totalKg)}</span>
                </p>
            }
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-semibold">Boutique <span className="text-destructive">*</span></Label>
                    {boutiqueVerrouillee
                        ? (
                            <p className="flex h-10 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm font-medium">
                                <Store size={14} className="text-muted-foreground" />
                                {boutiqueById.get(boutiqueId)?.nom ?? "—"}
                            </p>
                        )
                        : (
                            <SearchSelect options={boutiqueOptions} value={boutiqueId} onChange={(v) => setBoutiqueId(v)} placeholder="Choisir la boutique"
                                variant="input" size="md" required showValidation={touched} emptyMessage="Ajoutez des boutiques (vue « Boutiques »)" />
                        )}
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="cmd-date" className="text-sm font-semibold">Pour le</Label>
                    <Input id="cmd-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" />
                </div>
            </div>

            <section className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold">Catégories demandées <span className="text-destructive">*</span></h3>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info size={12} />{POIDS_BRUT_AIDE}</p>
                </div>
                {touched && lignes.length === 0 && <p className="text-xs text-destructive">Ajoutez au moins une catégorie.</p>}

                {lignes.length > 0 && (
                    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                        {lignes.map((l) => {
                            const invalide = touched && parsePoids(l.kg) === null
                            const nom = categoryNom(l.category_id)
                            return (
                                <li key={l.category_id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                                    <span className="min-w-0 flex-1 basis-32 truncate font-medium">{nom}</span>
                                    <div className="flex items-center gap-1.5">
                                        {KG_PAS_RAPIDES.map((pas) => (
                                            <Button key={pas} type="button" variant="outline" size="sm" className="h-10 px-2.5 tabular-nums"
                                                aria-label={`Ajouter ${pas} kg de ${nom}`} onClick={() => ajouter(l.category_id, pas)}>
                                                +{pas}
                                            </Button>
                                        ))}
                                        <div className="relative w-28">
                                            <Input value={l.kg} onChange={(e) => patch(l.category_id, e.target.value)} inputMode="decimal" placeholder="0"
                                                aria-label={`Kilos de ${nom}`} aria-invalid={invalide}
                                                className="h-10 pr-8 text-right text-base tabular-nums" />
                                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kg</span>
                                        </div>
                                        <Button type="button" variant="ghost" size="sm" className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
                                            aria-label={`Retirer ${nom}`} onClick={() => retirer(l.category_id)}>
                                            <X size={16} />
                                        </Button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}

                <CategorieAjout
                    categories={categories}
                    selected={selected}
                    habituelles={habituelles}
                    derniere={derniere}
                    onAdd={ajouterLigne}
                    onRemove={retirer}
                    onReprendre={(reprises) => setLignes(reprises.map((l) => ({ category_id: l.category_id, kg: kgTexte(l.kg) })))}
                />
            </section>

            <div className="flex flex-col gap-2">
                <Label htmlFor="cmd-note" className="text-sm font-semibold">Note</Label>
                <Textarea id="cmd-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Consignes, contexte (ouverture, opération spéciale…)" />
            </div>
        </FormSheet>
    )
}
