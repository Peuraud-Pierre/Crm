import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { PRIORITY_META } from "@/features/projects/project_constants"
import type { TaskPriority } from "@/features/projects/types"

export interface TaskFormValues {
    title: string
    description: string
    priority: TaskPriority
    dueDate: string
    assigneeId: string
}

interface TaskFormProps {
    form: TaskFormValues
    onChange: (updater: (prev: TaskFormValues) => TaskFormValues) => void
    idPrefix: string
    members?: { userId: string; label: string }[]
}

export function TaskForm({ form, onChange, idPrefix, members = [] }: TaskFormProps) {
    return (
        <div className="space-y-4 py-2">
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-title`}>Titre</Label>
                <Input
                    id={`${idPrefix}-title`}
                    placeholder="Configurer la CI"
                    value={form.title}
                    onChange={(event) =>
                        onChange((prev) => ({
                            ...prev,
                            title: event.target.value,
                        }))
                    }
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-description`}>Descriptif</Label>
                <Textarea
                    id={`${idPrefix}-description`}
                    placeholder="Détaillez le travail à réaliser"
                    value={form.description}
                    onChange={(event) =>
                        onChange((prev) => ({
                            ...prev,
                            description: event.target.value,
                        }))
                    }
                    rows={3}
                />
            </div>
            {members.length > 0 && (
                <div className="space-y-2">
                    <Label>Assigné à</Label>
                    <Select
                        value={form.assigneeId || "unassigned"}
                        onValueChange={(value) =>
                            onChange((prev) => ({
                                ...prev,
                                assigneeId:
                                    value === "unassigned" ? "" : value,
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Non assigné" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="unassigned">
                                Non assigné
                            </SelectItem>
                            {members.map((m) => (
                                <SelectItem key={m.userId} value={m.userId}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Urgence</Label>
                    <Select
                        value={form.priority}
                        onValueChange={(value: string) =>
                            onChange((prev) => ({
                                ...prev,
                                priority: value as TaskPriority,
                            }))
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                            {(
                                Object.keys(PRIORITY_META) as TaskPriority[]
                            ).map((priority) => (
                                <SelectItem key={priority} value={priority}>
                                    {PRIORITY_META[priority].label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-due-date`}>
                        Échéance (optionnel)
                    </Label>
                    <Input
                        id={`${idPrefix}-due-date`}
                        type="date"
                        value={form.dueDate}
                        onChange={(event) =>
                            onChange((prev) => ({
                                ...prev,
                                dueDate: event.target.value,
                            }))
                        }
                    />
                </div>
            </div>
        </div>
    )
}
