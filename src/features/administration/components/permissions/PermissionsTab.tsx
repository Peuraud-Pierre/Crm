import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { KeyRound, Layers, Search, TriangleAlert } from "lucide-react"
import { SearchX } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/atoms/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useEntityOptions } from "../../hooks/data/useEntityOptions"
import {
    groupByCategory,
    matchesPermissionSearch,
} from "../../utils/groupByCategory"
import { ADMIN_PERMISSIONS } from "../../constants"
import type {
    EntityKind,
    Permission,
    PermissionAssignments,
    PermissionHolders as Holders,
} from "../../types"
import { categoryLabel } from "../shared/categoryLabels"
import { StatTile } from "@/shared/components/misc/StatTile"
import { PermissionHoldersSummary } from "./PermissionHolders"
import { PermissionSheet } from "./PermissionSheet"

// Clés stables pour les placeholders de chargement.
const SKELETON_KEYS = ["sk1", "sk2", "sk3", "sk4"]

function isUnassigned(holders: Holders | undefined): boolean {
    return (
        !holders ||
        (holders.roles.length === 0 &&
            holders.services.length === 0 &&
            holders.userCount === 0)
    )
}

/**
 * Onglet Permissions : catalogue groupé par catégorie, ligne cliquable →
 * fiche d'accès (détenteurs + attribution rôles/services). La tuile
 * « Non attribuées » filtre le catalogue sur les permissions orphelines.
 */
export function PermissionsTab({
    permissions,
    assignments,
    loading,
    assignToEntity,
}: {
    permissions: Permission[]
    assignments: PermissionAssignments
    loading: boolean
    refetch: () => Promise<void>
    assignToEntity: (
        permissionId: string,
        entity: { kind: EntityKind; id: string },
        grant: boolean
    ) => Promise<boolean>
}) {
    const { roles, services } = useEntityOptions()
    const { hasPermission } = useAuth()
    const canManage = hasPermission(ADMIN_PERMISSIONS.rolesServicesManage)

    const [search, setSearch] = useState("")
    const [onlyUnassigned, setOnlyUnassigned] = useState(false)

    // Fiche ouverte = ?fiche=<id> : partageable, cohérent avec Rôles/Services.
    const [searchParams, setSearchParams] = useSearchParams()
    const ficheId = searchParams.get("fiche")
    const ficheEntity = permissions.find((p) => p.id === ficheId) ?? null

    function openFiche(id: string) {
        setSearchParams({ fiche: id })
    }
    function closeFiche() {
        setSearchParams({}, { replace: true })
    }

    // Deep-link mort (permission supprimée ou id inconnu) : on nettoie l'URL.
    useEffect(() => {
        if (ficheId && !loading && !ficheEntity) {
            setSearchParams({}, { replace: true })
        }
    }, [ficheId, loading, ficheEntity, setSearchParams])

    const grouped = useMemo(
        () =>
            groupByCategory(
                permissions
                    .filter((p) => matchesPermissionSearch(p, search))
                    .filter(
                        (p) =>
                            !onlyUnassigned || isUnassigned(assignments.get(p.id))
                    )
            ),
        [permissions, search, onlyUnassigned, assignments]
    )

    const categoryCount = new Set(
        permissions.map((p) => (p.category?.trim() || "Autres").toLowerCase())
    ).size
    const unassignedCount = permissions.filter((p) =>
        isUnassigned(assignments.get(p.id))
    ).length

    const filtering = search.trim().length > 0 || onlyUnassigned

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                <StatTile
                    icon={KeyRound}
                    label="Permissions"
                    value={permissions.length}
                    loading={loading}
                    index={0}
                />
                <StatTile
                    icon={Layers}
                    label="Catégories"
                    value={categoryCount}
                    loading={loading}
                    index={1}
                />
                <StatTile
                    icon={TriangleAlert}
                    label="Non attribuées"
                    value={unassignedCount}
                    tone={unassignedCount > 0 ? "warning" : "success"}
                    loading={loading}
                    index={2}
                    active={onlyUnassigned}
                    onClick={() => setOnlyUnassigned((v) => !v)}
                />
            </div>

            <Card className="shadow-surface">
                <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <KeyRound className="w-5 h-5 text-primary shrink-0" />
                        Catalogue des permissions
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Cliquez une permission pour ouvrir sa fiche —
                        détenteurs{canManage && " et attribution directe"}.
                    </p>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher (label, code, catégorie)..."
                                className="pl-10"
                                aria-label="Rechercher une permission"
                            />
                        </div>
                        {filtering && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("")
                                    setOnlyUnassigned(false)
                                }}
                                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
                            >
                                Réinitialiser
                            </button>
                        )}
                    </div>
                </CardHeader>

                <CardContent aria-busy={loading}>
                    {loading ? (
                        <div className="space-y-3">
                            {SKELETON_KEYS.map((key) => (
                                <Skeleton key={key} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : grouped.length === 0 ? (
                        <EmptyState
                            size="sm"
                            variant="search"
                            icon={SearchX}
                            title="Aucune permission ne correspond"
                            description="Essayez un autre terme de recherche."
                        />
                    ) : (
                        <Accordion
                            type="multiple"
                            // En recherche/filtre, tout est déplié pour montrer les résultats.
                            value={
                                filtering
                                    ? grouped.map((g) => g.label)
                                    : undefined
                            }
                            className="space-y-1"
                        >
                            {grouped.map((group) => (
                                <AccordionItem
                                    key={group.label}
                                    value={group.label}
                                >
                                    <AccordionTrigger className="text-sm font-medium">
                                        {categoryLabel(group.label)}{" "}
                                        <span className="text-muted-foreground font-normal ml-1">
                                            ({group.perms.length})
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <ul className="space-y-1">
                                            {group.perms.map((p) => (
                                                <li
                                                    key={p.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() =>
                                                        openFiche(p.id)
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (
                                                            e.key ===
                                                                "Enter" ||
                                                            e.key === " "
                                                        ) {
                                                            e.preventDefault()
                                                            openFiche(p.id)
                                                        }
                                                    }}
                                                    className="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm">
                                                            {p.label}
                                                        </p>
                                                        <p className="font-mono text-2xs text-muted-foreground">
                                                            {p.code}
                                                        </p>
                                                    </div>
                                                    <PermissionHoldersSummary
                                                        holders={
                                                            assignments.get(
                                                                p.id
                                                            ) ?? null
                                                        }
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>

            <PermissionSheet
                permission={ficheEntity}
                holders={
                    ficheEntity ? (assignments.get(ficheEntity.id) ?? null) : null
                }
                roles={roles}
                services={services}
                canManage={canManage}
                onClose={closeFiche}
                onToggle={(entity, grant) =>
                    ficheEntity
                        ? assignToEntity(ficheEntity.id, entity, grant)
                        : Promise.resolve(false)
                }
            />
        </div>
    )
}
