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

export function CreateTaskDialog() {
    const {
        openCreateModal,
        setOpenCreateModal,
        newTask,
        setNewTask,
        createTask,
    } = useTaskPage()
    const { clients, profiles, fetch_research } = useCRMContext()

    useEffect(() => {
        if (openCreateModal) fetch_research()
    }, [openCreateModal, fetch_research])

    const newTaskClientId =
        typeof newTask.client === "object"
            ? newTask.client?.id ?? ""
            : newTask.client ?? ""

    return (
        <Dialog open={openCreateModal} onOpenChange={setOpenCreateModal}>
            <DialogContent className="sm:max-w-md bg-card text-card-foreground">
                <DialogHeader>
                    <DialogTitle>Nouvelle tâche</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <TaskClientPicker
                        clients={clients}
                        clientId={newTaskClientId}
                        onChange={(client) =>
                            setNewTask({ ...newTask, client })
                        }
                    />
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-secondary-foreground">
                            Assigner à
                        </label>
                        <Select
                            value={newTask.owner || ""}
                            onValueChange={(v) =>
                                setNewTask({ ...newTask, owner: v })
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
                        type={newTask.type}
                        onSelect={(type, categorie) =>
                            setNewTask({ ...newTask, type, categorie })
                        }
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-secondary-foreground">
                                Date
                            </label>
                            <Input
                                type="date"
                                value={newTask.date?.slice(0, 10) || ""}
                                onChange={(e) =>
                                    setNewTask({
                                        ...newTask,
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
                                    newTask.date
                                        ? new Date(newTask.date)
                                              .toTimeString()
                                              .slice(0, 5)
                                        : ""
                                }
                                onChange={(e) => {
                                    const datePart =
                                        newTask.date?.slice(0, 10) ||
                                        new Date().toISOString().slice(0, 10)
                                    setNewTask({
                                        ...newTask,
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
                            value={newTask.content || ""}
                            onChange={(e) =>
                                setNewTask({
                                    ...newTask,
                                    content: e.target.value,
                                })
                            }
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        onClick={createTask}
                        className="bg-primary text-primary-foreground"
                    >
                        Créer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
