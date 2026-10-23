import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Label } from "@/shared/ui/atoms/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { AttachmentPicker, AttachmentRow, TaskAttachments } from "./taskAttachments"
import { TaskForm, type TaskFormValues } from "./taskForm"

interface TaskDialogProps {
    mode: "create" | "edit"
    open: boolean
    onOpenChange: (open: boolean) => void
    form: TaskFormValues
    onFormChange: (updater: (prev: TaskFormValues) => TaskFormValues) => void
    /** Reçoit les fichiers en attente (création) ; vide en édition. */
    onSubmit: (files: File[]) => void
    submitting: boolean
    members?: { userId: string; label: string }[]
    /** Tâche éditée : ses pièces jointes se gèrent en direct. */
    taskId?: string
}

const CONFIG = {
    create: {
        title: "Nouvelle tâche",
        description: "Ajoutez une carte au sprint en cours.",
        submitLabel: "Créer",
        idPrefix: "task",
    },
    edit: {
        title: "Modifier la tâche",
        description: "Mettez à jour le contenu de cette carte.",
        submitLabel: "Enregistrer",
        idPrefix: "edit-task",
    },
}

export function TaskDialog({
    mode,
    open,
    onOpenChange,
    form,
    onFormChange,
    onSubmit,
    submitting,
    members,
    taskId,
}: TaskDialogProps) {
    const config = CONFIG[mode]
    // En création, la tâche n'a pas encore d'id : les fichiers attendent
    // l'insertion, puis createTask les envoie.
    const [pendingFiles, setPendingFiles] = useState<File[]>([])

    // Vidé à la fermeture, quel que soit le chemin (annuler, succès, clic
    // extérieur) : Main ferme le dialogue sans passer par ce composant.
    const [prevOpen, setPrevOpen] = useState(open)
    if (open !== prevOpen) {
        setPrevOpen(open)
        if (!open) setPendingFiles([])
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{config.title}</SheetTitle>
                    <SheetDescription>{config.description}</SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto">
                    <TaskForm
                        form={form}
                        onChange={onFormChange}
                        idPrefix={config.idPrefix}
                        members={members}
                    />

                    {taskId ? (
                        <TaskAttachments taskId={taskId} editable />
                    ) : (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Pièces jointes</Label>
                                <AttachmentPicker
                                    onPick={(files) =>
                                        setPendingFiles((prev) => [...prev, ...files])
                                    }
                                />
                            </div>
                            {pendingFiles.length > 0 && (
                                <ul className="divide-y rounded-md border">
                                    {pendingFiles.map((file) => (
                                        <AttachmentRow
                                            key={`${file.name}-${file.size}-${file.lastModified}`}
                                            name={file.name}
                                            sizeBytes={file.size}
                                        >
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                aria-label={`Retirer ${file.name}`}
                                                onClick={() =>
                                                    setPendingFiles((prev) =>
                                                        prev.filter((f) => f !== file)
                                                    )
                                                }
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </AttachmentRow>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <SheetFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={() => onSubmit(taskId ? [] : pendingFiles)}
                        disabled={submitting}
                    >
                        {config.submitLabel}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

export type { TaskFormValues }
