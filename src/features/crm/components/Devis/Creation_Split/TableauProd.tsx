import { memo, useCallback } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import { type QuoteProduct } from "@/features/crm/components/Devis/creation"

type QuoteProductField = keyof QuoteProduct
type QuoteProductValue = QuoteProduct[QuoteProductField]

interface ProductRowProps {
    p: QuoteProduct
    index: number
    round2: (num: number) => number
    onUpdateField: (
        index: number,
        field: QuoteProductField,
        value: QuoteProductValue
    ) => void
    onRemove: (index: number) => void
}

const ProductRow = memo(
    ({ p, index, round2, onUpdateField, onRemove }: ProductRowProps) => {
        const isKiloMode = p.mode === "Kilo"
        // Le calcul ne prend le poids en compte que si on est en mode "Kilo"
        const baseHT = isKiloMode ? p.price * p.weight : p.price * p.qty
        const totalHT = round2(baseHT)
        const totalTVA = round2((totalHT * (p.tva || 0)) / 100)
        const totalTTC = round2(totalHT + totalTVA)

        return (
            <tr className="hover:bg-[hsl(var(--card))] transition-colors">
                <td
                    className="px-3 py-2 border border-[hsl(var(--border))] cursor-pointer"
                    onDoubleClick={() => {
                        const newName = prompt(
                            "Modifier le nom du produit :",
                            p.name
                        )
                        if (newName !== null)
                            onUpdateField(index, "name", newName)
                    }}
                >
                    {p.name}
                </td>

                <td
                    className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] cursor-pointer hidden sm:table-cell"
                    onDoubleClick={() => {
                        const newDesc = prompt(
                            "Modifier la description :",
                            p.description
                        )
                        if (newDesc !== null)
                            onUpdateField(index, "description", newDesc)
                    }}
                >
                    {p.description}
                </td>

                <td
                    className={`px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right ${
                        isKiloMode
                            ? "text-[hsl(var(--muted-foreground))]"
                            : "cursor-pointer"
                    }`}
                    onDoubleClick={() => {
                        if (!isKiloMode) {
                            const newQty = prompt(
                                "Modifier la quantité :",
                                p.qty.toString()
                            )
                            if (newQty !== null)
                                onUpdateField(index, "qty", Number(newQty))
                        }
                    }}
                >
                    {isKiloMode ? "—" : p.qty}
                </td>

                <td
                    className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right cursor-pointer hidden md:table-cell"
                    onDoubleClick={() => {
                        const currentWeight = p.weight || 0
                        const newWeight = prompt(
                            "Modifier le poids (kg) :",
                            currentWeight.toString()
                        )
                        if (newWeight !== null)
                            onUpdateField(index, "weight", Number(newWeight))
                    }}
                >
                    {p.weight > 0 ? Number(p.weight).toFixed(2) + " kg" : "—"}
                </td>

                <td
                    className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right cursor-pointer"
                    onDoubleClick={() => {
                        const newPrice = prompt(
                            "Modifier le prix (€) :",
                            p.price.toString()
                        )
                        if (newPrice !== null)
                            onUpdateField(index, "price", Number(newPrice))
                    }}
                >
                    {p.price.toFixed(2)} €
                </td>

                <td className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right">
                    {totalHT.toFixed(2)} €
                </td>
                <td className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right hidden sm:table-cell">
                    {totalTVA.toFixed(2)} €
                </td>
                <td className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-right">
                    {totalTTC.toFixed(2)} €
                </td>

                <td className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] text-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-[hsl(var(--foreground))] hover:text-[hsl(var(--destructive))]"
                        onClick={() => onRemove(index)}
                        title="Supprimer"
                    >
                        ×
                    </Button>
                </td>
            </tr>
        )
    }
)

ProductRow.displayName = "ProductRow"

// --- COMPOSANT PRINCIPAL ---
const ProductTable = memo(function ProductTable() {
    const { round2, products, setProducts } = useDevisContext()

    const handleUpdateField = useCallback(
        (
            index: number,
            field: QuoteProductField,
            value: QuoteProductValue
        ) => {
            setProducts((prev: QuoteProduct[]) => {
                const updated = [...prev]
                updated[index] = { ...updated[index], [field]: value }
                return updated
            })
        },
        [setProducts]
    )

    const handleRemoveProduct = useCallback(
        (index: number) => {
            setProducts((prev: QuoteProduct[]) =>
                prev.filter((_, i) => i !== index)
            )
        },
        [setProducts]
    )

    return (
        <div className="mb-4 overflow-x-auto border border-[hsl(var(--border))] rounded custom-scrollbar">
            <div className="max-h-96 overflow-y-auto">
            <table className="min-w-[500px] w-full border-collapse border border-[hsl(var(--border))] text-left text-[11px] sm:text-xs md:text-sm text-[hsl(var(--foreground))]">
                <thead>
                    <tr className="bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] sticky top-0 z-10 shadow-sm">
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            Produit
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] hidden sm:table-cell">
                            Description
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            Qté
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] hidden md:table-cell">
                            Poids
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            Prix U
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            HT
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))] hidden sm:table-cell">
                            TVA
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            TTC
                        </th>
                        <th className="px-2 py-2 sm:px-3 border border-[hsl(var(--border))]">
                            &nbsp;
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {products.map((p, i) => (
                        <ProductRow
                            key={p.id || `prod-${i}`}
                            p={p}
                            index={i}
                            round2={round2}
                            onUpdateField={handleUpdateField}
                            onRemove={handleRemoveProduct}
                        />
                    ))}
                </tbody>
            </table>
            </div>
        </div>
    )
})

export default ProductTable
