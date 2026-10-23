import { AlertTriangle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"
import { useTaskPage } from "../context/TaskPageContext"

export function DeleteTaskDialog() {
    const { openDeleteModal, setOpenDeleteModal, executeDelete } =
        useTaskPage()

    return (
        <Dialog open={openDeleteModal} onOpenChange={setOpenDeleteModal}>
            <DialogContent className="sm:max-w-xs bg-card text-card-foreground">
                <DialogHeader className="flex flex-col items-center justify-center text-center">
                    <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
                    <DialogTitle>Confirmation</DialogTitle>
                    <DialogDescription className="text-secondary-foreground mt-2">
                        Êtes-vous sûr de vouloir supprimer cette tâche ? Action
                        irréversible.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex sm:justify-between w-full gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setOpenDeleteModal(false)}
                        className="w-full sm:w-auto"
                    >
                        Annuler
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={executeDelete}
                        className="w-full sm:w-auto"
                    >
                        Supprimer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
