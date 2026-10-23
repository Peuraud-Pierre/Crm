import { MerchandiseGrid } from "@/features/sorters/components/manager_trie/MerchandiseGrid"
import { Input } from "@/shared/ui/atoms/input"
import { useGestionsContext } from "@/shared/context/GestionContext"
import { type Balle } from "@/features/sorters/types/type_gestion"
import { useProfilesCtx } from "@/shared/context/ProfilesProvider"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Package, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type FilterType = "all" | "assigned" | "unassigned"

export default function Manager_sort() {
    const [searchQuery, setSearchQuery] = useState("")
    const [filter] = useState<FilterType>("all")

    const { profiles } = useProfilesCtx()
    const { user } = useAuth()
    const { fetch_balle, balle, update_balle } = useGestionsContext()

    // fetch initial
    useEffect(() => {
        if (user) fetch_balle()
    }, [user])

    // 🔥 MEMO: profils filtrés
    const filteredProfiles = useMemo(
        () =>
            profiles.filter(
                (profile) =>
                    profile.role?.nom === "Employé" &&
                    profile.service?.nom === "Salle de Tri"
            ),
        [profiles]
    )

    // 🔥 MEMO: marchandises filtrées
    const filteredMerchandises = useMemo(() => {
        const s = searchQuery.toLowerCase()

        return balle.filter((merchandise) => {
            const matchesSearch =
                merchandise.fournisseur?.name?.toLowerCase().includes(s) ||
                merchandise.category?.toLowerCase().includes(s)

            const matchesFilter =
                filter === "all" ||
                (filter === "assigned" && merchandise.assigned_to) ||
                (filter === "unassigned" && !merchandise.assigned_to)

            return matchesSearch && matchesFilter
        })
    }, [balle, searchQuery, filter])

    // assignation
    const handleAssign = (b: Balle, personId: string) => {
        update_balle({
            ...b,
            assigned_to: { user_id: personId },
        })
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* ------ HEADER ------ */}
                <div className="mb-8 animate-in fade-in duration-slow ease-out">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary">
                            <Package className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <h1 className="text-4xl font-bold text-foreground">
                            Gestion des balles
                        </h1>
                    </div>

                    <p className="text-muted-foreground">
                        Assignez, recherchez et organisez facilement vos balles
                    </p>
                </div>

                {/* ------ SEARCH / FILTER BAR ------ */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher (fournisseur, catégorie...)"
                            className="pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <MerchandiseGrid
                    merchandises={filteredMerchandises}
                    people={filteredProfiles}
                    onAssign={handleAssign}
                />
            </div>
        </div>
    )
}
