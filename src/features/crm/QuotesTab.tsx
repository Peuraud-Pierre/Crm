import { useEffect, useMemo } from "react"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

import { ArchivedQuotes } from "./components/Devis/Archives"
import CreateDevis from "./components/Devis/creation"
import { ActiveQuotes } from "./components/Devis/ActiveQuotes"
import { QuotesFiltersAndStats } from "./components/Devis/Header_Devis"

// ==========================================
// 🛠️ FONCTIONS UTILITAIRES
// ==========================================
export const round2 = (num: number) =>
    Math.round((num + Number.EPSILON) * 100) / 100

// ==========================================
// 🧠 LE CERVEAU (CUSTOM HOOK)
// ==========================================
export function useQuotesLogic() {
    const {
        Devis,
        fetchDevisByUser,
        creationDevis,
        combinedFilter,
        combinedRef,
        setAllUsers,
        searchTerm,
        statusFilter,
        clientFilter,
        fetch_research,
        enableProducts,
    } = useCRMContext()

    const { user } = useAuth()

    // 0. Active le chargement produits + abonnement devis (différés hors de cet onglet)
    useEffect(() => {
        enableProducts()
    }, [enableProducts])

    // 1. Chargement initial de la recherche
    useEffect(() => {
        if (user?.user_id) fetch_research()
    }, [user?.user_id, fetch_research])

    // 2. Sauvegarde locale du filtre combiné
    useEffect(() => {
        if (!combinedFilter) return
        combinedRef.current = combinedFilter
        try {
            localStorage.setItem("combinedFilter", combinedFilter)
        } catch {
            // ignore storage quota / private mode
        }
    }, [combinedFilter, combinedRef])

    // 3. Charger les utilisateurs uniques depuis les devis (Nécessaire globalement)
    useEffect(() => {
        const usersMap: Record<string, { id: string; full_name: string }> = {}
        Devis.forEach((q) => {
            if (q.profiles?.user_id) {
                usersMap[q.profiles.user_id] = {
                    id: q.profiles.user_id,
                    full_name: q.profiles.full_name || "",
                }
            }
        })
        setAllUsers(Object.values(usersMap))
    }, [Devis, setAllUsers])

    // 4. Fetch des devis via l'API selon le filtre combiné
    useEffect(() => {
        if (!user?.user_id) return

        const loadDevis = async () => {
            if (!combinedFilter || combinedFilter === "all") {
                await fetchDevisByUser({ type: "by", id: "*" })
            } else if (combinedFilter === "none") {
                // "Aucune" = uniquement mes devis
                await fetchDevisByUser({ type: "by", id: user.user_id })
            } else {
                const [type, id] = combinedFilter.split(":")

                // Si le filtre (venant de l'UI) s'appelle "user",
                // on indique à la base de données de chercher dans la colonne "by"
                const dbColumn = type === "user" ? "by" : type

                if (dbColumn === "by" || dbColumn === "service") {
                    await fetchDevisByUser({
                        type: dbColumn,
                        id,
                    })
                }
            }
        }

        loadDevis()
    }, [user?.user_id, combinedFilter, fetchDevisByUser])

    // 5. Filtrage réactif pour l'affichage des listes (Actifs & Archives)
    const filteredQuotes = useMemo(() => {
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

            // --- CORRECTION ICI ---
            if (combinedFilter === "none") {
                // Si filtre "Aucune", on affiche uniquement ceux créés "par" l'utilisateur connecté
                matchesCombined = quote.by === user?.user_id
            } else if (combinedFilter && combinedFilter !== "all") {
                const [type, id] = combinedFilter.split(":")
                if (type === "service") {
                    matchesCombined = quote.service === id
                } else if (type === "user") {
                    // On utilise 'quote.by' au lieu de 'quote.profiles?.user_id'
                    matchesCombined = quote.by === id
                }
            }

            return (
                matchesSearch &&
                matchesStatus &&
                matchesClient &&
                matchesCombined
            )
        })
    }, [
        Devis,
        searchTerm,
        statusFilter,
        clientFilter,
        combinedFilter,
        user?.user_id,
    ]) // Ajout de user?.user_id dans les dépendances

    // On ne renvoie plus que le strict minimum !
    return {
        user,
        filteredQuotes,
        creationDevis,
    }
}

// ==========================================
// 🖼️ COMPOSANT PRINCIPAL
// ==========================================
export default function QuotesTab() {
    const logic = useQuotesLogic()

    return (
        <div className="space-y-6">
            {/* 1. Header Autonome (Zéro props ! 🎉) */}
            <QuotesFiltersAndStats />

            {/* 2. Liste des devis actifs */}
            <ActiveQuotes
                quotes={logic.filteredQuotes}
                round2={round2}
                user={logic.user}
            />

            {/* 3. Modale de création/édition */}
            {logic.creationDevis && <CreateDevis />}

            {/* 4. Liste des devis archivés */}
            <ArchivedQuotes
                quotes={logic.filteredQuotes}
                round2={round2}
                user={logic.user}
            />
        </div>
    )
}
