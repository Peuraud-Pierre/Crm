import React, { useState, useCallback, useMemo } from "react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { cn } from "@/shared/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth"

// Utilitaire PDF et API
import { generateDevisPDF } from "../pdfvisuel"
import { type QuoteProduct } from "@/features/crm/components/Devis/creation"

// Icônes
import {
    Eye,
    Save,
    Pencil,
    X,
    AlertCircle,
    XCircle,
    Send,
    Receipt,
    Scale,
} from "lucide-react"
import type { activites, Client } from "@/features/crm/types"

const API_URL = "https://info.nokk-project.example/Send/"

const round2 = (num: number) => Math.round(num * 100 + Number.EPSILON) / 100

const getStatusConfig = (status: string) => {
    switch (status) {
        case "Envoyé":
            return {
                style: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
                icon: Send,
                label: "Envoyé",
            }
        default:
            return {
                style: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
                icon: XCircle,
                label: "Brouillon",
            }
    }
}

const DevisActions = React.memo(({ onCollapse }: { onCollapse?: () => void }) => {
    const {
        Info,
        Update,
        Update_devis,
        setCreationDevis,
        Register_devis,
        create_activites,
        clients,
    } = useCRMContext()

    const {
        client,
        numeroDevis,
        status,
        setStatus,
        totals,
        prepareDevis,
    } = useDevisContext()

    // SIRET / N° TVA proviennent désormais de la fiche client (la section
    // Configuration & Facturation a été retirée). On lit donc les infos légales
    // directement sur l'enregistrement client sélectionné.
    const selectedClient = useMemo(
        () => clients.find((c) => c.id === client),
        [clients, client]
    )
    const clientSiret = selectedClient?.siret || ""
    const clientTva = selectedClient?.numero_TVA || ""

    const { user } = useAuth()
    const [isSaving, setIsSaving] = useState(false)
    const [isSendingEmail, setIsSendingEmail] = useState(false)

    // --- STATE : Poids de la balance ---
    // On utilise "poid_balance" depuis Info pour l'initialisation
    const [poidsBalance, setPoidsBalance] = useState<string>(
        Update && Info?.poid_balance ? String(Info.poid_balance) : ""
    )

    // Vérification pour bloquer les clics si vraiment incomplet
    const isFormIncomplete = useMemo(
        () => !client || (!clientSiret && !clientTva),
        [client, clientSiret, clientTva]
    )

    const currentConfig = useMemo(() => getStatusConfig(status), [status])
    const CurrentIcon = currentConfig.icon

    const handlePreviewPDF = useCallback(async () => {
        const currentData = prepareDevis()
        await generateDevisPDF(
            {
                numeroDevis: currentData.name || "BROUILLON",
                client: currentData.client_crm ?? ({} as Client),
                clientSiret: clientSiret,
                clientTva: clientTva,
                payments: currentData.paiement as { method: string; amount: number }[],
                expirationDate: (() => {
                    const d = currentData.Date_end
                        ? new Date(currentData.Date_end)
                        : null
                    return d && !isNaN(d.getTime())
                        ? d.toISOString()
                        : new Date().toISOString()
                })(),
                products: (currentData.Tableau ||
                    []) as unknown as QuoteProduct[],
                remise: (currentData.Remise || []) as unknown as QuoteProduct[],
                totalHT: totals.totalHT,
                totalTVA: totals.totalTVA,
                totalTTC: totals.totalTTC,

                // ✅ AJOUT ICI POUR L'APERÇU
                poid_balance: parseFloat(poidsBalance) || 0,

                round2: round2,
                user: user,
                logo: currentData.service === "Handpick",
                condition: "Paiement à réception de facture.",
                Livraison: (currentData.Livraison as string) || "",
                note: currentData.termes || "",
            },
            false
        )
    }, [prepareDevis, clientSiret, clientTva, user, totals, poidsBalance]) // ✅ Ajout dans les dépendances

    const handleSendEmail = useCallback(
        async (type: string) => {
            if (isSendingEmail) return

            const quoteData = prepareDevis()
            const recipients = [
                quoteData.client_crm?.mail,
                "proforma@nokk-project.example",
            ].filter((email) => email && email.trim() !== "") as string[]

            if (recipients.length === 0) {
                toast.error("Aucune adresse email valide trouvée.")
                return
            }

            setIsSendingEmail(true)

            try {
                const pdfBase64 = await generateDevisPDF(
                    {
                        numeroDevis: quoteData.name || "BROUILLON",
                        client: quoteData.client_crm ?? ({} as Client),
                        clientSiret: clientSiret,
                        clientTva: clientTva,
                        payments: quoteData.paiement as { method: string; amount: number }[],
                        expirationDate: (() => {
                            const d = quoteData.Date_end
                                ? new Date(quoteData.Date_end)
                                : null
                            return d && !isNaN(d.getTime())
                                ? d.toISOString()
                                : new Date().toISOString()
                        })(),
                        products: (quoteData.Tableau ||
                            []) as unknown as QuoteProduct[],
                        remise: (quoteData.Remise ||
                            []) as unknown as QuoteProduct[],
                        totalHT: totals.totalHT,
                        totalTVA: totals.totalTVA,
                        totalTTC: totals.totalTTC,
                        round2: round2,
                        user: user,
                        logo: quoteData.service === "Handpick",
                        condition: "Paiement à réception de facture.",
                        Livraison: (quoteData.Livraison as string) || "",
                        note: quoteData.termes || "",
                    },
                    true
                )

                const subject =
                    type === "Créer"
                        ? `Nouveau Bon proforma ${quoteData.name} - ${quoteData.service === "Handpick" ? "Nokk_project Handpick" : "Nokk_project"}`
                        : `Modification du Bon proforma ${quoteData.name} - ${quoteData.service === "Handpick" ? "Nokk_project Handpick" : "Nokk_project"}`

                const body = `Bonjour,\n\nVeuillez trouver ci-joint votre devis N° ${quoteData.name} au format PDF.\n\nCordialement,\n${user?.full_name || "L'équipe commerciale"}`

                const emailPromises = recipients.map((email) => {
                    const payload = {
                        to: email,
                        subject: subject,
                        body: body,
                        attachment_name: `Devis_${quoteData.name}.pdf`,
                        attachment_data: pdfBase64,
                    }

                    return fetch(API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }).then(async (response) => {
                        if (!response.ok)
                            throw new Error(`Erreur pour ${email}`)
                        return response.json()
                    })
                })

                await toast.promise(Promise.all(emailPromises), {
                    loading: `Envoi en cours...`,
                    success: "Tous les emails ont été envoyés !",
                    error: "Erreur lors de l'envoi.",
                })

                setStatus("Envoyé")
            } catch (error) {
                console.error(error)
                toast.error("Problème lors de l'envoi.")
            } finally {
                setIsSendingEmail(false)
            }
        },
        [
            prepareDevis,
            user,
            setStatus,
            isSendingEmail,
            clientSiret,
            clientTva,
            totals,
        ]
    )

    const handleSave = useCallback(async () => {
        if (isSaving) return
        if (!client) {
            toast.error("Veuillez sélectionner un client.")
            return
        }

        setIsSaving(true)
        try {
            const optimisticActivity: activites = {
                client: client,
                date: new Date().toISOString(),
                created_at: new Date().toISOString(),
                title: "RDV",
                content: "Création d'un bon de commande",
            } as activites

            await create_activites(optimisticActivity)

            // --- UTILISATION DE poid_balance ICI ---
            const finalData = {
                ...prepareDevis(),
                poid_balance: parseFloat(poidsBalance) || 0,
            }

            await Register_devis(finalData)
            if (status === "Envoyé") {
                await handleSendEmail("Créer")
            }
            setCreationDevis(false)
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }, [
        isSaving,
        client,
        create_activites,
        Register_devis,
        prepareDevis,
        status,
        handleSendEmail,
        setCreationDevis,
        poidsBalance,
    ])

    const handleUpdate = useCallback(async () => {
        if (isSaving) return
        if (!client) {
            toast.error("Données manquantes.")
            return
        }

        setIsSaving(true)
        try {
            const refDevis = numeroDevis || "Inconnu"
            const optimisticActivity: activites = {
                client: client,
                date: new Date().toISOString(),
                created_at: new Date().toISOString(),
                title: "RDV",
                content: `Mise à jour du bon de proforma n°${refDevis}`,
            } as activites

            await create_activites(optimisticActivity)

            // --- UTILISATION DE poid_balance ICI ---
            const finalData = {
                ...prepareDevis(),
                poid_balance: parseFloat(poidsBalance) || 0,
            }

            await Update_devis(finalData)
            if (status === "Envoyé") {
                await handleSendEmail("Modifier")
            }
            setCreationDevis(false)
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }, [
        isSaving,
        client,
        numeroDevis,
        create_activites,
        Update_devis,
        prepareDevis,
        status,
        handleSendEmail,
        setCreationDevis,
        poidsBalance,
    ])

    return (
        <div
            className={cn(
                "fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-4 p-4",
                "bg-background border-t shadow-[0_-4px_10px_rgba(0,0,0,0.1)] rounded-t-2xl",
                "max-h-[85dvh] overflow-y-auto md:relative md:z-0 md:bg-muted/30 md:shadow-none md:rounded-xl md:max-h-none md:overflow-visible"
            )}
        >
            {/* Bouton fermeture — mobile uniquement */}
            {onCollapse && (
                <button
                    onClick={onCollapse}
                    className="md:hidden w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto -mt-1 mb-1 block"
                    aria-label="Fermer"
                />
            )}
            {/* Zone Totaux */}
            <div className="bg-card dark:bg-card/50 border border-border/50 rounded-lg p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/10" />
                <div className="flex flex-col gap-3 pl-2">
                    <div className="flex items-center gap-2 text-primary/80">
                        <Receipt className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase font-bold tracking-wider">
                            Récapitulatif
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total HT Net</span>
                        <span className="font-mono text-base font-semibold text-foreground">
                            {totals.totalHT.toFixed(2)} €
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total TVA</span>
                        <span className="font-mono text-base font-semibold text-foreground">
                            {totals.totalTVA.toFixed(2)} €
                        </span>
                    </div>
                    <Separator className="border-dashed" />
                    <div className="flex justify-between items-end">
                        <span className="text-lg font-bold text-foreground">
                            Total TTC
                        </span>
                        <span className="text-2xl font-extrabold text-primary tracking-tight font-mono">
                            {totals.totalTTC.toFixed(2)} €
                        </span>
                    </div>
                </div>
            </div>

            {/* Zone Statut */}
            <div className="flex flex-col gap-2">
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger
                        className={cn(
                            "w-full h-10 transition-colors duration-base border shadow-sm font-medium",
                            currentConfig.style
                        )}
                    >
                        <div className="flex items-center gap-2.5">
                            <CurrentIcon className="w-4 h-4" />
                            <span>{currentConfig.label}</span>
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            value="Brouillon"
                            className="cursor-pointer"
                        >
                            Brouillon
                        </SelectItem>
                        <SelectItem value="Envoyé" className="cursor-pointer">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <Send className="w-4 h-4" />
                                <span>Envoyé</span>
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>

                {isFormIncomplete && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>
                            Attention : SIRET ou TVA manquant sur ce client.
                        </span>
                    </div>
                )}
            </div>

            {/* Zone Actions */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-2 pb-6 md:pb-0">
                {/* --- ZONE : Poids de la balance --- */}
                <div className="col-span-2 bg-card dark:bg-card/50 border border-border/50 rounded-lg p-3 shadow-sm mb-1">
                    <Label
                        htmlFor="poids-balance"
                        className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5 uppercase tracking-wider"
                    >
                        <Scale className="w-3.5 h-3.5 text-primary" />
                        Poids pesé
                    </Label>
                    <div className="relative">
                        <Input
                            id="poids-balance"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Ex: 12.5"
                            className="w-full pl-3 pr-8 font-mono text-sm"
                            value={poidsBalance}
                            onChange={(e) => setPoidsBalance(e.target.value)}
                            disabled={isSaving}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                            kg
                        </span>
                    </div>
                </div>
                {/* ------------------------------------------ */}

                <Button
                    variant="outline"
                    className="w-full gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
                    onClick={handlePreviewPDF}
                >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">Aperçu</span>
                </Button>

                <Button
                    variant="ghost"
                    className="col-span-2 w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                    onClick={() => setCreationDevis(false)}
                >
                    <X className="w-3 h-3" />
                    Annuler
                </Button>

                <div className="col-span-2">
                    {!Update ? (
                        <Button
                            className="w-full h-12 gap-2 text-md font-bold shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
                            loading={isSaving}
                            onClick={handleSave}
                        >
                            {isSaving ? (
                                "Enregistrement…"
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Enregistrer le Devis
                                </>
                            )}
                        </Button>
                    ) : (
                        <Button
                            className="w-full h-12 gap-2 text-md font-bold bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20 text-primary-foreground transition-[transform,background-color] active:scale-[0.98]"
                            loading={isSaving}
                            onClick={handleUpdate}
                        >
                            {isSaving ? (
                                "Modification…"
                            ) : (
                                <>
                                    <Pencil className="w-5 h-5" />
                                    Modifier le Devis
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
})

DevisActions.displayName = "DevisActions"
export default DevisActions
