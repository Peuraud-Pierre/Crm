import { EditTaskDialog } from "./EditTaskDialog"
import { CreateTaskDialog } from "./CreateTaskDialog"
import { DeleteTaskDialog } from "./DeleteTaskDialog"

/** Compose les 3 dialogs de la page Tâches — un fichier par responsabilité
 * (édition, création, suppression), cf. TaskClientPicker/TaskTypePicker
 * pour les panneaux partagés entre édition et création. */
export function TaskModals() {
    return (
        <>
            <EditTaskDialog />
            <CreateTaskDialog />
            <DeleteTaskDialog />
        </>
    )
}
