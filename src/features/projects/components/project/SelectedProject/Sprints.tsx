import { Button } from "@/shared/ui/atoms/button"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"
import { Plus } from "lucide-react"

export function Sprints() {
    const {
        canInteractWithProject,
        canManageProject,
    } = useProjectListContext()

    const { setCreateSprintOpen } = useSprintContext()

    return (
        <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold uppercase leading-none tracking-wider text-foreground">
                Sprints
            </h3>
            {canInteractWithProject && canManageProject && (
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setCreateSprintOpen(true)}
                >
                    <Plus className="h-4 w-4" />
                    Nouveau sprint
                </Button>
            )}
        </div>
    )
}
