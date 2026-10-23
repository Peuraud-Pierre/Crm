import { Filter, Search, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import type { EntityOption } from "../../types"

export interface UserFiltersState {
    search: string
    role: string
    service: string
    status: string
}

export const DEFAULT_USER_FILTERS: UserFiltersState = {
    search: "",
    role: "all",
    service: "all",
    status: "all",
}

interface UserFiltersProps {
    filters: UserFiltersState
    onChange: (filters: UserFiltersState) => void
    roles: EntityOption[]
    services: EntityOption[]
    /** Nombre de résultats après filtrage — affiché quand un filtre est actif. */
    resultCount: number
}

export function UserFilters({
    filters,
    onChange,
    roles,
    services,
    resultCount,
}: UserFiltersProps) {
    const set = (partial: Partial<UserFiltersState>) =>
        onChange({ ...filters, ...partial })

    const isFiltering =
        filters.search !== "" ||
        filters.role !== "all" ||
        filters.service !== "all" ||
        filters.status !== "all"

    return (
        <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Rechercher un utilisateur..."
                        value={filters.search}
                        onChange={(e) => set({ search: e.target.value })}
                        className="pl-10"
                        aria-label="Rechercher un utilisateur"
                    />
                </div>

                <Select
                    value={filters.role}
                    onValueChange={(role) => set({ role })}
                >
                    <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filtrer par rôle" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les rôles</SelectItem>
                        {roles.map((role) => (
                            <SelectItem key={role.id} value={role.nom}>
                                {role.nom}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.service}
                    onValueChange={(service) => set({ service })}
                >
                    <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filtrer par service" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les services</SelectItem>
                        {services.map((service) => (
                            <SelectItem key={service.id} value={service.nom}>
                                {service.nom}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.status}
                    onValueChange={(status) => set({ status })}
                >
                    <SelectTrigger className="w-full sm:w-48">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Filtrer par statut" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="pending">En attente</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isFiltering && (
                <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground" role="status">
                        {resultCount} résultat{resultCount > 1 ? "s" : ""}
                    </p>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onChange(DEFAULT_USER_FILTERS)}
                    >
                        <X className="w-3 h-3 mr-1.5" />
                        Réinitialiser
                    </Button>
                </div>
            )}
        </div>
    )
}
