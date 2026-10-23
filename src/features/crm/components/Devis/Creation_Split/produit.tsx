import React, { useState, useRef, useMemo, type ComponentType } from "react"
import { type Fournisseur } from "@/features/crm/hooks/CRM_hook/use_fournisseur"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Switch } from "@/shared/ui/atoms/switch"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import { type QuoteProduct } from "../creation"
import {
    Search,
    Plus,
    Tag,
    Scale,
    Package,
    Euro,
    Percent,
    Box,
    FileText,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

const InputIcon = ({
    icon: Icon,
    className,
}: {
    icon: ComponentType<{ className?: string }>
    className?: string
}) => (
    <div
        className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
            className
        )}
    >
        <Icon className="w-4 h-4" />
    </div>
)

export default function ProductInput() {
    const { setIsSidebarOpen } = useCRMContext()

    // Refs pour gérer le focus lors du changement d'onglet
    const productInputRef = useRef<HTMLInputElement>(null)
    const discountInputRef = useRef<HTMLInputElement>(null)

    const {
        inputValue,
        setInputValue,
        products,
        setRemises,
        round2,
        TVA,
        setProducts,
        checkedKil,
        setCheckedKil,
        fournisseurs, // On récupère tes fournisseurs/catégories ici
    } = useDevisContext()

    const [inputType, setInputType] = useState<"product" | "discount">(
        "product"
    )

    // --- STATES PRODUIT ---
    const [customDescription, setCustomDescription] = useState("")
    const [customPrice, setCustomPrice] = useState(0)
    const [customWeight, setCustomWeight] = useState(0)
    const [quantity, setQuantity] = useState(1)
    const [customName, setCustomName] = useState("")
    const [suggestionsVisible, setSuggestionsVisible] = useState(false)

    // --- STATES REMISE ---
    const [discountValue, setDiscountValue] = useState(0)
    const [discountName, setDiscountName] = useState("")
    const [discountType, setDiscountType] = useState<"percent" | "fixed">(
        "percent"
    )

    // --- LOGIQUE SUGGESTIONS BASÉE SUR LES FOURNISSEURS (Catégories) ---
    const filteredFournisseurs = useMemo(() => {
        if (!inputValue || !fournisseurs) return []
        const lowerVal = inputValue.toLowerCase()
        return fournisseurs.filter((f) =>
            f.name.toLowerCase().includes(lowerVal)
        )
    }, [fournisseurs, inputValue])

    const handleSelectFournisseur = (f: Fournisseur) => {
        setInputValue(f.name)
        setCustomName(f.name)
        setCustomPrice(f.unit_price || 0)
        setCustomWeight(f.unit_weight || 0)
        setCustomDescription("")
        setSuggestionsVisible(false)
    }

    const resetFields = () => {
        // Reset Produit
        setInputValue("")
        setCustomName("")
        setCustomDescription("")
        setCustomPrice(0)
        setCustomWeight(0)
        setQuantity(1)

        // Reset Remise
        setDiscountValue(0)
        setDiscountName("")

        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
        }
    }

    const addProduct = () => {
        const isKiloMode = checkedKil
        const name = customName || inputValue || "Produit sans nom"
        const description = customDescription || ""
        const tvaRate = Number(TVA) || 20
        const price = customPrice || 0
        const weight = customWeight || 0

        const qtyToUse = quantity === 0 ? 1 : quantity
        const qty = isKiloMode ? 1 : qtyToUse

        const baseHT = isKiloMode ? price * weight : price * qty
        const totalTVA = (baseHT * tvaRate) / 100
        const totalTTC = baseHT + totalTVA

        const newProduct: QuoteProduct = {
            id: Date.now().toString(),
            name,
            description,
            qty,
            weight,
            price,
            tva: tvaRate,
            totalHT: round2(baseHT),
            totalTVA: round2(totalTVA),
            totalTTC: round2(totalTTC),
            mode: isKiloMode ? "Kilo" : "Pièce",
        }

        setProducts((prev) => [...prev, newProduct])
        if (products.length === 0) {
            setIsSidebarOpen(true)
        }
        resetFields()
    }

    const addDiscount = () => {
        const baseHT = products
            .filter((p) => p.mode !== "Remise")
            .reduce((sum, p) => sum + p.totalHT, 0)

        const remiseValue =
            discountType === "percent"
                ? -(baseHT * (discountValue || 0)) / 100
                : -(discountValue || 0)

        const nameToUse = discountName.trim() !== "" ? discountName : "Remise"

        const newRemise: QuoteProduct = {
            id: Date.now().toString(),
            name: nameToUse,
            description:
                discountType === "percent"
                    ? `${discountValue}%`
                    : `${discountValue} €`,
            qty: 1,
            weight: 0,
            price: remiseValue,
            tva: 0,
            totalHT: remiseValue,
            totalTVA: 0,
            totalTTC: remiseValue,
            mode: "Remise",
        }

        setRemises((prev) => [...prev, newRemise])
        setIsSidebarOpen(true)
        resetFields()
    }

    // Validation
    const isProductValid =
        (customName || inputValue) &&
        (checkedKil
            ? customPrice > 0 && customWeight > 0
            : customPrice > 0 && quantity > 0)
    const isDiscountValid = discountValue > 0

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault()
            if (inputType === "product" && isProductValid) addProduct()
            else if (inputType === "discount" && isDiscountValid) addDiscount()
        }
    }

    return (
        <div
            className={cn(
                "rounded-xl border shadow-sm overflow-visible"
            )}
        >
            {/* --- HEADER & TOOLBAR --- */}
            <div className="flex flex-col sm:flex-row justify-between items-center p-2 gap-2 border-b bg-muted/20">
                <div className="flex bg-background rounded-lg p-1 border shadow-sm w-full sm:w-auto">
                    <button
                        onClick={() => {
                            setInputType("product")
                            setTimeout(
                                () => productInputRef.current?.focus(),
                                0
                            )
                        }}
                        className={cn(
                            "flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2",
                            inputType === "product"
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Package className="w-3.5 h-3.5" /> Produit
                    </button>
                    <button
                        onClick={() => {
                            setInputType("discount")
                            setTimeout(
                                () => discountInputRef.current?.focus(),
                                0
                            )
                        }}
                        className={cn(
                            "flex-1 sm:flex-none px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2",
                            inputType === "discount"
                                ? // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte posé sur un aplat saturé fixe (identique dans les deux thèmes) : non tokenisable (design system §12.4)
                                  "bg-purple-600 text-white shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Tag className="w-3.5 h-3.5" /> Remise
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-background border rounded-lg px-3 py-1.5 h-10 shadow-sm w-full sm:w-auto justify-between sm:justify-end">
                    <span
                        className={cn(
                            "text-xs font-medium flex items-center gap-1.5 transition-colors",
                            (inputType === "discount" &&
                                discountType === "percent") ||
                                (inputType === "product" && checkedKil)
                                ? inputType === "discount"
                                    ? "text-purple-600"
                                    : "text-primary"
                                : "text-muted-foreground"
                        )}
                    >
                        {inputType === "discount" ? (
                            <Percent className="w-3.5 h-3.5" />
                        ) : (
                            <Scale className="w-3.5 h-3.5" />
                        )}
                        {inputType === "discount" ? "%" : "Kilo"}
                    </span>
                    <Switch
                        checked={
                            inputType === "discount"
                                ? discountType === "fixed"
                                : !checkedKil
                        }
                        onCheckedChange={(checked) => {
                            if (inputType === "discount")
                                setDiscountType(checked ? "fixed" : "percent")
                            else setCheckedKil(!checked)
                        }}
                        className={cn(
                            "data-[state=unchecked]:bg-input scale-90",
                            inputType === "discount"
                                ? "data-[state=checked]:bg-purple-600 data-[state=unchecked]:bg-purple-600"
                                : "data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-green-600"
                        )}
                    />
                    <span
                        className={cn(
                            "text-xs font-medium flex items-center gap-1.5 transition-colors",
                            (inputType === "discount" &&
                                discountType === "fixed") ||
                                (inputType === "product" && !checkedKil)
                                ? inputType === "discount"
                                    ? "text-purple-600"
                                    : "text-blue-600"
                                : "text-muted-foreground"
                        )}
                    >
                        {inputType === "discount" ? "Fixe" : "Pièce"}
                        {inputType === "discount" ? (
                            <Euro className="w-3.5 h-3.5" />
                        ) : (
                            <Box className="w-3.5 h-3.5" />
                        )}
                    </span>
                </div>
            </div>

            {/* --- FORM BODY --- */}
            <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end animate-in fade-in slide-in-from-top-1 duration-base">
                    {inputType === "product" ? (
                        <>
                            {/* --- PRODUIT (Dropdown basé sur les Fournisseurs) --- */}
                            <div className="md:col-span-3 space-y-1.5 relative">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Produit / Catégorie
                                </label>
                                <div className="relative group">
                                    <InputIcon
                                        icon={Search}
                                        className="group-hover:text-primary transition-colors z-10"
                                    />
                                    <Input
                                        ref={productInputRef}
                                        type="text"
                                        placeholder="Ex: 70'S SHIRT..."
                                        value={inputValue}
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setInputValue(val)
                                            setCustomName(val)
                                            setSuggestionsVisible(true)
                                        }}
                                        onFocus={() =>
                                            setSuggestionsVisible(true)
                                        }
                                        onBlur={() =>
                                            setTimeout(
                                                () =>
                                                    setSuggestionsVisible(
                                                        false
                                                    ),
                                                150
                                            )
                                        }
                                        className="pl-9 bg-background focus-visible:ring-primary"
                                    />

                                    {/* MENU DÉROULANT FOURNISSEURS */}
                                    {suggestionsVisible &&
                                        inputValue.length > 0 && (
                                            <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full min-w-[min(100%,250px)] bg-popover border border-border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[300px] animate-in fade-in zoom-in-95 duration-instant">
                                                <div className="overflow-y-auto p-1 custom-scrollbar">
                                                    {filteredFournisseurs.length >
                                                    0 ? (
                                                        filteredFournisseurs.map(
                                                            (f) => (
                                                                <div
                                                                    key={f.id}
                                                                    onMouseDown={(
                                                                        e
                                                                    ) => {
                                                                        e.preventDefault()
                                                                        handleSelectFournisseur(
                                                                            f
                                                                        )
                                                                    }}
                                                                    className={cn(
                                                                        "flex items-center justify-between px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors",
                                                                        inputValue.toLowerCase() ===
                                                                            f.name.toLowerCase()
                                                                            ? "bg-primary/10 text-primary font-medium"
                                                                            : "hover:bg-muted text-foreground"
                                                                    )}
                                                                >
                                                                    <span className="font-medium">
                                                                        {f.name}
                                                                    </span>

                                                                    {/* Affichage du Tag à la place du stock */}
                                                                    {f.tag && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted text-muted-foreground uppercase font-bold tracking-wider">
                                                                            {
                                                                                f.tag
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )
                                                        )
                                                    ) : (
                                                        <EmptyState
                                                            size="sm"
                                                            variant="search"
                                                            icon={Search}
                                                            title="Aucune catégorie correspondante"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* --- DESCRIPTION --- */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Description
                                </label>
                                <div className="relative">
                                    <InputIcon icon={FileText} />
                                    <Input
                                        value={customDescription}
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setCustomDescription(e.target.value)
                                        }
                                        placeholder="Détails"
                                        className="pl-9 bg-background focus-visible:ring-offset-0"
                                    />
                                </div>
                            </div>

                            {/* --- PRIX --- */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Prix {checkedKil ? "/ Kg" : "Unit."}
                                </label>
                                <div className="relative">
                                    <InputIcon icon={Euro} />
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={
                                            customPrice === 0 ? "" : customPrice
                                        }
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setCustomPrice(
                                                Number(e.target.value)
                                            )
                                        }
                                        className="pl-9 bg-background font-mono focus-visible:ring-offset-0"
                                    />
                                </div>
                            </div>

                            {/* --- QUANTITÉ --- */}
                            <div
                                className={cn(
                                    "md:col-span-2 space-y-1.5",
                                    checkedKil &&
                                        "opacity-50 pointer-events-none"
                                )}
                            >
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Quantité
                                </label>
                                <div className="relative">
                                    <InputIcon icon={Package} />
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={quantity === 0 ? "" : quantity}
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setQuantity(Number(e.target.value))
                                        }
                                        className="pl-9 bg-background font-mono focus-visible:ring-offset-0"
                                    />
                                </div>
                            </div>

                            {/* --- POIDS --- */}
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Poids (Kg) {!checkedKil && "(Opt.)"}
                                </label>
                                <div className="relative">
                                    <InputIcon icon={Scale} />
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={
                                            customWeight === 0
                                                ? ""
                                                : customWeight
                                        }
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setCustomWeight(
                                                Number(e.target.value)
                                            )
                                        }
                                        className="pl-9 bg-background font-mono focus-visible:ring-offset-0"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-1 flex justify-end pb-0.5">
                                <Button
                                    onClick={addProduct}
                                    disabled={!isProductValid}
                                    size="icon"
                                    className="w-10 h-10 shrink-0 rounded-lg shadow-sm transition-transform hover:scale-105 active:scale-95"
                                    variant={
                                        !isProductValid ? "ghost" : "default"
                                    }
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* --- REMISE --- */}
                            <div className="md:col-span-7 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Intitulé (Optionnel)
                                </label>
                                <div className="relative">
                                    <InputIcon
                                        icon={Tag}
                                        className="text-purple-500"
                                    />
                                    <Input
                                        ref={discountInputRef}
                                        type="text"
                                        placeholder="Ex: Remise Fidélité, Geste commercial..."
                                        value={discountName}
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setDiscountName(e.target.value)
                                        }
                                        className="pl-9 bg-background border-purple-200 focus-visible:ring-purple-500/20"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                                    Valeur{" "}
                                    {discountType === "percent" ? "(%)" : "(€)"}
                                </label>
                                <div className="relative">
                                    <InputIcon
                                        icon={
                                            discountType === "percent"
                                                ? Percent
                                                : Euro
                                        }
                                        className="text-purple-500"
                                    />
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="0"
                                        value={
                                            discountValue === 0
                                                ? ""
                                                : discountValue
                                        }
                                        onKeyDown={handleKeyDown}
                                        onChange={(e) =>
                                            setDiscountValue(
                                                Number(e.target.value)
                                            )
                                        }
                                        className="pl-9 bg-background border-purple-200 focus-visible:ring-purple-500/20 text-base sm:text-lg h-10 font-medium font-mono"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-1 flex justify-end pb-0.5">
                                <Button
                                    onClick={addDiscount}
                                    disabled={!isDiscountValid}
                                    size="icon"
                                    className="w-10 h-10 shrink-0 rounded-lg shadow-sm bg-primary hover:bg-primary-hover text-primary-foreground transition-[transform,background-color] hover:scale-105 active:scale-95"
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
