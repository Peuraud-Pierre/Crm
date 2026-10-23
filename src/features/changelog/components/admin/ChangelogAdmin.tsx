"use client"

import { useMemo, useRef, useState } from "react"
import { FileClock, Plus, SearchX, Settings } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/atoms/dialog"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { cn } from "@/shared/lib/utils"
import {
    CHANGELOG_DIALOG_SIZE,
    CHANGELOG_PERMISSIONS,
} from "../../constants"
import { useChangelogContext } from "../../hooks/context/ChangelogProvider"
import { compareVersions } from "../../utils/compareVersions"
import type { ChangelogVersionStatus } from "../../types/changelog.types"
import { ChangelogCategoryManager } from "./ChangelogCategoryManager"
import { ChangelogForm } from "./ChangelogForm"
import { ChangelogVersionCard } from "./ChangelogVersionCard"

type StatusFilter = ChangelogVersionStatus | "all"

const FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Tous" },
    { value: "draft", label: "Brouillons" },
    { value: "published", label: "Publiés" },
    { value: "archived", label: "Archivés" },
]

/**
 * Console du changelog — onglet de `/manager`.
 *
 * Regroupe ce que `Manager.tsx` portait lui-même : le bouton de création,
 * la gestion des catégories et la liste filtrée. La page d'accueil de la
 * console n'a plus à connaître les dialogues du changelog.
 */
export function ChangelogAdmin() {
    const { versions, loading } = useChangelogContext()
    const { hasPermission } = useAuth()

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [createOpen, setCreateOpen] = useState(false)
    const [categoriesOpen, setCategoriesOpen] = useState(false)
    // Sert d'offsetParent à la pastille glissante du groupe.
    const filtersRef = useRef<HTMLDivElement>(null)

    const canCreate = hasPermission(CHANGELOG_PERMISSIONS.create)

    const filtered = useMemo(
        () =>
            versions
                .filter(
                    (v) => statusFilter === "all" || v.status === statusFilter
                )
                .sort((a, b) => compareVersions(b.version, a.version)),
        [versions, statusFilter]
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">
                    Gestionnaire de changelog
                </h2>

                <div className="flex flex-wrap gap-2">
                    <Dialog
                        open={categoriesOpen}
                        onOpenChange={setCategoriesOpen}
                    >
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Settings className="size-4" />
                                <span className="hidden sm:inline">
                                    Catégories
                                </span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Gérer les catégories</DialogTitle>
                            </DialogHeader>
                            <ChangelogCategoryManager />
                        </DialogContent>
                    </Dialog>

                    {canCreate && (
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="size-4" />
                                    <span className="hidden sm:inline">
                                        Créer un changelog
                                    </span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent
                                className={cn(
                                    "mx-auto w-full",
                                    CHANGELOG_DIALOG_SIZE
                                )}
                            >
                                <DialogHeader className="px-4 pt-4 sm:px-6">
                                    <DialogTitle className="mb-2 text-xl font-bold sm:text-2xl">
                                        Créer un nouveau changelog
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="px-3 pb-6 sm:px-4 lg:px-6">
                                    <ChangelogForm
                                        mode="create"
                                        setOpen={setCreateOpen}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            <TabButtonGroup
                containerRef={filtersRef}
                className="flex flex-wrap gap-1 rounded-lg bg-muted/50 p-1"
            >
                {FILTERS.map((f) => (
                    <TabButton
                        key={f.value}
                        id={f.value}
                        label={f.label}
                        shortLabel={f.label}
                        active={statusFilter}
                        set={(id) => setStatusFilter(id as StatusFilter)}
                        badge={
                            f.value === "all" ? undefined : (
                                <span className="text-xs opacity-70">
                                    {
                                        versions.filter(
                                            (v) => v.status === f.value
                                        ).length
                                    }
                                </span>
                            )
                        }
                    />
                ))}
            </TabButtonGroup>

            {loading ? (
                <SkeletonList rows={3} label="Chargement du changelog" />
            ) : versions.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={FileClock}
                    title="Aucun changelog"
                    description="Créez une première version pour démarrer l'historique."
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    size="sm"
                    variant="search"
                    icon={SearchX}
                    title="Aucun changelog avec ce filtre"
                    description="Retirez le filtre pour voir toutes les versions."
                    secondaryAction={{
                        label: "Tout afficher",
                        onClick: () => setStatusFilter("all"),
                    }}
                />
            ) : (
                <div className="space-y-4">
                    {filtered.map((version) => (
                        <ChangelogVersionCard
                            key={version.id}
                            version={version}
                            collapsible
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
