import { useMemo } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useDevisContext } from "@/features/crm/context/DevisContext"
import type { Devis } from "@/features/crm/types/quote"

// Champs hérités qui peuvent exister dans d'anciennes lignes en base mais ne
// figurent pas dans le type `Devis` (casse minuscule / champ agrégé obsolète).
// Lecture purement défensive, jamais écrite.
type DevisLegacy = Devis & {
    archive?: boolean | null
    total?: number | null
}

export function useQuotesFiltersLogic() {
    const { user } = useAuth()

    const {
        Devis,
        search,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        clientFilter,
        setClientFilter,
        sortBy,
        setSortBy,
        combinedFilter,
        setCombinedFilter,
        setCreationDevis,
        setUpdate,
    } = useCRMContext()

    const { resetDevis } = useDevisContext()

    const serviceOptions = useMemo(
        () =>
            Array.from(
                new Set(Devis.map((q) => q.service).filter(Boolean))
            ) as string[],
        [Devis]
    )

    const filteredQuotesForStats = useMemo(() => {
        const lowerSearch = searchTerm.toLowerCase()
        return Devis.filter((quote) => {
            const matchesSearch =
                quote.name?.toLowerCase().includes(lowerSearch) ||
                quote.profiles?.full_name?.toLowerCase().includes(lowerSearch)

            const matchesStatus =
                statusFilter === "all" || quote.status === statusFilter
            const matchesClient =
                clientFilter === "all" || quote.client_crm?.nom === clientFilter

            let matchesCombined = true
            if (
                combinedFilter &&
                combinedFilter !== "all" &&
                combinedFilter !== "none"
            ) {
                const [type, id] = combinedFilter.split(":")
                if (type === "service") matchesCombined = quote.service === id
                if (type === "user")
                    matchesCombined = quote.profiles?.user_id === id
            }

            return (
                matchesSearch &&
                matchesStatus &&
                matchesClient &&
                matchesCombined
            )
        })
    }, [Devis, searchTerm, statusFilter, clientFilter, combinedFilter])

    // 🎯 MODIFICATION ICI : Calcul des stats basé sur "envoyer"
    // 🎯 Calcul des stats ULTRA ROBUSTE
    const stats = useMemo(() => {
        // 1. On garde uniquement ceux qui ne sont PAS archivés (Archive !== true) ET qui ont un statut
        const activeQuotes = filteredQuotesForStats.filter((q) => {
            // 🎯 Si la propriété Archive (ou archive en minuscule) est true, on l'exclut directement
            if (q.Archive === true || (q as DevisLegacy).archive === true)
                return false

            // On exclut aussi si le statut est complètement vide ou null
            if (!q.status) return false

            // (Sécurité supplémentaire) Au cas où l'info serait aussi écrite dans le texte du statut
            const statusStr = q.status.toLowerCase().trim()
            if (statusStr === "archive" || statusStr === "acrchive")
                return false

            return true // Le bon est valide, on le garde !
        })

        // Maintenant, on se base uniquement sur les bons "actifs"
        const total = activeQuotes.length

        // 2. On cherche les "Envoyé" parmi les actifs
        const sentQuotes = activeQuotes.filter((q) => {
            const statusStr = q.status?.toLowerCase().trim()
            return statusStr === "envoyé" || statusStr === "envoye"
        })

        // 3. Calcul des montants
        const totalAmount = activeQuotes.reduce(
            (sum, q) =>
                sum + (Number(q.totalTTC) || Number((q as DevisLegacy).total) || 0),
            0
        )

        const sentAmount = sentQuotes.reduce(
            (sum, q) =>
                sum + (Number(q.totalTTC) || Number((q as DevisLegacy).total) || 0),
            0
        )

        const rate =
            total === 0 ? 0 : ((sentQuotes.length / total) * 100).toFixed(1)

        // 🛠️ DEBUG
        console.log("📊 DEBUG STATS :", {
            "Total de bons (actifs, non archivés)": total,
            "Bons reconnus comme 'Envoyé'": sentQuotes.length,
            "Valeur totale calculée": totalAmount,
        })

        return {
            count: total,
            totalValue: totalAmount,
            sentValue: sentAmount,
            conversionRate: rate,
        }
    }, [filteredQuotesForStats])

    const currentUserValue = useMemo(() => {
        if (combinedFilter.startsWith("user:"))
            return combinedFilter.split(":")[1]
        if (combinedFilter === "all") return "all"
        return "none"
    }, [combinedFilter])

    const currentServiceValue = combinedFilter.startsWith("service:")
        ? combinedFilter.split(":")[1]
        : undefined

    const hasActiveFilters =
        statusFilter !== "all" ||
        clientFilter !== "all" ||
        currentUserValue !== "none" ||
        currentServiceValue !== undefined ||
        searchTerm !== ""

    const handleUserChange = (val: string) => {
        if (val === "all") setCombinedFilter("all")
        else if (val === "none") setCombinedFilter("none")
        else setCombinedFilter(`user:${val}`)
    }

    const clearFilters = () => {
        setSearchTerm("")
        setStatusFilter("all")
        setClientFilter("all")
        setCombinedFilter("none")
        setSortBy("date")
    }

    const handleCreateNew = () => {
        resetDevis()
        setUpdate(false)
        setCreationDevis(true)
    }

    return {
        user,
        search,
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        sortBy,
        setSortBy,
        combinedFilter,
        setCombinedFilter,
        serviceOptions,
        stats, // <-- Expose les nouvelles statistiques
        currentUserValue,
        currentServiceValue,
        hasActiveFilters,
        handleUserChange,
        clearFilters,
        handleCreateNew,
    }
}
