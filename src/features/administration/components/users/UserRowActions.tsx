import { useState } from "react"
import { Edit, MoreVertical, Power, Trash2 } from "lucide-react"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import type { AdminProfile } from "../../types"

interface UserRowActionsProps {
    user: AdminProfile
    canUpdate: boolean
    canDelete: boolean
    onEdit: () => void
    onToggleStatus: () => void
    onDelete: () => void
}

/**
 * Menu d'actions « ⋯ » d'une ligne/carte utilisateur. L'ouverture de la fiche
 * passe par le clic de ligne — le menu reste le chemin clavier (Modifier) et
 * porte les actions rapides (statut, suppression).
 */
export function UserRowActions({
    user,
    canUpdate,
    canDelete,
    onEdit,
    onToggleStatus,
    onDelete,
}: UserRowActionsProps) {
    const [confirmOpen, setConfirmOpen] = useState(false)

    const isActive = user.status === "active"

    const onConfirmDelete = () => {
        onDelete()
        setConfirmOpen(false)
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        aria-label={`Actions pour ${user.full_name}`}
                        // La ligne parente ouvre la fiche au clic.
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={!canUpdate} onClick={onEdit}>
                        <Edit className="mr-2 h-4 w-4" />
                        Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        disabled={!canUpdate}
                        onClick={onToggleStatus}
                    >
                        <Power className="mr-2 h-4 w-4" />
                        {isActive ? "Désactiver" : "Activer"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        disabled={!canDelete}
                        onClick={() => setConfirmOpen(true)}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer l&apos;utilisateur ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est irréversible.{" "}
                            <span className="font-medium text-foreground">
                                {user.full_name}
                            </span>{" "}
                            sera définitivement supprimé.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={onConfirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
