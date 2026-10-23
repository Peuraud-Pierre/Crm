import { motion } from "framer-motion"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Button } from "@/shared/ui/atoms/button"
import { Edit2, Instagram, Trash2, Users } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useTaskPage } from "../../context/TaskPageContext"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { type Tache as Tache_ } from "@/features/crm/hooks/CRM_hook/use_tache"
import { INSTA_TASK_TYPES } from "../../utils/taskTypes"

export function TaskItem({ task, index }: { task: Tache_; index: number }) {
    const {
        toggleDone,
        handleClientClick,
        handleOpenEditModal,
        openDeleteConfirm,
        activeFilter,
    } = useTaskPage()
    const { profiles } = useCRMContext()
    // Onglet « Assignées » : on affiche à qui la tâche a été confiée.
    const ownerName =
        activeFilter === "assignees"
            ? profiles?.find((p) => p.user_id === task.owner)?.name
            : undefined

    const isInsta =
        task.categorie === "insta" ||
        (!task.categorie &&
            (INSTA_TASK_TYPES as readonly string[]).includes(task.type))
    // Basé sur le rôle du créateur de la tâche (jointure Tache_crm →
    // profiles → roles via creator_id, voir tacheService), pas sur
    // l'utilisateur qui la consulte ni sur l'owner (à qui elle est
    // assignée). Match exact (pas .includes) pour ne pas capturer un futur
    // rôle contenant "admin" en sous-chaîne sans en être un.
    const normalizedCreatorRole = (task.creator_role?.role?.nom || "")
        .toLowerCase()
        .replace(/\s+/g, "")
    const isCreatedByAdmin =
        normalizedCreatorRole === "admin" ||
        normalizedCreatorRole === "superadmin"

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: {
                    duration: 0.3,
                    delay: Math.min(index * 0.04, 0.32),
                    ease: [0.22, 1, 0.36, 1],
                },
            }}
            exit={{
                opacity: 0,
                height: 0,
                marginBottom: 0,
                scale: 0.95,
                transition: { duration: 0.3 },
            }}
            className={cn(
                "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border border-border border-l-4 bg-card shadow-sm cursor-pointer gap-3 transition-colors hover:bg-muted/40",
                isCreatedByAdmin
                    ? "border-l-chart-4"
                    : isInsta
                      ? "border-l-chart-5"
                      : "border-l-success"
            )}
            onClick={() => handleClientClick(task)}
        >
            <div className="flex flex-col md:flex-row md:items-center gap-4 w-full">
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                    {isInsta ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-chart-5/10 text-chart-5 shrink-0">
                            <Instagram size={12} />
                            Insta
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary shrink-0">
                            <Users size={12} />
                            CRM
                        </span>
                    )}
                    <span className="font-semibold text-sm truncate max-w-[160px]">
                        {task.type}
                    </span>
                    {typeof task.client === "object" && task.client?.nom && (
                        <span className="text-foreground bg-muted px-2 py-0.5 rounded text-xs font-medium truncate max-w-[160px]">
                            {task.client.nom}
                        </span>
                    )}
                    {ownerName && (
                        <span className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-medium truncate max-w-[160px]">
                            → {ownerName}
                        </span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm whitespace-pre-line break-words max-h-20 overflow-y-auto pr-1">
                        {task.content}
                    </p>
                </div>
            </div>

            <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
            >
                <Checkbox
                    checked={task.valide || false}
                    onCheckedChange={() => toggleDone(task.id || "")}
                    className="data-[state=checked]:bg-success data-[state=checked]:border-success h-5 w-5 mr-2"
                />
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenEditModal(task)}
                >
                    <Edit2 size={14} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteConfirm(task.id || "")}
                >
                    <Trash2 size={14} />
                </Button>
            </div>
        </motion.div>
    )
}
