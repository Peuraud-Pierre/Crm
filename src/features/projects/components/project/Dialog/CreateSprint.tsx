import { Button } from "@/shared/ui/atoms/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"

export function CreateSprint() {
    const {
        createSprintOpen,
        setCreateSprintOpen,
        submitting,
        sprintForm,
        setSprintForm,
        handleCreateSprint,
    } = useSprintContext()

    return (
        <Sheet open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Nouveau sprint</SheetTitle>
                    <SheetDescription>
                        Définissez l'objectif et les dates clés du sprint.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto py-2">
                    <div className="space-y-2">
                        <Label htmlFor="sprint-name">Nom</Label>
                        <Input
                            id="sprint-name"
                            placeholder="Sprint 12"
                            value={sprintForm.name}
                            onChange={(event) =>
                                setSprintForm((prev) => ({
                                    ...prev,
                                    name: event.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sprint-goal">Objectif</Label>
                        <Textarea
                            id="sprint-goal"
                            placeholder="Objectifs principaux du sprint"
                            value={sprintForm.goal}
                            onChange={(event) =>
                                setSprintForm((prev) => ({
                                    ...prev,
                                    goal: event.target.value,
                                }))
                            }
                            rows={4}
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="sprint-start">Début</Label>
                            <Input
                                id="sprint-start"
                                type="date"
                                value={sprintForm.startDate}
                                onChange={(event) =>
                                    setSprintForm((prev) => ({
                                        ...prev,
                                        startDate: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sprint-end">Fin</Label>
                            <Input
                                id="sprint-end"
                                type="date"
                                value={sprintForm.endDate}
                                onChange={(event) =>
                                    setSprintForm((prev) => ({
                                        ...prev,
                                        endDate: event.target.value,
                                    }))
                                }
                            />
                        </div>
                    </div>
                </div>

                <SheetFooter>
                    <Button
                        variant="outline"
                        onClick={() => setCreateSprintOpen(false)}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleCreateSprint}
                        disabled={submitting === "sprint"}
                    >
                        Créer
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
