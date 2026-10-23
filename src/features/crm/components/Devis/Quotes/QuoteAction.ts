import { useMemo, useCallback } from "react"
import { toast } from "sonner"
import {
    type Devis,
    type Payment,
} from "@/features/crm/hooks/CRM_hook/use_devis"

import { type AppUser } from "@/features/auth/hooks/useAuth"
import { type QuoteProduct } from "@/features/crm/components/Devis/creation"
import { generateDevisPDF } from "../pdfvisuel"

const API_URL = "https://info.nokk-project.example/Send/"

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
})

export function useQuoteActions(
    quote: Devis,
    user: AppUser | null,
    round2: (n: number) => number
) {
    // --- LOGIQUE VISUELLE ---
    const { totalHTFormatted, statusColor, statusBadge } = useMemo(() => {
        let color = "border-l-gray-300"
        let badgeStyle = "bg-secondary text-secondary-foreground"

        switch (quote.status) {
            case "Brouillon":
                color = "border-l-yellow-400"
                badgeStyle =
                    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                break
            case "Envoyé":
                color = "border-l-blue-500"
                badgeStyle =
                    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                break
            case "Accepté":
                color = "border-l-green-500"
                badgeStyle =
                    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                break
            case "Refusé":
                color = "border-l-red-500"
                badgeStyle =
                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                break
        }

        return {
            totalHTFormatted: currencyFormatter.format(quote.totalHT || 0),
            statusColor: color,
            statusBadge: badgeStyle,
        }
    }, [quote.status, quote.totalHT])

    // --- PRÉPARATION DES DONNÉES PDF ---
    // --- PRÉPARATION DES DONNÉES PDF CORRIGÉE ---
    const getPDFData = useCallback(() => {
        const clientData = quote.client_crm
        if (!clientData || !clientData.siret) return null

        // On s'assure que les produits ont les totaux calculés en amont
        // pour que le PDF n'ait qu'à les afficher sans recalculer
        const productsMapped = (quote.Tableau || []).map((p) => ({
            ...p,
            // On force l'utilisation des totaux stockés dans l'objet 'p' (issus de la DB/Context)
            totalHT: p.totalHT,
            totalTVA: p.totalTVA,
            totalTTC: p.totalTTC,
        })) as unknown as QuoteProduct[]

        const remisesMapped = (quote.Remise || []) as unknown as QuoteProduct[]

        let paymentList: Payment[] = []
        if (Array.isArray(quote.paiement)) {
            paymentList = quote.paiement.filter(
                (p) => p && typeof p === "object" && "method" in p
            ) as Payment[]
        }

        return {
            numeroDevis: quote.name || "BROUILLON",
            client: clientData,
            clientSiret: clientData.siret || "",
            clientTva: clientData.numero_TVA || "",
            payments: paymentList,
            expirationDate: (() => {
                const d = quote.Date_end ? new Date(quote.Date_end) : null
                return d && !isNaN(d.getTime())
                    ? d.toISOString()
                    : new Date().toISOString()
            })(),
            products: productsMapped,
            remise: remisesMapped,
            // PASSAGE DES TOTAUX GLOBAUX POUR ÉVITER LE RECALCUL PDF
            totalHT: quote.totalHT || 0,
            totalTVA: quote.totalTVA || 0,
            totalTTC: quote.totalTTC || 0,

            // 👇 AJOUT DU POIDS ICI 👇
            poid_balance: quote.poid_balance || 0,

            round2: round2,
            user: user,
            logo: quote.service === "Handpick",
            condition: "Paiement à réception de facture.",
            Livraison: (quote.Livraison as string) || "",
            note: quote.termes || "",
            urgence: quote.urgence ?? null,
        }
    }, [quote, user, round2])

    // --- GÉNÉRATION PDF (Client-side) ---
    const handleViewPDF = useCallback(async () => {
        const pdfData = getPDFData()
        if (!pdfData) {
            toast.error("Impossible de générer le PDF", {
                description:
                    "Les informations du client (SIRET) sont manquantes.",
            })
            return
        }
        try {
            await generateDevisPDF(pdfData)
            toast.success("PDF Généré")
        } catch (error) {
            console.error("Erreur PDF:", error)
            toast.error("Erreur lors de la génération du PDF")
        }
    }, [getPDFData])

    // --- ENVOI EMAIL VIA GOLANG ---
    const handleSendEmail = useCallback(async () => {
        const recipients = ["proforma@nokk-project.example"].filter(
            (email) => email && email.trim() !== ""
        )
        if (recipients.length === 0) {
            toast.error("Aucun destinataire valide.")
            return
        }

        const pdfData = getPDFData()
        if (!pdfData) {
            toast.error("Impossible de générer le PDF pour l'envoi.")
            return
        }

        try {
            const pdfBase64 = await generateDevisPDF(pdfData, true)

            const urgencePrefix =
                quote.urgence === "élevée"
                    ? "[URGENCE ÉLEVÉE] "
                    : quote.urgence === "haute"
                      ? "[HAUTE URGENCE] "
                      : ""
            const urgenceBody =
                quote.urgence === "élevée"
                    ? "\n\n⚠️ CE BON EST MARQUE URGENCE ELEVEE - Traitement prioritaire requis."
                    : quote.urgence === "haute"
                      ? "\n\n⚠️ CE BON EST MARQUE HAUTE URGENCE."
                      : ""

            const emailPromises = recipients.map((email) => {
                const emailPayload = {
                    to: email,
                    subject: `${urgencePrefix}Bon proforma N°${quote.name} - ${quote.service}`,
                    body: `Bonjour ${quote.client_crm?.nom || "Client"},\n\nVeuillez trouver ci-joint le Bon proforma N° ${quote.name} au format PDF.${urgenceBody}\n\nEdité par : ${user?.full_name || "L'équipe commerciale"}\nCordialement,\n${user?.full_name || "L'équipe commerciale"}`,
                    attachment_name: `Devis_${quote.name}.pdf`,
                    attachment_data: pdfBase64,
                }

                return fetch(API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(emailPayload),
                }).then(async (response) => {
                    if (!response.ok) {
                        const errorData = await response
                            .json()
                            .catch(() => ({}))
                        throw new Error(errorData.error || "Erreur serveur")
                    }
                    return response.json()
                })
            })

            await toast.promise(Promise.all(emailPromises), {
                loading: "Génération et envoi du PDF...",
                success: "Devis envoyé avec succès à tous les destinataires !",
                error: (err) => `Erreur : ${err.message}`,
            })
        } catch (error) {
            console.error("Erreur lors de l'envoi:", error)
            toast.error("Impossible de générer ou d'envoyer le PDF.")
        }
    }, [
        getPDFData,
        quote.name,
        quote.service,
        quote.urgence,
        quote.client_crm?.nom,
        user?.full_name,
    ])

    const canGeneratePDF = !!quote.client_crm?.siret
    const canSendEmail = !!quote.client_crm?.mail

    return {
        totalHTFormatted,
        statusColor,
        statusBadge,
        handleViewPDF,
        handleSendEmail,
        canGeneratePDF,
        canSendEmail,
    }
}
