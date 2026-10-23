import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"
import { useBriefOptions } from "@/features/crm/hooks/CRM_hook/use_brief_options"
import type { BriefCategorie, BriefOption } from "@/features/crm/types"
import { AmeliaVersions } from "./AmeliaVersions"
import { cn } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/atoms/badge"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Separator } from "@/shared/ui/atoms/separator"
// Le wrapper Slider de @/shared/ui/atoms/slider compose Track/Range/Thumb en
// interne avec des styles fixes : impossible d'exprimer le slider d'évaluation
// (track transparent sur graduations, range/thumb colorés selon la valeur)
// sans accéder aux primitives. Dérogation ciblée en attendant un wrapper
// composable dans le design system (hors périmètre de src/features/crm).
// eslint-disable-next-line no-restricted-imports
import * as SliderPrimitive from "@radix-ui/react-slider"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Leaf,
    Plus,
    Search,
    Shirt,
    Store,
    Tag,
    Globe,
} from "lucide-react"
import { memo, useCallback, useEffect, useRef, useState } from "react"

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface CustomerShopFormProps {
    saveFiche: (fiche: FicheAppro) => void
    handleChange: (field: keyof FicheAppro, value: FicheValue) => void
}

type FicheValue =
    | FicheAppro[keyof FicheAppro]
    | string
    | number
    | boolean
    | string[]
    | number[]

type FicheSetter = React.Dispatch<React.SetStateAction<FicheAppro>>
type SaveFiche = (fiche: FicheAppro) => void
type Season = "Homme" | "Femme" | "Été" | "Hiver"
/** Options du brief (crm_brief_options), regroupées par catégorie. */
type BriefOptionsByCategorie = Partial<Record<BriefCategorie, BriefOption[]>>

// Forme réelle des items stockés dans vendDeja/recherche (inclut `saison`,
// non décrite par les types Vente/Recherche d'origine).
type ProductItem = {
    nom: string
    saison: Season
    prix: number
    quantite: number
}

// Hauteur partagée entre la carte Produits (liste plafonnée à ~15 lignes
// visibles, scroll au-delà) et la colonne Styles/Marques à sa droite — sans
// ça les deux cases de la grille n'ont aucune raison d'avoir la même taille.
const PRODUCT_COLUMN_HEIGHT = "42rem"

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export const CustomerShopForm = memo(function CustomerShopForm({
    saveFiche,
    handleChange,
}: CustomerShopFormProps) {
    const { fiche, setFiche } = useCRMContext()
    const { byCategorie } = useBriefOptions()

    // Sync is handled by fiche.tsx (parent) which stays mounted across tab
    // switches. CustomerShopForm is unmounted by Radix Tabs when inactive,
    // so keeping refs/effects here would reset the guard on remount.

    const handleFieldChange = useCallback(
        (field: keyof FicheAppro, value: FicheValue) => {
            // Call handleChange directly — do NOT wrap in setFiche.
            // Calling setFiche inside another setFiche updater is a React
            // violation (side-effect in a pure updater) that causes double
            // saves and unpredictable state in Concurrent Mode.
            handleChange(
                field as keyof FicheAppro,
                value as FicheAppro[keyof FicheAppro]
            )
        },
        [handleChange]
    )

    // PAS d'effet « E-shop → boutiqueType En ligne » ici : lors d'un
    // changement de client, cet effet enfant tournait avant la resync du
    // parent (fiche.tsx) et sauvegardait la fiche périmée de l'ancien client
    // sur l'id du nouveau (briefs préremplis sur les nouveaux leads). Le
    // défaut est posé dans le onClick du badge « E-shop » (action utilisateur
    // uniquement).
    return (
        <div className="flex flex-col gap-6 p-1 pb-10">
            {/* --- SECTION 2: ACTIVITE & VINTAGE --- */}
            <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
                <div className="flex items-center justify-between mb-2">
                    {/* --- SWITCH LANGUE --- */}
                    <div className="flex items-center gap-1.5 p-1 bg-muted/30 border rounded-lg">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground ml-1" />
                        <div className="flex gap-1 ml-1">
                            <SelectionBadge
                                label="FR"
                                isSelected={fiche.language === "FR"}
                                onClick={() =>
                                    handleFieldChange("language", "FR")
                                }
                            />
                            <SelectionBadge
                                label="EN"
                                isSelected={fiche.language === "EN"}
                                onClick={() =>
                                    handleFieldChange("language", "EN")
                                }
                            />
                        </div>
                    </div>
                    <AmeliaVersions />
                </div>

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-orange-500" />
                        <Label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                            Comment il nous a connu ?
                        </Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(byCategorie.provenances ?? []).map(({ value: opt }) => (
                            <div
                                key={opt}
                                onClick={() =>
                                    handleFieldChange("provenance", opt)
                                }
                                className={cn(
                                    "flex-1 min-w-[120px] text-center px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors border select-none",
                                    fiche.provenance === opt
                                        ? "bg-orange-100 text-orange-700 border-orange-200 shadow-sm dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900"
                                        : "bg-background text-muted-foreground border-border hover:border-orange-300 hover:text-foreground"
                                )}
                            >
                                {opt}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActivitySection
                    fiche={fiche}
                    handleChange={handleFieldChange}
                    byCategorie={byCategorie}
                />
                <VintageSection
                    fiche={fiche}
                    handleChange={handleFieldChange}
                    byCategorie={byCategorie}
                />
            </div>

            <Separator />

            <div className="p-4 border rounded-xl bg-card shadow-sm space-y-4">
                <EvaluationBars
                    value={
                        Array.isArray(fiche.evaluationRange) &&
                        fiche.evaluationRange.length === 2
                            ? fiche.evaluationRange
                            : [0, 0]
                    }
                    onValueChange={(val) => {
                        handleFieldChange("evaluationRange", val)
                    }}
                />
            </div>
            {/* --- SECTION 3: PRODUITS --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Colonne de Gauche : Produits */}
                <ProductGrid
                    fiche={fiche}
                    setFiche={setFiche}
                    saveFiche={saveFiche}
                    byCategorie={byCategorie}
                />

                {/* Colonne de Droite : Styles & Marques — même hauteur que la
                    carte Produits, scroll interne si le contenu dépasse. */}
                <div
                    style={{ height: PRODUCT_COLUMN_HEIGHT }}
                    className="flex flex-col gap-6 overflow-y-auto pr-1"
                >
                    <StylesSection
                        fiche={fiche}
                        setFiche={setFiche}
                        saveFiche={saveFiche}
                        byCategorie={byCategorie}
                    />

                    <Separator />

                    <MarqueSection
                        fiche={fiche}
                        handleChange={handleFieldChange}
                        byCategorie={byCategorie}
                    />
                </div>
            </div>
            <Separator />

            {/* --- SECTION 5: NOTES --- */}
            <NotesSection
                fiche={fiche}
                setFiche={setFiche}
                saveFiche={saveFiche}
            />
        </div>
    )
})

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

const EVAL_MIN = 0
const EVAL_MAX = 5
const EVAL_STEP = 1
const EVAL_TICKS = Array.from(
    { length: (EVAL_MAX - EVAL_MIN) / EVAL_STEP + 1 },
    (_, i) => EVAL_MIN + i * EVAL_STEP
)

const SingleBar = memo(function SingleBar({
    label,
    val,
    colorClass,
    thumbColorClass,
    onChange,
}: {
    label: string
    val: number
    colorClass: string
    thumbColorClass: string
    onChange: (v: number) => void
}) {
    return (
        <div className="flex flex-col gap-3 flex-1">
            <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-muted-foreground">
                    {label}
                </span>
                <span className={cn("text-xs font-bold", colorClass)}>
                    {val}/5
                </span>
            </div>

            <div className="relative h-6 w-full flex items-center">
                <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 h-2 rounded-full bg-secondary z-0"></div>

                <div className="absolute top-3 left-0 w-full flex justify-between pointer-events-none px-1 h-full z-0">
                    {EVAL_TICKS.map((tick) => (
                        <div
                            key={tick}
                            className="flex flex-col items-center justify-end h-full w-0"
                        >
                            <div className="h-1.5 w-px bg-muted-foreground/20 mt-2" />
                        </div>
                    ))}
                </div>

                <SliderPrimitive.Root
                    className="relative flex w-full touch-none select-none items-center z-10"
                    min={EVAL_MIN}
                    max={EVAL_MAX}
                    step={EVAL_STEP}
                    value={[val]}
                    onValueChange={([v]) => onChange(v)}
                >
                    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-transparent">
                        <SliderPrimitive.Range
                            className={cn(
                                "absolute h-full",
                                colorClass
                                    .replace("text-", "bg-")
                                    .replace("font-bold", "")
                                    .replace("opacity-80", "opacity-30")
                            )}
                        />
                    </SliderPrimitive.Track>
                    <SliderPrimitive.Thumb
                        className={cn(
                            "block h-4 w-4 rounded-full border-2 bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 cursor-grab active:cursor-grabbing shadow-sm",
                            thumbColorClass
                        )}
                    />
                </SliderPrimitive.Root>
            </div>
        </div>
    )
})

const EvaluationBars = memo(function EvaluationBars({
    value,
    onValueChange,
}: {
    value: number[]
    onValueChange: (v: number[]) => void
}) {
    return (
        <div className="flex flex-col sm:flex-row gap-8 px-1 pb-2">
            <SingleBar
                label="Connaissance"
                val={value[0]}
                colorClass="text-blue-600"
                thumbColorClass="border-blue-600"
                onChange={(v: number) => onValueChange([v, value[1]])}
            />
            <SingleBar
                label="Flexibilité"
                val={value[1]}
                colorClass="text-red-600"
                thumbColorClass="border-red-600"
                onChange={(v: number) => onValueChange([value[0], v])}
            />
        </div>
    )
})

const ActivitySection = memo(function ActivitySection({
    fiche,
    handleChange,
    byCategorie,
}: {
    fiche: FicheAppro
    handleChange: (field: keyof FicheAppro, value: FicheValue) => void
    byCategorie: BriefOptionsByCategorie
}) {
    const boutiqueType = String(fiche.boutiqueType ?? "")

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-xl shadow-sm bg-background dark:bg-card h-full">
            <div className="flex items-center gap-2 mb-2">
                <Store className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Activité & Boutique</h3>
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">
                    Type d&apos;activité
                </Label>
                <div className="flex flex-wrap gap-2">
                    {[
                        "E-shop",
                        "Boutique",
                        "Grossiste",
                        "Marché",
                        "Pop-up / Corner store",
                    ].map((opt) => (
                        <SelectionBadge
                            key={opt}
                            label={opt}
                            isSelected={fiche.activiteType === opt}
                            onClick={() => {
                                handleChange("activiteType", opt)
                                // Un E-shop vend forcément en ligne
                                if (opt === "E-shop")
                                    handleChange("boutiqueType", "En ligne")
                            }}
                        />
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">
                    Canal de vente
                </Label>
                <div className="flex flex-wrap gap-2">
                    {fiche.activiteType === "E-shop" ? (
                        /* Si c'est un E-shop, on force le badge "En ligne" */
                        <SelectionBadge
                            key="En ligne"
                            label="En ligne"
                            isSelected={true}
                            onClick={() => {}} // On laisse vide pour empêcher le changement
                        />
                    ) : (
                        /* Sinon, on affiche les 3 options normalement */
                        ["En ligne", "Physique", "Les deux"].map((opt) => (
                            <SelectionBadge
                                key={opt}
                                label={opt}
                                isSelected={boutiqueType === opt}
                                onClick={() =>
                                    handleChange("boutiqueType", opt)
                                }
                            />
                        ))
                    )}
                </div>
            </div>
            {(boutiqueType === "Physique" || boutiqueType === "Les deux") && (
                <div className="space-y-1">
                    <Label className="text-xs">Surface (m²)</Label>
                    <Input
                        type="number"
                        value={fiche.surface || ""}
                        onChange={(e) =>
                            handleChange("surface", e.target.value)
                        }
                        className="h-8"
                    />
                </div>
            )}
            {(boutiqueType === "En ligne" || boutiqueType === "Les deux") && (
                <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase">
                        Plateformes
                    </Label>
                    <div className="flex flex-wrap gap-2">
                        {(byCategorie.plateformes ?? []).map(({ value: opt }) => {
                            const isSelected = fiche.plateformes?.includes(opt)
                            return (
                                <Badge
                                    key={opt}
                                    variant={isSelected ? "default" : "outline"}
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => {
                                        const current = fiche.plateformes || []
                                        const updated = isSelected
                                            ? current.filter(
                                                  (p: string) => p !== opt
                                              )
                                            : [...current, opt]
                                        handleChange("plateformes", updated)
                                    }}
                                >
                                    {opt}
                                </Badge>
                            )
                        })}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto pt-2">
                <div className="space-y-1">
                    <Label className="text-xs">Ville</Label>
                    <Input
                        value={fiche.ville || ""}
                        onChange={(e) => handleChange("ville", e.target.value)}
                        className="h-8"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Pays</Label>
                    <Input
                        value={fiche.pays || ""}
                        onChange={(e) => handleChange("pays", e.target.value)}
                        className="h-8"
                    />
                </div>
            </div>
            <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground uppercase">
                    Horizon Projet
                </Label>
                <div className="flex flex-wrap gap-2">
                    {(byCategorie.horizons ?? []).map(({ value: opt }) => (
                        <SelectionBadge
                            key={opt}
                            label={opt}
                            isSelected={fiche.Horizon === opt}
                            onClick={() => handleChange("Horizon", opt)}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
})

const VintageSection = memo(function VintageSection({
    fiche,
    handleChange,
    byCategorie,
}: {
    fiche: FicheAppro
    handleChange: (field: keyof FicheAppro, value: FicheValue) => void
    byCategorie: BriefOptionsByCategorie
}) {
    return (
        <div className="flex flex-col gap-4 p-4 border rounded-xl bg-card shadow-sm h-full">
            <div className="flex items-center gap-2 mb-2">
                <Leaf className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold">Vintage & Sourcing</h3>
            </div>
            <div className="space-y-2 pt-2">
                <Label className="text-xs text-muted-foreground uppercase">
                    Experience (années)
                </Label>
                <div className="flex flex-wrap gap-2">
                    {(byCategorie.experiences ?? []).map(({ value: optb }) => (
                        <SelectionBadge
                            key={optb}
                            label={optb}
                            isSelected={String(fiche.experience ?? "") === optb}
                            onClick={() => handleChange("experience", optb)}
                        />
                    ))}
                </div>
                <Label className="text-xs text-muted-foreground uppercase">
                    Budget(€)
                </Label>
                <div className="flex flex-wrap gap-2">
                    {(byCategorie.budgets ?? []).map(({ value: optb }) => (
                        <SelectionBadge
                            key={optb}
                            label={optb}
                            isSelected={String(fiche.budget ?? "") === optb}
                            onClick={() => handleChange("budget", optb)}
                        />
                    ))}
                </div>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">
                    Source d&apos;approvisionnement
                </Label>
                <Textarea
                    value={fiche.approvisionnement || ""}
                    onChange={(e) =>
                        handleChange("approvisionnement", e.target.value)
                    }
                    className="h-20 text-sm resize-none"
                    placeholder="Ex: Grossiste, Vide grenier..."
                />
            </div>
        </div>
    )
})

const MarqueSection = memo(function MarqueSection({
    fiche,
    handleChange,
    byCategorie,
}: {
    fiche: FicheAppro
    handleChange: (field: keyof FicheAppro, value: FicheValue) => void
    byCategorie: BriefOptionsByCategorie
}) {
    const [inputValue, setInputValue] = useState("")

    const selectedMarques: string[] = Array.isArray(fiche.marques)
        ? fiche.marques
        : []

    const toggleMarque = useCallback(
        (marque: string) => {
            const current = selectedMarques
            const isSelected = current.includes(marque)

            let newMarques
            if (isSelected) {
                newMarques = current.filter((m) => m !== marque)
            } else {
                newMarques = [...current, marque]
            }

            handleChange("marques", newMarques)
        },
        [selectedMarques, handleChange]
    )

    const handleAddCustom = () => {
        if (inputValue.trim() && !selectedMarques.includes(inputValue.trim())) {
            toggleMarque(inputValue.trim())
            setInputValue("")
        }
    }

    const filteredSuggestions = (byCategorie.marques ?? [])
        .map(({ value }) => value)
        .filter(
            (m) =>
                !selectedMarques.includes(m) &&
                m.toLowerCase().includes(inputValue.toLowerCase())
        )

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-xl shadow-sm bg-background dark:bg-card h-full">
            <div className="flex items-center gap-2 mb-2">
                <Tag className="w-4 h-4 text-purple-600" />
                <h3 className="font-semibold">Marques & Labels</h3>
            </div>

            {/* Zone de saisie */}
            <div className="flex gap-2">
                <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                    placeholder="Chercher ou ajouter une marque..."
                    className="h-9 text-sm"
                />
                <button
                    onClick={handleAddCustom}
                    disabled={!inputValue.trim()}
                    className="bg-primary text-primary-foreground px-3 rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Marques Sélectionnées */}
            {selectedMarques.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-dashed">
                    {selectedMarques.map((m) => (
                        <Badge
                            key={m}
                            variant="default"
                            className="pl-2 pr-1 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors group"
                            onClick={() => toggleMarque(m)}
                        >
                            {m}
                            <span className="ml-1.5 opacity-60 group-hover:opacity-100">
                                ×
                            </span>
                        </Badge>
                    ))}
                </div>
            )}

            {/* Suggestions */}
            <div className="space-y-2 mt-2 flex-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Suggestions populaires
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {filteredSuggestions.length} disp.
                    </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((label) => (
                            <Badge
                                key={label}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-colors font-normal text-muted-foreground hover:text-foreground"
                                onClick={() => toggleMarque(label)}
                            >
                                + {label}
                            </Badge>
                        ))
                    ) : (
                        <span className="text-xs text-muted-foreground italic py-2">
                            Aucune suggestion. Appuyez sur "+" pour ajouter
                            &quot;
                            {inputValue}&quot;.
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
})

const ProductGrid = memo(function ProductGrid({
    fiche,
    setFiche,
    saveFiche,
    byCategorie,
}: {
    fiche: FicheAppro
    setFiche: FicheSetter
    saveFiche: SaveFiche
    byCategorie: BriefOptionsByCategorie
}) {
    const [searchProduit, setSearchProduit] = useState("")

    const handleToggle = useCallback(
        (listName: "vendDeja" | "recherche", label: string, saison: Season) => {
            setFiche((prev) => {
                const currentList =
                    (prev[listName] as ProductItem[] | undefined) || []
                const exists = currentList.some(
                    (item) => item.nom === label && item.saison === saison
                )
                const updated = exists
                    ? currentList.filter(
                          (item) =>
                              !(item.nom === label && item.saison === saison)
                      )
                    : [
                          ...currentList,
                          { nom: label, saison, prix: 0, quantite: 0 },
                      ]
                const newFiche = { ...prev, [listName]: updated } as FicheAppro
                saveFiche(newFiche)
                return newFiche
            })
        },
        [setFiche, saveFiche]
    )

    const filteredProduits = (byCategorie.produits ?? []).filter(({ value }) =>
        value.toLowerCase().includes(searchProduit.toLowerCase())
    )

    const renderColumn = (saison: Season) => (
        <div className="flex-1 min-w-[140px] min-h-0 flex flex-col">
            <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
                {filteredProduits.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1">
                        Aucun produit.
                    </p>
                ) : (
                    filteredProduits.map(({ value: label }) => {
                        const isChecked = (
                            fiche.vendDeja as ProductItem[] | undefined
                        )?.some(
                            (item) =>
                                item.nom === label && item.saison === saison
                        )
                        return (
                            <div
                                key={`${label}-${saison}`}
                                onClick={() =>
                                    handleToggle("vendDeja", label, saison)
                                }
                                className={cn(
                                    "text-xs p-2 rounded border cursor-pointer transition-colors shrink-0",
                                    isChecked
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "hover:bg-muted text-muted-foreground"
                                )}
                            >
                                {label}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )

    return (
        <div
            style={{ height: PRODUCT_COLUMN_HEIGHT }}
            className="flex flex-col gap-4 p-4 border rounded-xl shadow-sm bg-background dark:bg-card"
        >
            <div className="flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold">Produits Recherchés</h3>
            </div>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                    value={searchProduit}
                    onChange={(e) => setSearchProduit(e.target.value)}
                    placeholder="Rechercher un produit..."
                    className="h-8 text-xs pl-8"
                />
            </div>
            <div className="flex gap-4 flex-1 min-h-0">
                {renderColumn("Homme")}
            </div>
        </div>
    )
})

type StyleField = "besoinsHomme" | "besoinsFemme" | "Matiere"

const StyleGroup = memo(function StyleGroup({
    title,
    options,
    field,
    selected,
    onToggle,
}: {
    title: string
    options: string[]
    field: StyleField
    selected: string[]
    onToggle: (field: StyleField, label: string) => void
}) {
    return (
        <div className="flex-1 p-3 border rounded-lg bg-muted/10 h-full">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                {title}
            </h4>
            <div className="flex flex-wrap gap-2">
                {options.map((label: string) => {
                    const isSelected = selected.includes(label)
                    return (
                        <Badge
                            key={label}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => onToggle(field, label)}
                        >
                            {label}
                        </Badge>
                    )
                })}
            </div>
        </div>
    )
})

const StylesSection = memo(function StylesSection({
    fiche,
    setFiche,
    saveFiche,
    byCategorie,
}: {
    fiche: FicheAppro
    setFiche: FicheSetter
    saveFiche: SaveFiche
    byCategorie: BriefOptionsByCategorie
}) {
    const toggleStyle = useCallback(
        (field: StyleField, label: string) => {
            setFiche((prev) => {
                const current = ((prev[field] as string[] | undefined) ||
                    []) as string[]
                const updated = current.includes(label)
                    ? current.filter((l: string) => l !== label)
                    : [...current, label]
                const newFiche = { ...prev, [field]: updated } as FicheAppro
                saveFiche(newFiche)
                return newFiche
            })
        },
        [setFiche, saveFiche]
    )

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-xl shadow-sm bg-background dark:bg-card h-full">
            <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-purple-500" />
                <h3 className="font-semibold">Styles Recherchés</h3>
            </div>
            <div className="flex flex-col gap-4 flex-1">
                <StyleGroup
                    title="Style rechercher"
                    options={(byCategorie.styles ?? []).map((o) => o.value)}
                    field="besoinsFemme"
                    selected={fiche.besoinsFemme ?? []}
                    onToggle={toggleStyle}
                />
                <StyleGroup
                    title="Matière"
                    options={(byCategorie.matieres ?? []).map((o) => o.value)}
                    field="Matiere"
                    selected={fiche.Matiere ?? []}
                    onToggle={toggleStyle}
                />
            </div>
        </div>
    )
})

const NotesSection = memo(function NotesSection({
    fiche,
    setFiche,
    saveFiche,
}: {
    fiche: FicheAppro
    setFiche: FicheSetter
    saveFiche: SaveFiche
}) {
    const [localNote, setLocalNote] = useState(fiche.Note || "")
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    // Frappe en attente (non encore commit par le debounce). `null` = rien à
    // flusher. Permet d'envoyer la dernière saisie au démontage plutôt que de
    // la perdre.
    const pendingNoteRef = useRef<string | null>(null)
    // Refs « toujours à jour » vers fiche/saveFiche : le cleanup de démontage
    // (deps []) doit utiliser la closure COURANTE (bon client), pas celle figée
    // au premier rendu.
    const ficheRef = useRef(fiche)
    ficheRef.current = fiche
    const saveFicheRef = useRef(saveFiche)
    saveFicheRef.current = saveFiche

    // Synchronise la note locale (éditable, debouncée) quand la note source change
    // (ex. changement de client). Synchronisation légitime d'un état externe vers
    // un état local éditable : non exprimable en valeur dérivée.
    // On annule aussi tout debounce en vol : un timeout armé sur le client
    // précédent tirerait avec la closure saveFiche de CE client et écrirait la
    // fiche du nouveau client (déjà hydratée dans le contexte) sur son id →
    // brief dupliqué entre deux clients.
    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        pendingNoteRef.current = null
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- resync d'un état local éditable sur changement de source
        setLocalNote(fiche.Note || "")
    }, [fiche.Note])

    // Au démontage (fermeture du dialog / changement d'onglet) : plutôt que de
    // jeter la frappe en attente, on la COMMIT immédiatement. On appelle
    // saveFiche directement (pas via un updater setFiche, dont le corps
    // s'exécuterait de façon asynchrone après le démontage) → la charge est
    // enregistrée en attente et le flush parent (fiche.tsx) l'envoie en DB.
    useEffect(() => {
        return () => {
            if (!timeoutRef.current) return
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
            const val = pendingNoteRef.current
            pendingNoteRef.current = null
            if (val === null) return
            saveFicheRef.current({ ...ficheRef.current, Note: val })
        }
    }, [])

    const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value
        setLocalNote(val)
        pendingNoteRef.current = val
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null
            pendingNoteRef.current = null
            setFiche((prev) => {
                const next = { ...prev, Note: val }
                saveFiche(next)
                return next
            })
        }, 800)
    }

    return (
        <div className="space-y-3">
            <h3 className="font-semibold text-sm">Notes Importantes</h3>
            <Textarea
                className="min-h-[100px] bg-yellow-50/20 dark:bg-yellow-950/10 border-yellow-200/50"
                value={localNote}
                onChange={onChange}
                placeholder="Notes importantes..."
            />
        </div>
    )
})
//
const SelectionBadge = memo(function SelectionBadge({
    label,
    isSelected,
    onClick,
}: {
    label: string
    isSelected: boolean
    onClick: () => void
}) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors border select-none",
                isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            )}
        >
            {label}
        </div>
    )
})
