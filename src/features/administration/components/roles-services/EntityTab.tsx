import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { KeyRound, Plus, Search, Users as UsersIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { ADMIN_PERMISSIONS } from "../../constants"
import type { Entity, Permission } from "../../types"
import { StatTile } from "@/shared/components/misc/StatTile"
import { EntityCard } from "./EntityCard"
import { EntityFormDialog } from "./EntityFormDialog"
import { EntitySheet } from "./EntitySheet"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

// Clés stables pour les placeholders de chargement.
const SKELETON_KEYS = ["sk1", "sk2", "sk3"]

export interface EntityTabLabels {
    title: string
    createLabel: string
    createTitle: string
    nameLabel: string
    emptyTitle: string
    /** « rôle » ou « service » — libellés d'impact/suppression. */
    entityWord: string
    /** Libellé pluriel de la tuile de total (« Rôles », « Services »). */
    statsLabel: string
    searchPlaceholder: string
    icon: LucideIcon
}

export interface EntityTabCrud<T extends Entity> {
    entities: T[]
    loading: boolean
    create: (nom: string) => Promise<T | null>
    rename: (id: string, nom: string) => Promise<boolean>
    remove: (id: string) => Promise<boolean>
    addPermissions: (
        id: string,
        toAdd: Entity["permissions"]
    ) => Promise<boolean>
    removePermission: (id: string, permissionId: string) => Promise<boolean>
}

/**
 * Onglet générique rôles/services : bande de stats, grille de cartes
 * cliquables, fiche d'accès en Sheet (deep-linkable via ?fiche=<id>),
 * création guidée (la fiche s'ouvre pour attribuer les permissions).
 */
export function EntityTab<T extends Entity>({
    labels,
    crud,
    counts,
    countsLoading,
    permissions,
}: {
    labels: EntityTabLabels
    crud: EntityTabCrud<T>
    /** Effectif (nombre de profils) par id d'entité. */
    counts: Map<string, number>
    countsLoading: boolean
    /** Catalogue complet (sans détenteurs) pour la modale d'ajout — fourni par le shell. */
    permissions: Permission[]
}) {
    const { hasPermission } = useAuth()
    const canManage = hasPermission(ADMIN_PERMISSIONS.rolesServicesManage)

    const [formOpen, setFormOpen] = useState(false)
    const [search, setSearch] = useState("")

    // Fiche ouverte = ?fiche=<id> : partageable et ciblable depuis
    // l'onglet Permissions (badges détenteurs).
    const [searchParams, setSearchParams] = useSearchParams()
    const ficheId = searchParams.get("fiche")
    const ficheEntity = crud.entities.find((e) => e.id === ficheId) ?? null

    function openFiche(id: string) {
        setSearchParams({ fiche: id })
    }
    function closeFiche() {
        setSearchParams({}, { replace: true })
    }

    // Deep-link mort (entité supprimée ou id inconnu) : on nettoie l'URL.
    useEffect(() => {
        if (ficheId && !crud.loading && !ficheEntity) {
            setSearchParams({}, { replace: true })
        }
    }, [ficheId, crud.loading, ficheEntity, setSearchParams])

    const availablePerms = useMemo(() => {
        if (!ficheEntity) return []
        const assigned = new Set(ficheEntity.permissions.map((p) => p.id))
        return permissions.filter((p) => !assigned.has(p.id))
    }, [permissions, ficheEntity])

    const filteredEntities = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return crud.entities
        return crud.entities.filter((e) => e.nom.toLowerCase().includes(q))
    }, [crud.entities, search])

    const coveredUsers = crud.entities.reduce(
        (sum, e) => sum + (counts.get(e.id) ?? 0),
        0
    )
    const distinctPerms = new Set(
        crud.entities.flatMap((e) => e.permissions.map((p) => p.id))
    ).size

    async function handleCreate(nom: string) {
        const created = await crud.create(nom)
        if (created) {
            setFormOpen(false)
            // Flow guidé : la fiche s'ouvre pour attribuer les permissions.
            openFiche(created.id)
        }
    }

    const Icon = labels.icon
    const isSearching = search.trim().length > 0

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
                <StatTile
                    icon={Icon}
                    label={labels.statsLabel}
                    value={crud.entities.length}
                    loading={crud.loading}
                    index={0}
                />
                <StatTile
                    icon={UsersIcon}
                    label="Utilisateurs couverts"
                    value={coveredUsers}
                    loading={crud.loading || countsLoading}
                    index={1}
                />
                <StatTile
                    icon={KeyRound}
                    label="Permissions distinctes"
                    value={distinctPerms}
                    loading={crud.loading}
                    index={2}
                />
            </div>

            <Card className="shadow-surface">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex min-w-0 items-center gap-2 text-xl">
                            <Icon className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">{labels.title}</span>
                        </CardTitle>
                        <EntityFormDialog
                            open={formOpen}
                            onOpenChange={setFormOpen}
                            title={labels.createTitle}
                            label={labels.nameLabel}
                            onSubmit={handleCreate}
                            trigger={
                                <Button disabled={!canManage}>
                                    <Plus className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">
                                        {labels.createLabel}
                                    </span>
                                </Button>
                            }
                        />
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={labels.searchPlaceholder}
                            className="pl-10"
                            aria-label={labels.searchPlaceholder}
                        />
                    </div>
                </CardHeader>

                <CardContent aria-busy={crud.loading}>
                    {crud.loading ? (
                        <div
                            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                            aria-hidden
                        >
                            {SKELETON_KEYS.map((key) => (
                                <Skeleton
                                    key={key}
                                    className="h-36 w-full rounded-lg"
                                />
                            ))}
                        </div>
                    ) : filteredEntities.length === 0 ? (
                        <EmptyState
                            icon={Icon}
                            variant={isSearching ? "search" : "default"}
                            title={isSearching ? "Aucun résultat" : labels.emptyTitle}
                            description={
                                isSearching
                                    ? "Aucun nom ne correspond à la recherche."
                                    : "Créez-en un pour commencer à attribuer des permissions."
                            }
                        />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredEntities.map((entity) => (
                                <EntityCard
                                    key={entity.id}
                                    entity={entity}
                                    icon={Icon}
                                    userCount={counts.get(entity.id) ?? 0}
                                    onOpen={() => openFiche(entity.id)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <EntitySheet
                entity={ficheEntity}
                icon={Icon}
                entityWord={labels.entityWord}
                nameLabel={labels.nameLabel}
                userCount={ficheEntity ? (counts.get(ficheEntity.id) ?? 0) : 0}
                countsLoading={countsLoading}
                canManage={canManage}
                availablePerms={availablePerms}
                onClose={closeFiche}
                onRename={(nom) =>
                    ficheEntity
                        ? crud.rename(ficheEntity.id, nom)
                        : Promise.resolve(false)
                }
                onDelete={() =>
                    ficheEntity
                        ? crud.remove(ficheEntity.id)
                        : Promise.resolve(false)
                }
                onAddPermissions={(selected) =>
                    ficheEntity
                        ? crud.addPermissions(ficheEntity.id, selected)
                        : Promise.resolve(false)
                }
                onRemovePermission={(permissionId) => {
                    if (ficheEntity) {
                        void crud.removePermission(
                            ficheEntity.id,
                            permissionId
                        )
                    }
                }}
            />
        </div>
    )
}
