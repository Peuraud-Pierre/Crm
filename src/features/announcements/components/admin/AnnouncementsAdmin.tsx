"use client"

import { useMemo, useState } from "react"
import { Megaphone, Plus, SearchX } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonCard } from "@/shared/ui/molecules/skeleton-presets"
import { ANNOUNCEMENT_TYPE_LABELS, ANNOUNCEMENT_TYPES } from "../../constants"
import { useAnnouncements } from "../../hooks/data/useAnnouncements"
import {
    compareForDisplay,
    getAnnouncementStatus,
} from "../../utils/announcementStatus"
import type { Announcement } from "../../types/announcement.types"
import { AnnouncementCard } from "../AnnouncementCard"
import { AnnouncementArticle } from "../AnnouncementArticle"
import { AnnouncementFormDialog } from "./AnnouncementFormDialog"

const STATUS_FILTERS = [
    { value: "all", label: "Tous les statuts (hors archives)" },
    { value: "online", label: "En ligne" },
    { value: "planned", label: "Planifiées" },
    { value: "expired", label: "Passées" },
    { value: "archived", label: "Archivées" },
] as const

/** Console des annonces — onglet de `/manager`. */
export function AnnouncementsAdmin() {
    const { announcements, loading, create, edit, remove, archive } =
        useAnnouncements()

    const [search, setSearch] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [statusFilter, setStatusFilter] = useState("all")

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<Announcement | null>(null)
    const [viewing, setViewing] = useState<Announcement | null>(null)
    const [pendingDelete, setPendingDelete] = useState<Announcement | null>(
        null
    )

    const filtered = useMemo(() => {
        const now = Date.now()
        const needle = search.trim().toLowerCase()

        return announcements
            .filter((a) => typeFilter === "all" || a.type === typeFilter)
            .filter((a) => {
                const status = getAnnouncementStatus(a, now)
                // Les archivées ne remontent que sur leur filtre dédié :
                // sinon elles pollueraient toutes les autres vues.
                if (statusFilter === "archived") return status === "archived"
                if (status === "archived") return false
                return statusFilter === "all" || status === statusFilter
            })
            .filter((a) => !needle || a.titre.toLowerCase().includes(needle))
            .sort(compareForDisplay)
    }, [announcements, typeFilter, statusFilter, search])

    const hasFilters =
        !!search.trim() || typeFilter !== "all" || statusFilter !== "all"

    function resetFilters() {
        setSearch("")
        setTypeFilter("all")
        setStatusFilter("all")
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                    <Megaphone className="size-6 shrink-0 text-primary" />
                    <h2 className="truncate text-xl font-semibold">
                        Gestion des annonces
                    </h2>
                </div>

                <Button
                    className="shrink-0"
                    onClick={() => {
                        setEditing(null)
                        setFormOpen(true)
                    }}
                >
                    <Plus className="size-4" />
                    Créer une annonce
                </Button>
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
                <Input
                    placeholder="Rechercher une annonce..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="md:w-1/3"
                />

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="md:w-1/3">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les types</SelectItem>
                        {ANNOUNCEMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                                {ANNOUNCEMENT_TYPE_LABELS[t]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="md:w-1/3">
                        <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_FILTERS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                {s.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <SkeletonCard label="Chargement des annonces" />
            ) : filtered.length === 0 ? (
                // On distingue « rien n'existe » de « le filtre ne renvoie
                // rien » : les deux situations n'appellent pas la même
                // action de sortie (DESIGN_SYSTEM.md).
                hasFilters ? (
                    <EmptyState
                        variant="search"
                        icon={SearchX}
                        title="Aucune annonce ne correspond"
                        description="Aucun résultat pour ces filtres."
                        secondaryAction={{
                            label: "Réinitialiser les filtres",
                            onClick: resetFilters,
                        }}
                    />
                ) : (
                    <EmptyState
                        icon={Megaphone}
                        title="Aucune annonce"
                        description="Créez la première annonce visible sur la page d'accueil."
                    />
                )
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((a) => (
                        <AnnouncementCard
                            key={a.id}
                            announcement={a}
                            onClick={() => setViewing(a)}
                            onEdit={() => {
                                setEditing(a)
                                setFormOpen(true)
                            }}
                            onArchive={(_, archived) =>
                                void archive(a.id, archived)
                            }
                            onDelete={() => setPendingDelete(a)}
                        />
                    ))}
                </div>
            )}

            <AnnouncementArticle
                open={!!viewing}
                onOpenChange={(open: boolean) => !open && setViewing(null)}
                announcement={viewing}
            />

            <AnnouncementFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                editing={editing}
                onSubmit={(draft) =>
                    editing ? edit(editing.id, draft) : create(draft)
                }
            />

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer cette annonce ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            « {pendingDelete?.titre} » sera définitivement
                            supprimée. Pour la retirer de l'accueil tout en la
                            conservant, utilisez plutôt l'archivage.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingDelete) void remove(pendingDelete.id)
                                setPendingDelete(null)
                            }}
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
