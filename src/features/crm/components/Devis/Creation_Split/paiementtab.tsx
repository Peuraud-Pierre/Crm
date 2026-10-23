import { memo, useCallback, useState } from "react"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import {
    Trash2,
    TrendingDown,
    CreditCard,
    Receipt,
    X,
    Plus,
    Banknote,
    ChevronDown,
    CreditCard as CardIcon,
} from "lucide-react"
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { cn } from "@/shared/lib/utils"

const PaymentsSummary = memo(function PaymentsSummary() {
    const { products, payments, setPayments, remises, setRemises } =
        useDevisContext()

    // Repli vertical du Ticket : permet de masquer la liste (panier/remises/
    // paiements) pour libérer de la place, tout en gardant l'en-tête visible.
    const [isOpen, setIsOpen] = useState(true)
    const itemCount = products.length + remises.length + payments.length

    // --- ACTIONS MÉMORISÉES ---
    const handleAddPayment = useCallback(
        (method: string) => {
            // On vérifie si la méthode existe déjà
            const alreadyExists = payments.some((p) => p.method === method)
            if (alreadyExists) return

            setPayments((prev) => [...prev, { method: method, amount: 0 }])
        },
        [payments, setPayments]
    )

    const removeRemise = useCallback(
        (id: string) => {
            setRemises((prev) => prev.filter((r) => r.id !== id))
        },
        [setRemises]
    )

    const removePayment = useCallback(
        (index: number) => {
            setPayments((prev) => prev.filter((_, i) => i !== index))
        },
        [setPayments]
    )

    // --- RENDU ---
    return (
        <div
            className={cn(
                "flex flex-col font-sans",
                isOpen && "flex-1 min-h-0"
            )}
        >
            <div
                className={cn(
                    "bg-card rounded-xl border shadow-sm flex flex-col overflow-hidden",
                    isOpen && "flex-1 min-h-0"
                )}
            >
                {/* --- HEADER --- */}
                <div className="bg-muted/30 p-3 sm:p-4 border-b flex items-center justify-between shrink-0 gap-2 sm:gap-3">
                    {/* Cluster gauche cliquable : replie/déplie le Ticket verticalement */}
                    <button
                        type="button"
                        onClick={() => setIsOpen((v) => !v)}
                        aria-expanded={isOpen}
                        title={isOpen ? "Replier le ticket" : "Déplier le ticket"}
                        className="flex items-center gap-2 text-base font-semibold text-muted-foreground shrink-0 hover:text-foreground transition-colors"
                    >
                        <ChevronDown
                            className={cn(
                                "w-4 h-4 transition-transform duration-base",
                                isOpen ? "rotate-0" : "-rotate-90"
                            )}
                        />
                        <Receipt className="w-5 h-5" />
                        <span>Ticket</span>
                        {!isOpen && itemCount > 0 && (
                            <span className="ml-1 text-xs font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {itemCount}
                            </span>
                        )}
                    </button>

                    <div className="w-auto shrink-0">
                        <Select value="" onValueChange={handleAddPayment}>
                            <SelectTrigger className="h-9 px-3 sm:px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm rounded-lg flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0">
                                <Plus className="w-4 h-4 shrink-0" />
                                <span className="hidden sm:inline">
                                    Paiement
                                </span>
                                <span className="sm:hidden">Pay</span>
                            </SelectTrigger>

                            <SelectContent
                                position="popper"
                                sideOffset={5}
                                className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
                            >
                                <div className="p-1">
                                    <SelectItem
                                        value="carte-bleu"
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CardIcon className="w-4 h-4 text-blue-600 shrink-0" />
                                            <span>Carte Bancaire</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem
                                        value="virement"
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
                                            <span>Virement</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem
                                        value="espece"
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Banknote className="w-4 h-4 text-green-600 shrink-0" />
                                            <span>Espèces</span>
                                        </div>
                                    </SelectItem>
                                    <SelectItem
                                        value="cheque"
                                        className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Receipt className="w-4 h-4 text-orange-600 shrink-0" />
                                            <span>Chèque</span>
                                        </div>
                                    </SelectItem>
                                </div>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* --- BODY (masqué quand le ticket est replié) --- */}
                {isOpen && (
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-0 bg-muted/5 space-y-4 sm:space-y-5">
                    {/* Liste Produits */}
                    <div className="space-y-3">
                        {products.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground text-sm italic">
                                Le panier est vide
                            </div>
                        )}

                        {products.map((p) => (
                            <div
                                key={p.id}
                                className="flex justify-between items-start text-sm group py-1 gap-2 sm:gap-4"
                            >
                                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                    <span className="font-medium text-foreground/90 text-[15px] break-words leading-tight">
                                        {p.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-0.5">
                                        {p.mode === "Kilo"
                                            ? `${p.weight.toFixed(2)} kg × ${p.price.toFixed(2)} €`
                                            : `${p.qty} × ${p.price.toFixed(2)} €`}
                                    </span>
                                </div>
                                <span className="font-mono font-medium text-base shrink-0 pt-0.5">
                                    {p.totalHT.toFixed(2)} €
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Liste Remises */}
                    {remises.length > 0 && (
                        <>
                            <Separator className="border-dashed opacity-50 my-2" />
                            <div className="space-y-3">
                                {remises.map((r) => (
                                    <div
                                        key={`remise-${r.id}`}
                                        className="flex flex-col sm:flex-row sm:justify-between sm:items-start text-sm text-orange-700 gap-2"
                                    >
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium leading-none break-words">
                                                    {r.name || "Remise"}
                                                </span>
                                                <span className="text-xs opacity-80 mt-1 break-words">
                                                    {r.description}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto shrink-0 pl-6 sm:pl-0">
                                            <span className="font-mono font-medium text-base">
                                                {r.totalHT.toFixed(2)} €
                                            </span>
                                            <button
                                                onClick={() =>
                                                    removeRemise(r.id)
                                                }
                                                className="hover:bg-orange-100 h-8 w-8 flex items-center justify-center rounded-md transition-colors shrink-0"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Liste Paiements */}
                    {payments.length > 0 && (
                        <>
                            <Separator className="border-dashed opacity-50 my-2" />
                            <div className="space-y-3">
                                {payments.map((pay, i) => (
                                    <div
                                        key={pay.method}
                                        className="flex justify-between items-center text-sm text-emerald-700 py-1 gap-2"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {pay.method === "espece" ? (
                                                <Banknote className="w-4 h-4 shrink-0" />
                                            ) : (
                                                <CardIcon className="w-4 h-4 shrink-0" />
                                            )}
                                            <span className="capitalize font-medium truncate">
                                                {pay.method.replace("-", " ")}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removePayment(i)}
                                            className="hover:bg-emerald-100 h-8 w-8 flex items-center justify-center rounded-md transition-colors ml-auto shrink-0"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                )}
            </div>
        </div>
    )
})

export default PaymentsSummary
