import React, { useState, useCallback, useMemo } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type AppUser } from "@/features/auth/hooks/useAuth"
import { type Devis } from "../../hooks/CRM_hook/use_devis"
import { type QuoteProduct } from "@/features/crm/components/Devis/creation" // Ajuste le chemin si besoin
import { type Client } from "@/features/crm/types/client"

// Icônes
import {
    ChevronDown,
    ChevronUp,
    Eye,
    ArchiveRestore,
    AlertCircle,
} from "lucide-react"

// Utilitaire PDF
import { generateDevisPDF, type PropsGenerateDevisPDF } from "./pdfvisuel"
import { toast } from "sonner"

// ==========================================
// 🧠 1. LE CERVEAU DE LA CARTE (HOOK)
// ==========================================
function useArchivedQuoteLogic(
    quote: Devis,
    user: AppUser | null,
    round2: (num: number) => number
) {
    const { Update_devis } = useCRMContext()

    const isClientIncomplete = !quote.client_crm?.siret

    const handlePreviewArchivedPDF = useCallback(() => {
        if (isClientIncomplete) {
            toast.error("Impossible de générer le PDF (SIRET manquant)")
            return
        }

        const clientData: Partial<Client> = quote.client_crm || {}

        // Sécuriser la liste des paiements
        const paymentList = Array.isArray(quote.paiement)
            ? quote.paiement.filter(
                  (p: unknown) => p && typeof p === "object" && "method" in p
              )
            : []

        generateDevisPDF(
            {
                // --- Infos générales ---
                numeroDevis: quote.name || quote.id || "BROUILLON",
                expirationDate: (() => {
                    const d = quote.Date_end ? new Date(quote.Date_end) : null
                    return d && !isNaN(d.getTime())
                        ? d.toISOString()
                        : new Date().toISOString()
                })(),

                // --- Infos Client ---
                client: clientData,
                clientSiret: clientData.siret || "",
                clientTva: clientData.numero_TVA || "",

                // --- Tableaux ---
                products: (quote.Tableau || []).map((p) => ({
                    ...p,
                    id: p.id || "",
                    mode: (p.mode || "Pièce") as "Remise" | "Kilo" | "Pièce",
                    // Assurer la présence des totaux par ligne
                    totalHT: p.totalHT || 0,
                    totalTVA: p.totalTVA || 0,
                    totalTTC: p.totalTTC || 0,
                })) as QuoteProduct[],
                remise: (quote.Remise || []) as unknown as QuoteProduct[],
                payments: paymentList as { method: string; amount: number }[],

                // --- NOUVEAUX TOTAUX FIXES ---
                totalHT: quote.totalHT || 0,
                totalTVA: quote.totalTVA || 0,
                totalTTC: quote.totalTTC || 0,
                poid_balance: quote.poid_balance || 0, // Ajout du poids de la balance

                // --- Configuration visuelle & Options ---
                round2: round2,
                user: user,
                logo: quote.service === "Handpick",
                condition: "Paiement à réception de facture.",
                Livraison: (quote.Livraison as string) || "Non spécifié",
                note: quote.termes || "",
            } as PropsGenerateDevisPDF,
            false // False = Ouvrir dans un nouvel onglet
        )
    }, [quote, user, round2, isClientIncomplete])

    const handleRestore = useCallback(async () => {
        try {
            await Update_devis({ ...quote, Archive: false })
            toast.success("Devis restauré avec succès")
        } catch (error) {
            console.error("Erreur lors de la restauration:", error)
            toast.error("Erreur lors de la restauration du devis")
        }
    }, [quote, Update_devis])

    return {
        isClientIncomplete,
        handlePreviewArchivedPDF,
        handleRestore,
    }
}

// ==========================================
// 🎨 2. SOUS-COMPOSANT : LA CARTE ARCHIVÉE
// ==========================================
interface ArchivedQuoteCardProps {
    quote: Devis
    round2: (num: number) => number
    user: AppUser | null
}

const ArchivedQuoteCard = React.memo(
    ({ quote, round2, user }: ArchivedQuoteCardProps) => {
        // Appel du cerveau local
        const { isClientIncomplete, handlePreviewArchivedPDF, handleRestore } =
            useArchivedQuoteLogic(quote, user, round2)

        return (
            <Card variant="elevated" className="p-5 text-foreground border">
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <h3 className="font-bold text-lg">{quote.name}</h3>
                        <p className="text-sm text-muted-foreground">
                            {quote.client_crm?.nom || "Client inconnu"}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                            {quote.Date_crea
                                ? new Date(quote.Date_crea).toLocaleDateString()
                                : "Date inconnue"}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="font-extrabold text-primary text-xl">
                            {quote?.totalTTC?.toFixed(2)} €
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            Archivé
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5"
                        disabled={isClientIncomplete}
                        onClick={handlePreviewArchivedPDF}
                    >
                        <Eye className="w-4 h-4" /> Visualiser
                    </Button>

                    <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 gap-2"
                        onClick={handleRestore}
                    >
                        <ArchiveRestore className="w-4 h-4" /> Restaurer
                    </Button>
                </div>

                {isClientIncomplete && (
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-destructive">
                        <AlertCircle className="w-3 h-3" />
                        <span>SIRET manquant (PDF indisponible)</span>
                    </div>
                )}
            </Card>
        )
    }
)
ArchivedQuoteCard.displayName = "ArchivedQuoteCard"

// ==========================================
// 🖼️ 3. COMPOSANT PRINCIPAL : LA LISTE
// ==========================================
interface ArchivedQuotesProps {
    quotes: Devis[]
    round2: (num: number) => number
    user: AppUser | null
}

export const ArchivedQuotes: React.FC<ArchivedQuotesProps> = ({
    quotes,
    round2,
    user,
}) => {
    const [archiveOpen, setArchiveOpen] = useState(false)

    // Filtrer uniquement les devis archivés
    const archivedQuotes = useMemo(
        () => quotes.filter((q) => q.Archive),
        [quotes]
    )

    return (
        <div className="mt-6 border-t border-border dark:border-border pt-4">
            <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setArchiveOpen(!archiveOpen)}
            >
                <h2 className="font-semibold text-lg text-foreground dark:text-foreground group-hover:text-primary transition-colors">
                    Archives ({archivedQuotes.length})
                </h2>
                {archiveOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
            </div>

            {archiveOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {archivedQuotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground dark:text-muted-foreground col-span-2 italic">
                            Aucun devis archivé pour le moment.
                        </p>
                    ) : (
                        archivedQuotes.map((quote) => (
                            <ArchivedQuoteCard
                                key={quote.id}
                                quote={quote}
                                round2={round2}
                                user={user}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
