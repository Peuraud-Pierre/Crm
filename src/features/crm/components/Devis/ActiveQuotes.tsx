import React, { useMemo, useCallback } from "react"
import { safeDateMs } from "@/features/crm/utils/safeDate"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import {
    type Devis,
    type LigneProduit,
} from "@/features/crm/hooks/CRM_hook/use_devis"
import { type AppUser } from "@/features/auth/hooks/useAuth"
import { FileText } from "lucide-react"
import { toast } from "sonner"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { QuoteCard } from "./Quotes/QuoteCard" // Import de la carte isolée

interface ActiveQuotesProps {
    quotes: Devis[]
    round2: (num: number) => number
    user: AppUser | null
}

export const ActiveQuotes: React.FC<ActiveQuotesProps> = React.memo(
    ({ quotes, round2, user }) => {
        const {
            setCreationDevis,
            DeleteDevis,
            Update_devis,
            setUpdate,
            setInfo,
            Produit,
            update_product,
            sortBy, // <-- AJOUT : On récupère la valeur du menu "Trier"
        } = useCRMContext()
        const { loadQuoteData } = useDevisContext()

        // --- TRI DES DEVIS ACTIFS ---
        const activeQuotes = useMemo(() => {
            // 1. On filtre les archives et on dédoublonne
            const filtered = quotes.filter((q) => !q.Archive)
            const unique = filtered.filter(
                (value, index, self) =>
                    index === self.findIndex((t) => t.id === value.id)
            )

            // 2. On applique le tri dynamique en fonction de 'sortBy'
            return unique.sort((a, b) => {
                if (sortBy === "amount") {
                    // Tri par Montant (du plus grand au plus petit)
                    return (b.totalTTC || 0) - (a.totalTTC || 0)
                }
                if (sortBy === "client") {
                    // Tri par Client (Ordre alphabétique)
                    const clientA = a.client_crm?.nom || a.client || ""
                    const clientB = b.client_crm?.nom || b.client || ""
                    return clientA.localeCompare(clientB)
                }
                // Par défaut : Tri par Date (le plus récent en premier)
                return safeDateMs(b.Date_crea) - safeDateMs(a.Date_crea)
            })
        }, [quotes, sortBy]) // <-- Ne pas oublier d'ajouter sortBy dans les dépendances !

        // --- ACTIONS GLOBALES CRM ---
        const handleDelete = useCallback(
            (quote: Devis) => {
                if (
                    window.confirm(
                        "⚠️ Êtes-vous sûr ? Cette action est irréversible."
                    )
                ) {
                    // Restauration des stocks
                    if (quote.Tableau) {
                        quote.Tableau.forEach((p: LigneProduit) => {
                            const original = Produit.find(
                                (prod) => prod.name === p.name
                            )
                            if (!original || !original.id) return
                            const restoreQty =
                                p.mode === "Kilo" ? p.weight : p.qty
                            update_product(original.id, {
                                stock: (original.stock || 0) + restoreQty,
                                sales: (original.sales || 0) - restoreQty,
                            })
                        })
                    }
                    DeleteDevis(quote.id!, quote.Tableau_id || "")
                }
            },
            [Produit, update_product, DeleteDevis]
        )

        const handleArchive = useCallback(
            async (quote: Devis) => {
                await Update_devis({ ...quote, Archive: true })
                toast.success("Devis archivé")
            },
            [Update_devis]
        )

        const handleEdit = useCallback(
            (quote: Devis) => {
                loadQuoteData(quote)
                setUpdate(true)
                setInfo(quote)
                setCreationDevis(true)
            },
            [setCreationDevis, setUpdate, setInfo, loadQuoteData]
        )

        // --- RENDU ---
        if (activeQuotes.length === 0) {
            return (
                <EmptyState
                    icon={FileText}
                    title="Aucun devis actif"
                    description="Les devis en cours apparaîtront ici."
                    className="bg-muted/20 rounded-xl border border-dashed"
                />
            )
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {activeQuotes.map((quote) => (
                    <QuoteCard
                        key={quote.id}
                        quote={quote}
                        user={user}
                        round2={round2}
                        onArchive={handleArchive}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                    />
                ))}
            </div>
        )
    }
)

ActiveQuotes.displayName = "ActiveQuotes"
