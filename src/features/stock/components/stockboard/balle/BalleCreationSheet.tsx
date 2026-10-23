import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import {
    AlertCircle,
    HelpCircle,
    Package,
    Scale,
    Hash,
} from "lucide-react"
import { useEffect, useState, useMemo } from "react"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    type BalleLocation,
} from "@/features/stock/types/stock.types"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import {
    generateBIN,
    generateDIN,
    getBalleTypeFromWeight,
} from "@/features/stock/utils/stockHelpers"

const LOCATION_OPTIONS = [
    { value: "warehouse",  label: "Entrepôt Principal" },
    { value: "import_bay", label: "Quai de déchargement" },
    { value: "tri_gros",   label: "Zone Tri Gros" },
    { value: "tri_retail", label: "Zone Tri Retail" },
    { value: "handpick",   label: "Zone Handpick" },
]
import FournisseurSelect from "./BalleFournisseurSelect"
import CategorySelect from "./BalleCategorySelect"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { InfoTooltip } from "@/shared/ui/molecules/info-tooltip"
import { Badge } from "@/shared/ui/atoms/badge"
import { GESTION_THEME } from "@/features/stock/theme"
import { cn } from "@/shared/lib/utils"
import {
    useBalleContext,
    useDeliveryContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"

export default function BalleCreationSheet() {
    const {
        balleCreationFormData,
        setBalleCreationFormData,
        balleCreationSheetOpen,
        createBalle,
        setBalleCreationSheetOpen,
    } = useBalleContext()

    const { fetchSingleCategory, fetchSingleFournisseur, categories } =
        useReferentialContext()

    const { fetchDeliveryByDIN, createDelivery, updateDelivery } =
        useDeliveryContext()

    const [isLoading, setIsLoading] = useState(false)
    const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
        null
    )

    const [inputMode, setInputMode] = useState<"kilos" | "pieces">("kilos")
    const [pieceCount, setPieceCount] = useState<number>(0)

    // Réinitialisation du formulaire contrôlé à l'ouverture du panneau (setState directs volontaires).
    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
    useEffect(() => {
        if (balleCreationSheetOpen) {
            const now = new Date()
            setBalleCreationFormData({
                import_date: now.toISOString().slice(0, 10),
                is_original: true,
                location: "warehouse",
                status: "stocked",
            })
            setInputMode("kilos")
            setPieceCount(0)
        }
    }, [balleCreationSheetOpen])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    const selectedCategoryUnitWeight = useMemo(() => {
        if (!balleCreationFormData?.category_id || !categories) return 0
        const category = categories.find(
            (c) => c.id === balleCreationFormData.category_id
        )
        return category?.unit_weight || 0
    }, [balleCreationFormData?.category_id, categories])

    useEffect(() => {
        if (
            inputMode === "pieces" &&
            pieceCount > 0 &&
            selectedCategoryUnitWeight > 0
        ) {
            const calculatedWeight =
                Math.round(pieceCount * selectedCategoryUnitWeight * 100) / 100
            setBalleCreationFormData({
                ...balleCreationFormData,
                packing: calculatedWeight,
                type: getBalleTypeFromWeight(calculatedWeight),
            })
        }
    }, [inputMode, pieceCount, selectedCategoryUnitWeight])

    const getDeliveryTag = async (category_id: string): Promise<string> => {
        try {
            const response = await fetchSingleCategory(category_id)
            return response?.tag || "UNK"
        } catch {
            return "UNK"
        }
    }

    const getFournisseurInfo = async (
        fournisseur_id: string
    ): Promise<{ tag: string; loc: string }> => {
        try {
            const response = await fetchSingleFournisseur(fournisseur_id)
            return {
                tag: response?.tag || "",
                loc: response?.siege_localisation || "",
            }
        } catch {
            return { tag: "", loc: "" }
        }
    }

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSubmitErrorMessage(null)

        const rawPoids = balleCreationFormData?.packing || 0
        if (rawPoids <= 0 || !Number.isInteger(rawPoids)) {
            setSubmitErrorMessage(
                "Le poids doit être un nombre entier supérieur à 0."
            )
            return
        }

        setIsLoading(true)
        try {
            const currentPoids = balleCreationFormData?.packing || 0
            const currentCatId = balleCreationFormData?.category_id || ""
            const currentFournId = balleCreationFormData?.fournisseur_id || ""

            // Prix figé au moment de la création pour éviter la dérive avec les évolutions de prix unitaire
            const currentUnitPrice = categories.find((c) => c.id === currentCatId)?.unit_price ?? 0
            const purchasePrice = currentUnitPrice > 0 ? currentPoids * currentUnitPrice : undefined
            const fournisseurInfo = await getFournisseurInfo(currentFournId)

            const din = generateDIN({
                poids_moyen: currentPoids,
                fournisseur: {
                    tag: fournisseurInfo.tag,
                    siege_localisation: fournisseurInfo.loc,
                },
                delivery_date: new Date(
                    balleCreationFormData?.import_date || new Date()
                ),
            })

            let delivery = await fetchDeliveryByDIN(din)
            let finalBallesCount = 1

            if (!delivery) {
                delivery = await createDelivery({
                    din: din,
                    fournisseur_id: currentFournId,
                    delivery_date: balleCreationFormData?.import_date,
                    delivery_type: balleCreationFormData?.type,
                    poids_moyen: currentPoids,
                    packing: String(currentPoids),
                    balles_count: 1,
                })
                if (!delivery) throw new Error("Erreur Livraison")
            } else {
                const newTotalPacking =
                    Number(delivery.packing || 0) + currentPoids
                finalBallesCount = (delivery.balles_count || 0) + 1
                await updateDelivery(delivery.id, {
                    balles_count: finalBallesCount,
                    packing: String(newTotalPacking),
                })
            }

            const categoryTag = await getDeliveryTag(currentCatId)
            const bin = generateBIN(
                din,
                finalBallesCount.toString(),
                categoryTag
            )

            await createBalle({
                ...balleCreationFormData,
                bin: bin,
                delivery_id: delivery.id,
                fournisseur_id: currentFournId,
                category_id: currentCatId,
                purchase_price: purchasePrice,
            })

            setBalleCreationSheetOpen(false)
        } catch {
            setSubmitErrorMessage(
                "Une erreur est survenue lors de la création."
            )
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <TooltipProvider delayDuration={300}>
            <Sheet
                open={balleCreationSheetOpen}
                onOpenChange={setBalleCreationSheetOpen}
            >
                <SheetContent
                    className={cn(
                        "sm:max-w-[550px] w-full flex flex-col border-l",
                        GESTION_THEME.bar.container
                    )}
                >
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col h-full"
                    >
                        <SheetHeader className="pb-6 border-b dark:border-slate-800">
                            <SheetTitle className="flex items-center gap-2">
                                <Package
                                    className={GESTION_THEME.page.text}
                                    size={25}
                                />
                                <span
                                    className={cn(
                                        "text-lg font-bold",
                                        GESTION_THEME.page.text
                                    )}
                                >
                                    Créer une balle
                                </span>
                                <InfoTooltip
                                    icon={HelpCircle}
                                    size={18}
                                    content={
                                        <div className="space-y-2">
                                            <p className="font-bold border-b border-slate-700 pb-1 text-sm">
                                                Traçabilité
                                            </p>
                                            <p className="text-xs">
                                                Génération automatique du DIN
                                                (Livraison) et du BIN (Balle).
                                            </p>
                                        </div>
                                    }
                                />
                            </SheetTitle>
                            <SheetDescription className="text-slate-500 dark:text-slate-400">
                                Enregistrez une nouvelle unité de stock dans
                                l'inventaire.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex-1 py-6 space-y-6 overflow-y-auto px-1">
                            {/* Date Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Label className={GESTION_THEME.page.title}>
                                        Date d'import
                                    </Label>
                                    <InfoTooltip
                                        side="top"
                                        content="Indiquez la date à laquelle la balle a été importée pour assurer une bonne traçabilité."
                                    />
                                </div>
                                <Input
                                    type="date"
                                    className={cn(
                                        GESTION_THEME.input.base,
                                        GESTION_THEME.input.text,
                                        GESTION_THEME.input.focus
                                    )}
                                    value={
                                        typeof balleCreationFormData?.import_date ===
                                        "string"
                                            ? balleCreationFormData.import_date
                                            : ""
                                    }
                                    onChange={(e) =>
                                        setBalleCreationFormData({
                                            ...balleCreationFormData,
                                            import_date: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <Separator className="bg-slate-200 dark:bg-slate-800" />

                            {/* Packing Section */}
                            <div
                                className={cn(
                                    "p-4 rounded-xl border space-y-4",
                                    GESTION_THEME.toggleGroup.container
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Label
                                            className={GESTION_THEME.page.title}
                                        >
                                            PACKING TOTAL
                                        </Label>
                                        <InfoTooltip
                                            side="top"
                                            content="Indiquez le poids total de la balle. Vous pouvez basculer entre l'entrée en kilos ou en nombre de pièces."
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            const newMode =
                                                inputMode === "kilos"
                                                    ? "pieces"
                                                    : "kilos"
                                            setInputMode(newMode)
                                            if (newMode === "kilos")
                                                setPieceCount(0)
                                        }}
                                        className="h-7 px-2 text-3xs uppercase font-bold tracking-wider hover:bg-transparent dark:hover:bg-transparent"
                                    >
                                        {inputMode === "pieces" ? (
                                            <Badge className="transition-colors text-purple-600 bg-purple-100/50 hover:bg-purple-500/50 dark:bg-purple-900/30 dark:text-purple-400">
                                                <Hash
                                                    size={12}
                                                    className="mr-1"
                                                />
                                                Pièce
                                            </Badge>
                                        ) : (
                                            <Badge className="transition-colors text-blue-600 bg-blue-100/50 hover:bg-blue-500/50 dark:bg-blue-900/30 dark:text-blue-400">
                                                <Scale
                                                    size={12}
                                                    className="mr-1"
                                                />
                                                Kilos
                                            </Badge>
                                        )}
                                    </Button>
                                </div>

                                {inputMode === "kilos" ? (
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            className={cn(
                                                GESTION_THEME.input.base,
                                                GESTION_THEME.input.text,
                                                GESTION_THEME.input.focus
                                            )}
                                            onChange={(e) => {
                                                const val =
                                                    Number(e.target.value) || 0
                                                setBalleCreationFormData({
                                                    ...balleCreationFormData,
                                                    packing: val,
                                                    type: getBalleTypeFromWeight(
                                                        val
                                                    ),
                                                })
                                            }}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                            kg
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Nombre de pièces"
                                                className={cn(
                                                    "pr-12",
                                                    GESTION_THEME.input.base
                                                )}
                                                value={pieceCount || ""}
                                                onChange={(e) =>
                                                    setPieceCount(
                                                        Number(
                                                            e.target.value
                                                        ) || 0
                                                    )
                                                }
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                pcs
                                            </span>
                                        </div>
                                        {pieceCount > 0 &&
                                            selectedCategoryUnitWeight > 0 && (
                                                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-slate-500">
                                                            Ratio unitaire:
                                                        </span>
                                                        <span className="font-mono font-medium">
                                                            {
                                                                selectedCategoryUnitWeight
                                                            }{" "}
                                                            kg/pc
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between text-sm mt-1 pt-1 border-t dark:border-slate-800">
                                                        <span className="font-semibold">
                                                            Poids estimé:
                                                        </span>
                                                        <span className="font-bold text-green-600">
                                                            {balleCreationFormData?.packing ||
                                                                0}{" "}
                                                            kg
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                )}
                            </div>

                            <CategorySelect />
                            <FournisseurSelect />

                            <Separator className="bg-slate-200 dark:bg-slate-800" />

                            {/* Location Section */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Label
                                        className={cn(GESTION_THEME.page.title)}
                                    >
                                        Localisation initiale
                                    </Label>
                                    <InfoTooltip
                                        side="top"
                                        content="Indiquez où la balle est stockée à son arrivée pour faciliter sa localisation."
                                    />
                                </div>

                                <SearchSelect
                                    options={LOCATION_OPTIONS}
                                    value={balleCreationFormData?.location ?? ""}
                                    onChange={(v) => setBalleCreationFormData({
                                        ...balleCreationFormData,
                                        location: v as BalleLocation,
                                    })}
                                    placeholder="Sélectionner un emplacement"
                                    variant="button"
                                    size="md"
                                />
                            </div>
                        </div>

                        <SheetFooter className="pt-6 border-t dark:border-slate-800 flex-col gap-4">
                            {submitErrorMessage && (
                                <div className="flex items-center gap-3 p-3 text-sm font-medium text-red-800 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                                    <AlertCircle
                                        size={18}
                                        className="shrink-0"
                                    />
                                    <span>{submitErrorMessage}</span>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end w-full">
                                <Button
                                    variant="ghost"
                                    type="button"
                                    className="w-full sm:w-auto text-slate-500"
                                    onClick={() =>
                                        setBalleCreationSheetOpen(false)
                                    }
                                    disabled={isLoading}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    className={cn(
                                        // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                        "w-full sm:w-auto text-white shadow-lg",
                                        GESTION_THEME.button.primary
                                    )}
                                    disabled={
                                        !balleCreationFormData?.packing ||
                                        !balleCreationFormData?.fournisseur_id ||
                                        !balleCreationFormData?.category_id
                                    }
                                    loading={isLoading}
                                >
                                    {isLoading
                                        ? "Création…"
                                        : "Confirmer la création"}
                                </Button>
                            </div>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </TooltipProvider>
    )
}
