import { Card } from "@/shared/ui/atoms/card"
import { MessageSquare } from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { useTaskPage } from "../../context/TaskPageContext"
import { TaskItem } from "./TaskItem"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

export function TaskList() {
    const { filteredTasks, activeFilter, filters } = useTaskPage()
    const currentFilterLabel = filters.find(
        (f) => f.value === activeFilter
    )?.label

    return (
        <div className="flex-1 overflow-auto animate-in fade-in duration-slow">
            <Card className="p-4 h-full bg-card text-card-foreground border border-border shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    Tâches :{" "}
                    <span className="text-secondary-foreground font-normal">
                        {currentFilterLabel}
                    </span>
                    <span className="ml-auto text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {filteredTasks.length}
                    </span>
                </h3>

                <div className="flex flex-col gap-3">
                    {filteredTasks.length === 0 && (
                        <EmptyState
                            size="sm"
                            icon={MessageSquare}
                            title="Aucune tâche"
                            description="Aucune tâche pour cette catégorie."
                        />
                    )}

                    <AnimatePresence mode="popLayout" initial={false}>
                        {filteredTasks.map((task, index) => (
                            <TaskItem key={task.id} task={task} index={index} />
                        ))}
                    </AnimatePresence>
                </div>
            </Card>
        </div>
    )
}
