import { useAuth } from "@/features/auth/hooks/useAuth"
import {
    generateDevisPDF,
    type PropsGenerateDevisPDF,
} from "@/features/crm/components/Devis/pdfvisuel"
import { type QuoteProduct } from "../../Devis/creation"

import { type Devis } from "@/features/crm/hooks/CRM_hook/use_devis"
import { type Invoice } from "@/shared/lib/mock-data"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { Eye, FileText, Send } from "lucide-react"

// Assurez-vous d'importer les versions Dark de vos logos ici
import { NokkProjectLogo, VintageLogo, DarkVintage } from "../../Devis/pdfvisuel"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

interface CustomerTabsProps {
    customerQuotes: Devis[]
    customerInvoices: Invoice[]
    round2: (n: number) => number
}

// Map des libellés de statuts
const STATUS_LABELS: Record<string, string> = {
    pending: "En attente",
    processing: "En cours",
    completed: "Terminée",
    cancelled: "Annulée",
    paid: "Payée",
    sent: "Envoyée",
    accepted: "Accepté",
    rejected: "Rejeté",
    Refusé: "Refusé",
    Validé: "Validé",
}

// Helper pour la couleur du badge statut
const getStatusVariant = (
    status: string | undefined
): "default" | "secondary" | "destructive" | "outline" => {
    const s = status?.toLowerCase() || ""
    if (
        s.includes("valid") ||
        s.includes("accept") ||
        s.includes("pay") ||
        s.includes("complet")
    )
        return "default" // Vert/Noir (selon theme)
    if (s.includes("refus") || s.includes("rejet") || s.includes("annul"))
        return "destructive" // Rouge
    if (s.includes("attente") || s.includes("encours") || s.includes("process"))
        return "secondary" // Gris
    return "outline"
}

export function CustomerTabs({ customerQuotes, round2 }: CustomerTabsProps) {
    const { user } = useAuth()
    const { search } = useCRMContext()
    const handlePreviewPDF = (quote: Devis) => {
        if (!quote.client_crm?.siret) return

        const remisesArray =
            typeof quote.Remise === "string"
                ? JSON.parse(quote.Remise)
                : quote.Remise || []

        // 1. On sécurise la liste des paiements avant l'appel (si tu ne l'as pas déjà fait au-dessus)
        const paymentList = Array.isArray(quote.paiement)
            ? quote.paiement.filter(
                  (p: unknown) => p && typeof p === "object" && "method" in p
              )
            : []

        // 2. L'appel mis à jour
        generateDevisPDF({
            // --- Infos générales ---
            numeroDevis: quote.name || quote.id || "BROUILLON",
            expirationDate: quote.Date_end
                ? new Date(quote.Date_end).toISOString()
                : new Date().toISOString(),

            // --- Infos Client ---
            client: quote.client_crm || {}, // Ne pas mettre "" car le type attend un objet Client
            clientSiret: quote.client_crm?.siret || "",
            clientTva: quote.client_crm?.numero_TVA || "",

            // --- Tableaux ---
            products: (quote.Tableau || []).map((p) => ({
                ...p,
                id: p.id || "",
                mode: (p.mode || "Pièce") as "Remise" | "Kilo" | "Pièce",
                // On s'assure d'embarquer les totaux par ligne
                totalHT: p.totalHT || 0,
                totalTVA: p.totalTVA || 0,
                totalTTC: p.totalTTC || 0,
            })) as QuoteProduct[],
            remise: remisesArray,
            payments: paymentList as { method: string; amount: number }[], // Cast final pour éviter les erreurs de type

            // --- NOUVEAUX TOTAUX FIXES ---
            totalHT: quote.totalHT || 0,
            totalTVA: quote.totalTVA || 0,
            totalTTC: quote.totalTTC || 0,
            poid_balance: quote.poid_balance || 0, // <-- Ajout du poids de la balance

            // --- Configuration visuelle & Options ---
            round2: round2,
            user: user,
            logo: quote.service === "Handpick",
            condition: "Paiement à réception de facture.",
            note: quote.termes || "",
            Livraison: quote.Livraison || "Non spécifié",
        } as PropsGenerateDevisPDF)
    }
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <Tabs
                defaultValue="quotes"
                className="flex flex-col h-full bg-background border rounded-xl shadow-sm overflow-hidden"
            >
                <TabsList indicator className="grid w-full h-12 bg-muted/30 p-1 border-b">
                    <TabsTrigger value="quotes">
                        <FileText className="w-4 h-4 mr-2" /> Devis (
                        {customerQuotes.length})
                    </TabsTrigger>
                </TabsList>

                {/* === ONGLETS DEVIS === */}
                <TabsContent
                    value="quotes"
                    className="flex-1 overflow-y-auto p-4 mt-0 bg-muted/5 space-y-3"
                >
                    {customerQuotes.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={FileText}
                            title="Aucun bon de commande"
                            className="h-40 border-2 border-dashed rounded-xl bg-background/50"
                        />
                    ) : (
                        customerQuotes.map((quote) => {
                            const totalHT = Number(quote.totalHT) || 0
                            const totalTTC = Number(quote.totalTTC) || 0

                            // Logique de sélection des logos Light / Dark
                            const isHandpick = quote.service === "Handpick"

                            // Logos Clairs
                            const logoLight = isHandpick
                                ? VintageLogo
                                : NokkProjectLogo

                            // Logos Sombres (Fallback sur Light si Dark n'est pas encore défini)
                            const logoDark = isHandpick
                                ? DarkVintage || VintageLogo
                                : NokkProjectLogo
                            return (
                                <Card
                                    key={quote.id}
                                    variant="interactive"
                                    className="p-3 flex flex-col gap-3 border-l-4 border-l-primary/20"
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Logo Container avec gestion Dark Mode */}
                                        <div className="w-12 h-12 bg-muted/20 rounded-md flex items-center justify-center shrink-0 p-1 border overflow-hidden relative">
                                            {/* Image Light : visible par défaut, cachée en dark */}
                                            <img
                                                src={logoLight}
                                                alt="Logo"
                                                className="w-full h-full object-contain block dark:hidden"
                                            />
                                            {/* Image Dark : cachée par défaut, visible en dark */}
                                            <img
                                                src={logoDark}
                                                alt="Logo Dark"
                                                className="w-full h-full object-contain hidden dark:block"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            {/* Header : Nom + Badge */}
                                            <div className="flex items-center justify-between mb-2">
                                                <h4
                                                    className="font-semibold text-sm truncate pr-2"
                                                    title={
                                                        quote.name ||
                                                        "Devis sans nom"
                                                    }
                                                >
                                                    {quote.name ||
                                                        "Devis sans nom"}
                                                </h4>
                                                <Badge
                                                    variant={getStatusVariant(
                                                        quote.status || ""
                                                    )}
                                                    className="text-[10px] px-2 py-0.5 h-auto shrink-0 uppercase tracking-tighter"
                                                >
                                                    {STATUS_LABELS[
                                                        quote.status || ""
                                                    ] ||
                                                        quote.status ||
                                                        "Inconnu"}
                                                </Badge>
                                            </div>

                                            {/* Infos : Date + Prix */}
                                            <div className="flex items-end justify-between">
                                                <p className="text-[11px] text-muted-foreground flex items-center">
                                                    {/* On cherche l'user, puis on affiche son username (ou email, ou "Inconnu") */}
                                                    {search?.find(
                                                        (user: { user_id?: string; id?: string; full_name?: string; name?: string }) =>
                                                            user.user_id ===
                                                            quote.by
                                                    )?.name || "Inconnu"}
                                                </p>

                                                <div className="text-right flex flex-col items-end">
                                                    <span className="font-bold text-sm text-primary">
                                                        {totalHT.toFixed(2)} €
                                                        HT
                                                    </span>
                                                    {totalTTC > 0 && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {totalTTC.toFixed(
                                                                2
                                                            )}{" "}
                                                            € TTC
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            disabled={!quote.client_crm?.siret}
                                            onClick={() =>
                                                handlePreviewPDF(quote)
                                            }
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1.5" />{" "}
                                            Aperçu
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs"
                                            disabled
                                        >
                                            <Send className="h-3 w-3 mr-1.5" />{" "}
                                            Envoyer
                                        </Button>
                                    </div>
                                </Card>
                            )
                        })
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
