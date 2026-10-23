import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import Grid from "@/features/drive/components/Grid"
import type { DriveItem } from "@/features/drive/types"
import { useDrive } from "@/features/drive/hooks/useDrive"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useSelection } from "@/features/sorters/hooks/useSelection"
import { Button } from "@/shared/ui/atoms/button"
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
import { env } from "@/shared/lib/env"

/** Ce qu'une confirmation en attente doit détruire. */
type PendingPurge = { ids?: string[]; label: string }

export default function Trash() {
    const { user } = useAuth()
    const currentUserId = user?.user_id ?? user?.id
    const navigate = useNavigate()

    const [items, setItems] = useState<DriveItem[]>([])
    const [pendingPurge, setPendingPurge] = useState<PendingPurge | null>(null)

    const { listTrash, restoreItems, purgeItems } = useDrive(
        env.PUBLIC_API_BASE_URL + "/api/gallery"
    )
    const { selected, selectedIds, clear, toggle } = useSelection()

    const reload = useCallback(async () => {
        if (!currentUserId) return
        try {
            setItems(await listTrash(currentUserId))
        } catch (err) {
            toast.error("Erreur de chargement", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "Impossible de charger la corbeille.",
            })
        }
    }, [currentUserId, listTrash])

    useEffect(() => {
        clear()
        reload()
    }, [reload])

    const handleRestore = async () => {
        if (!selectedIds.length) return
        try {
            await restoreItems(selectedIds)
            toast.success("Restauration réussie", {
                description: `${selectedIds.length} élément(s) remis dans le Drive.`,
            })
            clear()
            await reload()
        } catch (err) {
            toast.error("Restauration impossible", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "Les éléments n'ont pas pu être restaurés.",
            })
        }
    }

    const confirmPurge = async () => {
        if (!pendingPurge) return
        try {
            await purgeItems(pendingPurge.ids)
            toast.success("Suppression définitive", {
                description: pendingPurge.label,
            })
            clear()
            await reload()
        } catch (err) {
            toast.error("Suppression impossible", {
                description:
                    (err instanceof Error ? err.message : undefined) ||
                    "La purge a échoué.",
            })
        } finally {
            setPendingPurge(null)
        }
    }

    return (
        <div className="mx-auto max-w-7xl p-4 md:p-6">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Corbeille
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Les éléments supprimés restent ici jusqu'à leur
                        suppression définitive.
                    </p>
                </div>
                <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigate("/drive")}
                >
                    <ArrowLeft className="h-4 w-4" /> Retour au Drive
                </Button>
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                    variant="outline"
                    className="gap-2 w-full sm:w-auto"
                    disabled={!selectedIds.length}
                    onClick={handleRestore}
                >
                    <RotateCcw className="h-4 w-4" />
                    Restaurer{selectedIds.length ? ` (${selectedIds.length})` : ""}
                </Button>
                <Button
                    variant="destructive"
                    className="gap-2 w-full sm:w-auto"
                    disabled={!selectedIds.length}
                    onClick={() =>
                        setPendingPurge({
                            ids: selectedIds,
                            label: `${selectedIds.length} élément(s) supprimé(s) définitivement.`,
                        })
                    }
                >
                    <Trash2 className="h-4 w-4" />
                    Supprimer définitivement
                </Button>
                <Button
                    variant="destructive"
                    className="gap-2 w-full sm:w-auto sm:ml-auto"
                    disabled={!items.length}
                    onClick={() =>
                        setPendingPurge({
                            label: "La corbeille a été vidée.",
                        })
                    }
                >
                    <Trash2 className="h-4 w-4" /> Vider la corbeille
                </Button>
            </div>

            {/* Un fichier en corbeille n'est plus servi par l'API : le clic
                sélectionne au lieu d'ouvrir un aperçu qui échouerait. */}
            <Grid
                items={items}
                selected={selected}
                onToggle={toggle}
                onOpen={(item) => toggle(item.id)}
            />

            <AlertDialog
                open={!!pendingPurge}
                onOpenChange={(o) => !o && setPendingPurge(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer définitivement ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingPurge?.ids
                                ? `${pendingPurge.ids.length} élément(s) et leur contenu seront détruits.`
                                : "Tout le contenu de la corbeille sera détruit."}{" "}
                            Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmPurge}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Supprimer définitivement
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
