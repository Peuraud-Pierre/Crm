import { useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { useTaskPage } from "../context/TaskPageContext"
import { TaskClientPicker } from "./TaskClientPicker"
import { TaskTypePicker } from "./TaskTypePicker"

/**
 * Même panneau que CreateTaskDialog (client, assignation, type, date/heure,
 * contenu) + le champ "Valide" propre à l'édition — une tâche existante
 * peut être réassignée ou recliente comme à la création.
 */
export function EditTaskDialog() {
    const { openEditModal, setOpenEditModal, editTask, setEditTask, saveTask } =
        useTaskPage()
    const { clients, profiles, fetch_research } = useCRMContext()

    useEffect(() => {
        if (openEditModal) fetch_research()
    }, [openEditModal, fetch_research])

    const editTaskClientId =
        typeof editTask?.client === "object"
            ? editTask?.client?.id ?? ""
            : editTask?.client ?? ""

    return (
        <Dialog open={openEditModal} onOpenChange={setOpenEditModal}>
            <DialogContent className="sm:max-w-md bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>Modifier la tâche</DialogTitle>
                </DialogHeader>
                {editTask && (
                    <div className="flex flex-col gap-4 py-4">
                        <TaskClientPicker
                            clients={clients}
                            clientId={editTaskClientId}
                            onChange={(client) =>
                                setEditTask({ ...editTask, client })
                            }
                        />
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary-foreground">
                                Assigner à
                            </label>
                            <Select
                                value={editTask.owner || ""}
                                onValueChange={(v) =>
                                    setEditTask({ ...editTask, owner: v })
                                }
                            >
                                <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Moi (par défaut)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles?.map((u) => (
                                        <SelectItem
                                            key={u.user_id}
                                            value={u.user_id}
                                        >
                                            {u.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <TaskTypePicker
                            type={editTask.type}
                            onSelect={(type, categorie) =>
                                setEditTask({ ...editTask, type, categorie })
                            }
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-secondary-foreground">
                                    Date
                                </label>
                                <Input
                                    type="date"
                                    value={editTask.date?.slice(0, 10) || ""}
                                    onChange={(e) =>
                                        setEditTask({
                                            ...editTask,
                                            date: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-secondary-foreground">
                                    Heure
                                </label>
                                <Input
                                    type="time"
                                    value={
                                        editTask.date
                                            ? new Date(editTask.date)
                                                  .toTimeString()
                                                  .slice(0, 5)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const datePart =
                                            editTask.date?.slice(0, 10) ||
                                            new Date()
                                                .toISOString()
                                                .slice(0, 10)
                                        setEditTask({
                                            ...editTask,
                                            date: new Date(
                                                `${datePart}T${e.target.value}`
                                            ).toISOString(),
                                        })
                                    }}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary-foreground">
                                Contenu
                            </label>
                            <Textarea
                                rows={4}
                                className="max-h-40 overflow-y-auto"
                                value={editTask.content || ""}
                                onChange={(e) =>
                                    setEditTask({
                                        ...editTask,
                                        content: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <Checkbox
                                checked={editTask.valide || false}
                                onCheckedChange={(c) =>
                                    setEditTask({
                                        ...editTask,
                                        valide: c.valueOf() as boolean,
                                    })
                                }
                            />
                            <span className="text-sm font-medium text-secondary-foreground">
                                Valide
                            </span>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button
                        onClick={saveTask}
                        className="bg-primary text-primary-foreground"
                    >
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
