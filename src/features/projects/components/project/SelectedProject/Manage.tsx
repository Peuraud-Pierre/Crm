import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/ui/atoms/alert-dialog"
import { Button } from "@/shared/ui/atoms/button"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"
import { Trash2, UserPlus } from "lucide-react"

export function Manage() {
    const {
        handleDeleteProject,
        handleArchiveProject,
        submitting,
    } = useProjectListContext()

    const { setInviteMemberOpen } = useProjectMembersContext()

    const {
        deleteProjectOpen,
        setDeleteProjectOpen,
        archiveProjectOpen,
        setArchiveProjectOpen,
    } = useSprintContext()

    return (
        <div className="flex gap-2">
            <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setInviteMemberOpen(true)}
            >
                <UserPlus className="h-4 w-4" />
                Inviter
            </Button>
            <AlertDialog
                open={deleteProjectOpen}
                onOpenChange={setDeleteProjectOpen}
            >
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer le projet ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Cette action est définitive. Toutes les sprints et
                            les tâches associées seront supprimés.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProject}
                            disabled={submitting === "delete"}
                        >
                            Confirmer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog
                open={archiveProjectOpen}
                onOpenChange={setArchiveProjectOpen}
            >
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                        Terminer
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Terminer le projet ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Le projet passera dans les archives. Vous pourrez le
                            réactiver à tout moment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleArchiveProject}
                            disabled={submitting === "archive"}
                        >
                            Confirmer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
