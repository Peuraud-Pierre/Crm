import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
    AlertCircle,
    HelpCircle,
    Truck,
    Calculator,
    Settings2,
    Wand2,
    Plus,
    Trash2,
    PieChart,
    Scale,
    Hash,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { TooltipProvider } from "@/shared/ui/atoms/tooltip"
import { InfoTooltip } from "@/shared/ui/molecules/info-tooltip"
import { CategorySelectControlled } from "./LivraisonCategorySelect"
import FournisseurSelectControlled from "./LivraisonFournisseurSelect"
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/atoms/accordion"
import type {
    BalleLocation,
    BalleStatus,
    CategoryDistribution,
    DeliveryFormInput,
    PackingMode,
} from "@/features/stock/types/stock.types"
import {
    calculateAverageWeight,
    generateBIN,
    generateDIN,
    getBalleTypeFromWeight,
    calculateBalleWeight,
    calculateWeightedAverage,
} from "@/features/stock/utils/stockHelpers"
import { useDistributions } from "../../../hooks/data/useDistribution"
import { GESTION_THEME } from "@/features/stock/theme"
import {
    useBalleContext,
    useDeliveryContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"

export default function DeliveryCreationSheet() {
    const {
        deliveryCreationFormData,
        setDeliveryCreationFormData,
        deliveryCreationSheetOpen,
        setDeliveryCreationSheetOpen,
        createDelivery,
        updateDelivery,
        fetchDeliveryByDIN,
    } = useDeliveryContext()

    const { fournisseurs, categories } = useReferentialContext()

    const { createMultipleBalles } = useBalleContext()

    // ===== LOCAL STATE =====
    const [isLoading, setIsLoading] = useState(false)
    const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(
        null
    )
    const [isManualPoidsMoyen, setIsManualPoidsMoyen] = useState(false)
    const [accordionValue, setAccordionValue] =
        useState<string>("info-principale")
    const [hasAutoAdvanced, setHasAutoAdvanced] = useState(false)
    const [packingMode, setPackingMode] = useState<PackingMode>("kilos")

    // ===== CUSTOM HOOKS =====
    const distributions = useDistributions(
        deliveryCreationFormData,
        setDeliveryCreationFormData
    )

    // ===== RESET ON OPEN =====
    // deliveryCreationFormData intentionally excluded from deps: we snapshot it once on open
    // to preserve preset values (fournisseur_id, delivery_date) injected by the
    // action menu before the sheet is shown, then reset everything else.
    // Réinitialisation d'un formulaire contrôlé à l'ouverture du panneau : les setState
    // directs sont volontaires (reset), d'où le disable ciblé.
    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
    useEffect(() => {
        if (deliveryCreationSheetOpen) {
            const now = new Date()
            setDeliveryCreationFormData({
                delivery_date:  deliveryCreationFormData?.delivery_date  || now.toISOString().slice(0, 10),
                fournisseur_id: deliveryCreationFormData?.fournisseur_id || "",
                packing:        "",
                balles_count:   0,
                poids_moyen:    0,
                distributions:  [],
            })
            setIsManualPoidsMoyen(false)
            setAccordionValue("info-principale")
            setHasAutoAdvanced(false)
            setPackingMode("kilos")
            setSubmitErrorMessage(null)
        }
    }, [deliveryCreationSheetOpen, setDeliveryCreationFormData])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    // ===== CALCUL POIDS MOYEN =====
    const poidsMoyen = useMemo(() => {
        if (isManualPoidsMoyen) {
            return deliveryCreationFormData?.poids_moyen || 0
        }

        const packValue = Number(deliveryCreationFormData?.packing)
        const countValue = Number(deliveryCreationFormData?.balles_count)

        return calculateAverageWeight(packValue, countValue)
    }, [
        isManualPoidsMoyen,
        deliveryCreationFormData?.packing,
        deliveryCreationFormData?.balles_count,
        deliveryCreationFormData?.poids_moyen,
    ])

    // ===== MAJ AUTO POIDS MOYEN =====
    useEffect(() => {
        if (
            !isManualPoidsMoyen &&
            poidsMoyen !== deliveryCreationFormData?.poids_moyen
        ) {
            setDeliveryCreationFormData({
                ...deliveryCreationFormData,
                poids_moyen: poidsMoyen,
            })
        }
    }, [
        poidsMoyen,
        isManualPoidsMoyen,
        deliveryCreationFormData,
        setDeliveryCreationFormData,
    ])

    // ===== VALIDATION FORMULAIRE =====
    const isFormValid = useMemo(() => {
        return Boolean(
            deliveryCreationFormData?.packing &&
            deliveryCreationFormData?.balles_count &&
            deliveryCreationFormData?.fournisseur_id &&
            deliveryCreationFormData?.poids_moyen &&
            distributions.isValid
        )
    }, [
        deliveryCreationFormData?.packing,
        deliveryCreationFormData?.balles_count,
        deliveryCreationFormData?.fournisseur_id,
        deliveryCreationFormData?.poids_moyen,
        distributions.isValid,
    ])

    // ===== VALIDATION CATÉGORIES POUR MODE PIÈCE =====
    const missingUnitWeightCategories = useMemo(() => {
        if (packingMode !== "pieces") return []

        return (deliveryCreationFormData?.distributions || [])
            .filter((dist: CategoryDistribution) => {
                const category = categories?.find(
                    (c) => c.id === dist.category_id
                )
                return (
                    category &&
                    (!category.unit_weight || category.unit_weight === 0)
                )
            })
            .map((dist: CategoryDistribution) => {
                const category = categories?.find(
                    (c) => c.id === dist.category_id
                )
                return category?.name || "Inconnue"
            })
    }, [packingMode, deliveryCreationFormData?.distributions, categories])

    // ===== AUTO-ADVANCE ACCORDION =====
    useEffect(() => {
        const isInfoComplete =
            Number(deliveryCreationFormData?.packing) > 0 &&
            Number(deliveryCreationFormData?.balles_count) > 0 &&
            deliveryCreationFormData?.fournisseur_id !== ""

        if (
            isInfoComplete &&
            !hasAutoAdvanced &&
            accordionValue === "info-principale"
        ) {
            const timer = setTimeout(() => {
                setAccordionValue("repartition")
                setHasAutoAdvanced(true)
            }, 600)

            return () => clearTimeout(timer)
        }
    }, [
        deliveryCreationFormData?.packing,
        deliveryCreationFormData?.balles_count,
        deliveryCreationFormData?.fournisseur_id,
        accordionValue,
        hasAutoAdvanced,
    ])

    // ===== FORM HANDLERS =====
    const handlePackingModeToggle = useCallback(() => {
        const newMode: PackingMode =
            packingMode === "kilos" ? "pieces" : "kilos"
        setPackingMode(newMode)
        setDeliveryCreationFormData({
            ...deliveryCreationFormData,
            packing: "",
        })
    }, [packingMode, deliveryCreationFormData, setDeliveryCreationFormData])

    const updateFormField = useCallback(
        <K extends keyof DeliveryFormInput>(field: K, value: DeliveryFormInput[K]) => {
            setDeliveryCreationFormData({
                ...deliveryCreationFormData,
                [field]: value,
            })
        },
        [deliveryCreationFormData, setDeliveryCreationFormData]
    )

    // ===== SUBMIT =====
    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        setSubmitErrorMessage(null)

        // Validation
        if (!distributions.isValid) {
            if (distributions.isUnderDistributed) {
                setSubmitErrorMessage(
                    `Toutes les balles doivent être distribuées. Il reste ${
                        (deliveryCreationFormData?.balles_count || 0) -
                        distributions.totalDistributed
                    } balle(s) à répartir.`
                )
            } else if (distributions.isOverDistributed) {
                setSubmitErrorMessage(
                    `Le nombre de balles distribuées (${distributions.totalDistributed}) dépasse le nombre total (${
                        deliveryCreationFormData?.balles_count || 0
                    }).`
                )
            } else {
                setSubmitErrorMessage(
                    "La répartition est obligatoire et toutes les catégories doivent être sélectionnées."
                )
            }
            return
        }

        // Validation mode pièces
        if (
            packingMode === "pieces" &&
            missingUnitWeightCategories.length > 0
        ) {
            setSubmitErrorMessage(
                `Les catégories suivantes n'ont pas de poids unitaire défini : ${missingUnitWeightCategories.join(", ")}`
            )
            return
        }

        if (!deliveryCreationFormData?.fournisseur_id) {
            setSubmitErrorMessage("Veuillez sélectionner un fournisseur.")
            return
        }

        setIsLoading(true)

        try {
            // 1. Récupération fournisseur
            const fournisseur = fournisseurs?.find(
                (f) => f.id === deliveryCreationFormData.fournisseur_id
            )
            if (!fournisseur) {
                throw new Error("Fournisseur introuvable.")
            }

            // 2. Génération DIN
            const poidsMoyenValue = deliveryCreationFormData.poids_moyen || 0
            const deliveryDate = new Date(
                deliveryCreationFormData.delivery_date || new Date()
            )

            const din = generateDIN({
                poids_moyen: poidsMoyenValue,
                fournisseur: {
                    tag: fournisseur.tag,
                    siege_localisation: fournisseur.siege_localisation,
                },
                delivery_date: deliveryDate,
            })

            // 3. Vérification / Création / Update Livraison
            const existingDelivery = await fetchDeliveryByDIN(din)
            let deliveryId: string
            let startBalleIndex = 0

            const newBallesCount = deliveryCreationFormData.balles_count || 0
            const newPacking = Number(deliveryCreationFormData.packing || 0)

            if (existingDelivery) {
                // UPDATE livraison existante
                deliveryId = existingDelivery.id
                startBalleIndex = existingDelivery.balles_count || 0

                const totalBallesCumule =
                    (existingDelivery.balles_count || 0) + newBallesCount
                const totalPackingCumule =
                    Number(existingDelivery.packing || 0) + newPacking
                const nouveauPoidsMoyenGlobal = calculateWeightedAverage(
                    Number(existingDelivery.packing || 0),
                    existingDelivery.balles_count || 0,
                    newPacking,
                    newBallesCount
                )

                await updateDelivery(deliveryId, {
                    balles_count: totalBallesCumule,
                    packing: totalPackingCumule.toString(),
                    poids_moyen: nouveauPoidsMoyenGlobal,
                })
            } else {
                // CRÉATION nouvelle livraison
                const newDelivery = await createDelivery({
                    din,
                    fournisseur_id: fournisseur.id,
                    delivery_date: deliveryCreationFormData.delivery_date,
                    packing: deliveryCreationFormData.packing,
                    balles_count: newBallesCount,
                    delivery_type: getBalleTypeFromWeight(poidsMoyenValue),
                    poids_moyen: poidsMoyenValue,
                })
                if (!newDelivery) {
                    throw new Error("Échec création livraison.")
                }
                deliveryId = newDelivery.id
            }

            // 4. Génération des balles
            const isComing = deliveryDate > new Date()
            let currentBalleIndex = startBalleIndex

            const ballesToCreate = (
                deliveryCreationFormData.distributions || []
            ).flatMap((dist: CategoryDistribution) => {
                const category = categories?.find(
                    (c) => c.id === dist.category_id
                )
                if (!category) {
                    console.warn(`Catégorie ${dist.category_id} introuvable`)
                    return []
                }

                return Array.from({ length: dist.count }).map(() => {
                    currentBalleIndex++

                    // `tag` est typé `string` mais la colonne est nullable : une
                    // catégorie ancienne sans tag faisait lever cette ligne. Les
                    // catégories créées depuis maintenant en portent toujours un
                    // (categorieService.insertCategory le déduit du nom).
                    const bin = generateBIN(
                        din,
                        currentBalleIndex.toString(),
                        (category.tag ?? "").substring(0, 4).toUpperCase()
                    )

                    const ballePacking = calculateBalleWeight(
                        packingMode,
                        poidsMoyenValue,
                        category.unit_weight || 0
                    )

                    const purchasePrice = category.unit_price && category.unit_price > 0
                        ? ballePacking * category.unit_price
                        : undefined

                    return {
                        bin,
                        delivery_id: deliveryId,
                        fournisseur_id:
                            deliveryCreationFormData.fournisseur_id || "",
                        category_id: dist.category_id,
                        packing: ballePacking,
                        type: getBalleTypeFromWeight(ballePacking),
                        status: (isComing
                            ? "shipped"
                            : "stocked") as BalleStatus,
                        location: (isComing
                            ? "out"
                            : "warehouse") as BalleLocation,
                        import_date: deliveryCreationFormData.delivery_date,
                        is_original: true,
                        purchase_price: purchasePrice,
                    }
                })
            })

            // 5. Bulk insert
            if (ballesToCreate.length > 0) {
                await createMultipleBalles(ballesToCreate)
            }

            setDeliveryCreationSheetOpen(false)
        } catch (err: unknown) {
            console.error("❌ Erreur:", err)
            setSubmitErrorMessage(
                err instanceof Error
                    ? err.message
                    : (typeof err === "object" && err !== null && "message" in err
                          ? String((err as { message: unknown }).message)
                          : null) ?? "Erreur lors de l'opération."
            )
        } finally {
            setIsLoading(false)
        }
    }

    // ===== RENDER =====
    return (
        <TooltipProvider delayDuration={300}>
            <Sheet
                open={deliveryCreationSheetOpen}
                onOpenChange={setDeliveryCreationSheetOpen}
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
                        <SheetHeader className={cn("pb-6 border-b shrink-0")}>
                            <SheetTitle className="flex items-center gap-2">
                                <Truck
                                    size={25}
                                    className={GESTION_THEME.bar.icon}
                                />
                                <Label
                                    className={cn(
                                        "text-lg font-bold",
                                        GESTION_THEME.page.text
                                    )}
                                >
                                    Créer une livraison
                                </Label>
                                <InfoTooltip
                                    icon={HelpCircle}
                                    size={18}
                                    side="bottom"
                                    content={
                                        <div className="space-y-3 max-w-xs">
                                            <div className="flex items-center gap-2">
                                                <Label className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                                    Enregistrement de livraison
                                                </Label>
                                            </div>
                                            <Label className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                                Permet de générer un DIN unique
                                                et de pré-enregistrer un lot de
                                                balles dans le système de
                                                gestion.
                                            </Label>
                                        </div>
                                    }
                                />
                            </SheetTitle>
                            <SheetDescription>
                                Enregistrez une nouvelle réception de stock.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex-1 py-6 space-y-8 overflow-y-auto pr-2 px-2">
                            <Accordion
                                type="single"
                                collapsible
                                value={accordionValue}
                                onValueChange={setAccordionValue}
                                className="w-full"
                            >
                                {/* PARTIE 1 : INFORMATIONS PRINCIPALES */}
                                <AccordionItem
                                    value="info-principale"
                                    className="border-none"
                                >
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div
                                            className={cn(
                                                "flex items-center gap-2",
                                                GESTION_THEME.page.text
                                            )}
                                        >
                                            <Calculator size={16} />
                                            <Label className="text-sm font-bold uppercase tracking-wider">
                                                Informations Principales
                                            </Label>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="overflow-visible p-1">
                                        <div className="space-y-6 pt-4">
                                            {/* Date d'import */}
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                        Date d'import
                                                    </Label>
                                                    <InfoTooltip content="Date de réception prévue ou effective de la livraison." />
                                                </div>
                                                <Input
                                                    type="date"
                                                    required
                                                    className={cn(
                                                        GESTION_THEME.input
                                                            .base,
                                                        GESTION_THEME.input
                                                            .text,
                                                        GESTION_THEME.input
                                                            .focus
                                                    )}
                                                    value={
                                                        deliveryCreationFormData?.delivery_date ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        updateFormField(
                                                            "delivery_date",
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>

                                            {/* Packing avec Toggle */}
                                            <div
                                                className={cn(
                                                    "flex flex-col gap-3 Label-3 border",
                                                    GESTION_THEME.toggleGroup
                                                        .container
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Label
                                                            className={cn(
                                                                GESTION_THEME
                                                                    .page.title
                                                            )}
                                                        >
                                                            Packing Total
                                                        </Label>
                                                        <InfoTooltip content="Poids total de la livraison en kilos ou nombre total de pièces. Le poids de chaque balle sera calculé lors de la répartition." />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={
                                                            handlePackingModeToggle
                                                        }
                                                        className="h-7 px-2 text-3xs uppercase font-bold tracking-wider hover:bg-transparent dark:hover:bg-transparent"
                                                    >
                                                        {packingMode ===
                                                        "pieces" ? (
                                                            <Badge className="transition-colors text-purple-600 bg-purple-100/50 hover:bg-purple-400/50 dark:bg-purple-900/30 dark:text-purple-400">
                                                                <Hash
                                                                    size={12}
                                                                    className="mr-1"
                                                                />
                                                                Pièce
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="transition-colors text-blue-600 bg-blue-100/50 hover:bg-blue-400/50 dark:bg-blue-900/30 dark:text-blue-400">
                                                                <Scale
                                                                    size={12}
                                                                    className="mr-1"
                                                                />
                                                                Kilos
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                </div>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        required
                                                        className={cn(
                                                            GESTION_THEME.input
                                                                .base,
                                                            GESTION_THEME.input
                                                                .text,
                                                            GESTION_THEME.input
                                                                .focus
                                                        )}
                                                        placeholder={
                                                            packingMode ===
                                                            "kilos"
                                                                ? "Ex: 25000"
                                                                : "Ex: 5000"
                                                        }
                                                        value={
                                                            deliveryCreationFormData?.packing ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateFormField(
                                                                "packing",
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                    <Label className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                        {packingMode === "kilos"
                                                            ? "kg"
                                                            : "pcs"}
                                                    </Label>
                                                </div>
                                            </div>

                                            {/* Nombre de balles */}
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                        Nombre de balles
                                                    </Label>
                                                    <InfoTooltip content="Nombre total de balles dans cette livraison." />
                                                </div>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    required
                                                    className={cn(
                                                        GESTION_THEME.input
                                                            .base,
                                                        GESTION_THEME.input
                                                            .text,
                                                        GESTION_THEME.input
                                                            .focus
                                                    )}
                                                    placeholder="Ex: 50"
                                                    value={
                                                        deliveryCreationFormData?.balles_count ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        updateFormField(
                                                            "balles_count",
                                                            Number(
                                                                e.target.value
                                                            )
                                                        )
                                                    }
                                                />
                                            </div>

                                            {/* Poids moyen */}
                                            <div
                                                className={cn(
                                                    "flex flex-col gap-3 Label-3 rounded-lg border",
                                                    GESTION_THEME.toggleGroup
                                                        .container
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                                            {packingMode ===
                                                            "kilos"
                                                                ? "Poids moyen estimé"
                                                                : "Pièces moyennes par balle"}
                                                        </Label>
                                                        <InfoTooltip
                                                            content={
                                                                packingMode ===
                                                                "kilos"
                                                                    ? "Poids moyen par balle. Calculé automatiquement (packing / nombre de balles) ou saisie manuelle."
                                                                    : "Nombre moyen de pièces par balle. Le poids réel sera calculé selon la catégorie."
                                                            }
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            setIsManualPoidsMoyen(
                                                                !isManualPoidsMoyen
                                                            )
                                                        }
                                                        className="h-7 px-2 text-3xs uppercase font-bold tracking-wider hover:bg-transparent dark:hover:bg-transparent"
                                                    >
                                                        {isManualPoidsMoyen ? (
                                                            <Badge className="transition-colors text-amber-600 bg-amber-100/50 hover:bg-amber-200/50 dark:bg-amber-900/30 dark:text-amber-400">
                                                                <Settings2
                                                                    size={12}
                                                                    className="mr-1"
                                                                />
                                                                Manuel
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="transition-colors text-blue-600 bg-blue-100/50 hover:bg-blue-200/50 dark:bg-blue-900/30 dark:text-blue-400">
                                                                <Wand2
                                                                    size={12}
                                                                    className="mr-1"
                                                                />
                                                                Auto
                                                            </Badge>
                                                        )}
                                                    </Button>
                                                </div>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        min="0.1"
                                                        step="0.01"
                                                        required
                                                        disabled={
                                                            !isManualPoidsMoyen
                                                        }
                                                        className={cn(
                                                            GESTION_THEME.input
                                                                .base,
                                                            GESTION_THEME.input
                                                                .text,
                                                            GESTION_THEME.input
                                                                .focus,
                                                            !isManualPoidsMoyen &&
                                                                "bg-slate-100 dark:bg-slate-800 font-bold"
                                                        )}
                                                        value={
                                                            deliveryCreationFormData?.poids_moyen ||
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateFormField(
                                                                "poids_moyen",
                                                                Number(
                                                                    e.target
                                                                        .value
                                                                )
                                                            )
                                                        }
                                                    />
                                                    <Label className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                                        {packingMode === "kilos"
                                                            ? "kg"
                                                            : "pcs"}
                                                    </Label>
                                                </div>
                                            </div>

                                            {/* Fournisseur */}
                                            <div className="flex flex-col gap-3">
                                                <FournisseurSelectControlled />
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>

                                <Separator
                                    className={GESTION_THEME.bar.separator}
                                />

                                {/* PARTIE 2 : RÉPARTITION */}
                                <AccordionItem
                                    value="repartition"
                                    className="border-none"
                                >
                                    <AccordionTrigger className="hover:no-underline py-4">
                                        <div
                                            className={cn(
                                                "flex items-center gap-2",
                                                GESTION_THEME.page.text
                                            )}
                                        >
                                            <PieChart size={16} />
                                            <Label className="text-sm font-bold uppercase tracking-wider">
                                                Répartition
                                            </Label>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="overflow-visible">
                                        <div className="space-y-4 pt-4">
                                            {/* Compteur */}
                                            <div className="flex items-center justify-between">
                                                <div
                                                    className={cn(
                                                        "text-xs font-bold",
                                                        distributions.isOverDistributed
                                                            ? "text-red-500 dark:text-red-400"
                                                            : distributions.totalDistributed ===
                                                                (deliveryCreationFormData?.balles_count ||
                                                                    0)
                                                              ? "text-emerald-600 dark:text-emerald-400"
                                                              : "text-amber-600 dark:text-amber-400"
                                                    )}
                                                >
                                                    Total :{" "}
                                                    {
                                                        distributions.totalDistributed
                                                    }{" "}
                                                    /{" "}
                                                    {deliveryCreationFormData?.balles_count ||
                                                        0}
                                                    {distributions.isUnderDistributed && (
                                                        <Label className="ml-2 text-3xs">
                                                            (
                                                            {(deliveryCreationFormData?.balles_count ||
                                                                0) -
                                                                distributions.totalDistributed}{" "}
                                                            restante
                                                            {(deliveryCreationFormData?.balles_count ||
                                                                0) -
                                                                distributions.totalDistributed >
                                                            1
                                                                ? "s"
                                                                : ""}
                                                            )
                                                        </Label>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Liste vide */}
                                            {(!deliveryCreationFormData?.distributions ||
                                                deliveryCreationFormData
                                                    .distributions.length ===
                                                    0) && (
                                                <div
                                                    className={cn(
                                                        "flex items-center justify-center py-4 border-2 border-dashed rounded-lg",
                                                        "border-slate-200 dark:border-slate-800"
                                                    )}
                                                >
                                                    <Label className="text-xs text-slate-400 dark:text-slate-500">
                                                        Ajoutez au moins une
                                                        catégorie
                                                    </Label>
                                                </div>
                                            )}

                                            {/* Lignes de distribution */}
                                            {deliveryCreationFormData?.distributions?.map(
                                                (
                                                    dist: CategoryDistribution,
                                                    index: number
                                                ) => (
                                                    <div
                                                        // Lignes sans id stable, ajoutées/supprimées par index (updateRow/removeRow).
                                                        // eslint-disable-next-line react-x/no-array-index-key
                                                        key={index}
                                                        className={cn(
                                                            "flex items-end gap-2 Label-3 rounded-md border",
                                                            GESTION_THEME.kanban
                                                                .column.bg,
                                                            GESTION_THEME.kanban
                                                                .column.border
                                                        )}
                                                    >
                                                        <div className="flex-1 flex flex-col gap-2">
                                                            <CategorySelectControlled
                                                                value={
                                                                    dist.category_id
                                                                }
                                                                onChange={(
                                                                    id
                                                                ) =>
                                                                    distributions.updateRow(
                                                                        index,
                                                                        "category_id",
                                                                        id
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <div className="w-24 flex flex-col gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <Label className="text-3xs uppercase font-bold text-slate-500 dark:text-slate-400">
                                                                    Quantité
                                                                </Label>
                                                                <InfoTooltip
                                                                    content="Nombre de balles de cette catégorie dans la livraison."
                                                                    side="top"
                                                                />
                                                            </div>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                className={cn(
                                                                    "h-9",
                                                                    GESTION_THEME
                                                                        .input
                                                                        .base,
                                                                    GESTION_THEME
                                                                        .input
                                                                        .text,
                                                                    GESTION_THEME
                                                                        .input
                                                                        .focus
                                                                )}
                                                                value={
                                                                    dist.count ||
                                                                    ""
                                                                }
                                                                onChange={(e) =>
                                                                    distributions.updateRow(
                                                                        index,
                                                                        "count",
                                                                        Number(
                                                                            e
                                                                                .target
                                                                                .value
                                                                        )
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="icon"
                                                            className="h-9 w-9 shrink-0"
                                                            onClick={() =>
                                                                distributions.removeRow(
                                                                    index
                                                                )
                                                            }
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                )
                                            )}

                                            {/* Bouton ajouter */}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={cn(
                                                    "w-full border-dashed",
                                                    GESTION_THEME.button.outline
                                                )}
                                                onClick={distributions.addRow}
                                            >
                                                <Plus
                                                    size={16}
                                                    className="mr-2"
                                                />
                                                Ajouter une catégorie
                                            </Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        {/* FOOTER */}
                        <SheetFooter
                            className={cn(
                                "pt-6 border-t shrink-0 flex-col gap-4"
                            )}
                        >
                            {submitErrorMessage && (
                                <div className="flex items-center gap-3 Label-3 text-sm font-medium text-red-800 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
                                    <AlertCircle
                                        size={18}
                                        className="shrink-0"
                                    />
                                    <Label>{submitErrorMessage}</Label>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end w-full">
                                <Button
                                    variant="ghost"
                                    type="button"
                                    className={cn(
                                        "w-full sm:w-auto",
                                        GESTION_THEME.button.ghost
                                    )}
                                    onClick={() =>
                                        setDeliveryCreationSheetOpen(false)
                                    }
                                    disabled={isLoading}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    type="submit"
                                    className={cn(
                                        "w-full sm:w-auto",
                                        GESTION_THEME.button.primary
                                    )}
                                    disabled={!isFormValid}
                                    loading={isLoading}
                                >
                                    {isLoading
                                        ? "Création…"
                                        : "Créer la livraison"}
                                </Button>
                            </div>
                        </SheetFooter>
                    </form>
                </SheetContent>
            </Sheet>
        </TooltipProvider>
    )
}
