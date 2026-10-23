import React, { useEffect, useState, memo, useCallback } from "react"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import {
    Percent,
    ExternalLink,
    Coins,
    FileText,
    Check,
    Info,
    Loader2,
    Building2,
} from "lucide-react"

const TaxAndBilling = memo(function TaxAndBilling() {
    const { update_fiche_client, clients } = useCRMContext()
    const {
        TVA,
        setTVA,
        AvoirValue,
        setAvoirValue,
        TvaNumber,
        setTvaNumber,
        client, // ID du client sélectionné
        siret,
        setSiret,
    } = useDevisContext()

    // On récupère l'objet client complet depuis la liste
    const currentClientObject = clients.find((c) => c.id === client)

    const [isFetching, setIsFetching] = useState(false)

    // --- 🪄 AUTO-SCROLL SUR FOCUS (FIX CLAVIER MOBILE) ---
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        const target = e.target
        setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
        }, 300)
    }

    // --------------------------------------------------------
    // 1. SYNCHRONISATION INITIALE
    // --------------------------------------------------------
    useEffect(() => {
        if (currentClientObject) {
            setTvaNumber(currentClientObject.numero_TVA || "")
            setSiret(currentClientObject.siret || "")
        }
    }, [client, currentClientObject?.id, setTvaNumber, setSiret])

    // --------------------------------------------------------
    // 4. FONCTION D'ENRICHISSEMENT (Mémorisée)
    // --------------------------------------------------------
    const handleApiEnrichment = useCallback(
        async (sirenCandidate: string) => {
            if (sirenCandidate.length !== 9) return
            if (isFetching) return

            setIsFetching(true)

            try {
                const url = `https://info.nokk-project.example/api/entreprise/${sirenCandidate}`

                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                })

                if (!response.ok) return

                const data = await response.json()

                // Mise à jour locale
                if (data.tva) setTvaNumber(data.tva)

                const newSiret = data.siret || data.siretsiege
                if (newSiret) setSiret(newSiret)

                if (data.tva?.startsWith("FR") && TVA !== "20") setTVA("20")

                // Sauvegarde DB
                if (data != null && client) {
                    const updates: {
                        id: string
                        societe?: string
                        siret?: string
                        numero_TVA?: string
                        localisation?: string
                    } = { id: client }
                    let hasChanges = false

                    const newName = data.denomination || data.nom_complet
                    if (newName) {
                        updates.societe = newName
                        hasChanges = true
                    }

                    if (newSiret) {
                        updates.siret = newSiret
                        hasChanges = true
                    }

                    if (data.tva) {
                        updates.numero_TVA = data.tva
                        hasChanges = true
                    }

                    if (hasChanges) {
                        await update_fiche_client(updates)
                    }
                }
            } catch (error) {
                console.error("💥 Erreur enrichissement :", error)
            } finally {
                setIsFetching(false)
            }
        },
        [
            isFetching,
            client,
            TVA,
            setTvaNumber,
            setSiret,
            setTVA,
            update_fiche_client,
        ]
    )

    // --------------------------------------------------------
    // 2. LOGIQUE AUTOMATIQUE VIA TVA
    // --------------------------------------------------------
    useEffect(() => {
        const cleanTva = TvaNumber ? TvaNumber.replace(/\s/g, "") : ""
        if (!cleanTva || cleanTva.length < 2) return

        const countryCode = cleanTva.substring(0, 2).toUpperCase()

        if (countryCode === "FR") {
            if (TVA !== "20") setTVA("20")
        } else if (/^[A-Z]{2}$/.test(countryCode)) {
            if (TVA !== "0") setTVA("0")
        }

        const delayDebounceFn = setTimeout(async () => {
            const isFrenchFormat = /^FR[0-9]{11}$/i.test(cleanTva)

            const needsCheck =
                isFrenchFormat &&
                (cleanTva !==
                    currentClientObject?.numero_TVA?.replace(/\s/g, "") ||
                    !currentClientObject?.siret ||
                    !currentClientObject?.societe)

            if (needsCheck) {
                const sirenFromTva = cleanTva.replace(/[^0-9]/g, "").slice(-9)
                await handleApiEnrichment(sirenFromTva)
            }
        }, 1000)

        return () => clearTimeout(delayDebounceFn)
    }, [TvaNumber, TVA, setTVA, currentClientObject, handleApiEnrichment])

    // --------------------------------------------------------
    // 3. LOGIQUE AUTOMATIQUE VIA SIRET
    // --------------------------------------------------------
    useEffect(() => {
        const cleanSiret = siret ? siret.replace(/\s/g, "") : ""
        if (cleanSiret.length < 9) return

        const delayDebounceFn = setTimeout(async () => {
            const needsCheck =
                cleanSiret !== currentClientObject?.siret ||
                !currentClientObject?.numero_TVA ||
                !currentClientObject?.societe

            if (needsCheck) {
                const sirenFromSiret = cleanSiret.substring(0, 9)
                await handleApiEnrichment(sirenFromSiret)
            }
        }, 1000)

        return () => clearTimeout(delayDebounceFn)
    }, [siret, currentClientObject, handleApiEnrichment])

    // Validation visuelle
    const isTvaValid = TvaNumber && TvaNumber.length > 2
    const isSiretValid = siret && siret.length >= 9

    return (
        <div className="p-3 sm:p-4 bg-card/50 rounded-xl border shadow-sm mb-4">
            {/* items-start sur mobile pour éviter un écrasement vertical, items-end sur desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 items-start md:items-end">
                {/* 1. TAUX */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center h-5">
                        <div className="flex items-center gap-2">
                            <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Percent className="w-3.5 h-3.5" />
                                Taux
                            </label>
                            <TooltipProvider>
                                <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                        <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help hover:text-primary transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-[200px] text-xs">
                                        <p>
                                            FR = 20% <br /> UE (Hors FR) = 0%
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                    <Select value={TVA} onValueChange={setTVA} required>
                        <SelectTrigger className="w-full bg-background h-9">
                            <SelectValue placeholder="%" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="20">20 %</SelectItem>
                            <SelectItem value="10">10 %</SelectItem>
                            <SelectItem value="5.5">5,5 %</SelectItem>
                            <SelectItem value="0">0 %</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* 3. SIRET */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center h-5">
                        <label
                            className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors ${isSiretValid ? "text-green-600" : "text-muted-foreground"}`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            SIRET
                        </label>
                        <a
                            href="https://www.sirene.fr/sirene/public/accueil"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0"
                        >
                            <span className="hidden sm:inline">Vérifier</span>
                            <span className="sm:hidden">Lien</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="relative">
                        <Input
                            type="text"
                            value={siret || ""}
                            onChange={(e) =>
                                setSiret(
                                    e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 14)
                                )
                            }
                            onFocus={handleFocus}
                            className={`bg-background h-9 transition-colors duration-slow ${isSiretValid ? "pr-8 border-green-500 text-green-900" : ""}`}
                            placeholder="14 chiffres"
                            maxLength={14}
                        />
                        {isFetching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                            </div>
                        )}
                        {isSiretValid && !isFetching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Check className="h-3.5 w-3.5 text-green-600" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. TVA */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center h-5">
                        <label
                            className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wider flex items-center gap-2 transition-colors ${isTvaValid ? "text-green-600" : "text-muted-foreground"}`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            N° TVA
                        </label>
                        <a
                            href="https://ec.europa.eu/taxation_customs/vies/#/vat-validation"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 shrink-0"
                            title="TVA hors France ou UE"
                        >
                            <span className="hidden sm:inline">
                                TVA hors UE
                            </span>
                            <span className="sm:hidden">Lien</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                    <div className="relative">
                        <Input
                            type="text"
                            value={TvaNumber || ""}
                            onChange={(e) => setTvaNumber(e.target.value)}
                            onFocus={handleFocus}
                            className={`bg-background h-9 uppercase placeholder:normal-case transition-colors duration-slow ${isTvaValid ? "pr-8 border-green-500 text-green-900" : ""}`}
                            placeholder="FR..."
                        />
                        {isTvaValid && !isFetching && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Check className="h-3.5 w-3.5 text-green-600" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. AVOIR */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center h-5">
                        <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Coins className="w-3.5 h-3.5" />
                            Avoir
                        </label>
                    </div>
                    <div className="relative">
                        <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={AvoirValue === 0 ? "" : AvoirValue}
                            onChange={(e) =>
                                setAvoirValue(Number(e.target.value))
                            }
                            onFocus={handleFocus}
                            className="bg-background h-9 pr-8"
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                            €
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
})

export default TaxAndBilling
