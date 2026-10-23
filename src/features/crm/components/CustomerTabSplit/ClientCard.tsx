import { memo, useMemo } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/atoms/tooltip"
import { type Client } from "@/features/crm/hooks/CRM_hook/use_client"
import { cn } from "@/shared/lib/utils"
import { getExperienceBgClasses } from "@/shared/utils/CrmTab"
import { ArrowRightLeft, CalendarOff, Clock } from "lucide-react"
import { LiveTimer } from "./LiveTimer"
import { Button } from "@/shared/ui/atoms/button"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { isFicheAppro } from "@/features/crm/utils/invariants"
import type { TaskStatus } from "@/features/crm/utils/crmCompute"

const TooltipDot = memo(function TooltipDot({
    color,
    text,
}: {
    color: string
    text: string
}) {
    return (
        <Tooltip>
            <TooltipTrigger>
                <div
                    className={`h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-background ${color}`}
                />
            </TooltipTrigger>
            <TooltipContent>
                <p>{text}</p>
            </TooltipContent>
        </Tooltip>
    )
})

interface ClientCardProps {
    client: Client
    taskStatus: TaskStatus
    isDragging: boolean
    onDragStart: (client: Client) => void
    onClick: (client: Client) => void
}

export const ClientCard = memo(function ClientCard({
    client,
    taskStatus,
    isDragging,
    onDragStart,
    onClick,
}: ClientCardProps) {
    const isNew = !client.prise_en_charge
    const dateCreation = client.created_at || ""
    const { setOpenEventModal } = useCRMContext()

    const brief = useMemo(
        () => (isFicheAppro(client.brief) ? client.brief : null),
        [client.brief]
    )
    const experienceClasses = useMemo(
        () => getExperienceBgClasses(brief?.experience),
        [brief?.experience]
    )

    // La modale d'event est désormais montée EN SINGLETON dans CustomersTab —
    // on ne fait ici que déclencher l'ouverture via le contexte.
    return (
        <div
            draggable
            onDragStart={(e) => {
                // Firefox refuse de démarrer un glisser dont le dataTransfer
                // est vide : sans ce setData, la carte ne bouge pas du tout.
                e.dataTransfer.setData("text/plain", client.id ?? "")
                e.dataTransfer.effectAllowed = "move"
                onDragStart(client)
            }}
            onClick={(e) => {
                e.stopPropagation()
                onClick(client)
            }}
            className={cn(
                "p-3 rounded-md border shadow-sm cursor-grab active:cursor-grabbing group hover:scale-[1.02] hover:z-10 transition-[transform,opacity,filter] duration-base bg-card relative",
                experienceClasses,
                isDragging && "opacity-50 grayscale"
            )}
        >
            <div className="flex justify-between items-start mb-1 gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sm line-clamp-1 break-all">
                        {client.nom}
                    </span>
                    {isNew && <LiveTimer startDate={dateCreation} />}
                </div>
                <div className="shrink-0 pt-0.5">
                    {taskStatus === "red" && (
                        <TooltipDot
                            color="bg-red-500 animate-pulse"
                            text="Tâche en retard"
                        />
                    )}
                    {taskStatus === "green" && (
                        <TooltipDot
                            color="bg-emerald-500"
                            text="Tâche aujourd'hui"
                        />
                    )}
                    {taskStatus === "gray" && (
                        <TooltipDot
                            color="bg-gray-400"
                            text="Tâche future"
                        />
                    )}
                    {taskStatus === "notask" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 p-0 text-muted-foreground/60 hover:text-primary"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (client.id)
                                            setOpenEventModal(client.id)
                                    }}
                                >
                                    <CalendarOff className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Ajouter une interaction / tâche</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
            <div className="flex flex-col gap-0.5 text-[11px] opacity-90">
                {brief?.experience && (
                    <span className="font-mono opacity-80 font-medium">
                        Experience: {brief.experience}
                    </span>
                )}
                {/* Ternaire et non `&&` : un budget à 0 rendait « 0 » seul
                    (React affiche les nombres). 0 = non renseigné → rien. */}
                {brief?.budget ? (
                    <span className="font-mono opacity-80 font-medium">
                        Budget: {brief.budget} €
                    </span>
                ) : null}
                {brief?.activiteType && (
                    <div className="flex items-center gap-1 opacity-80">
                        <ArrowRightLeft className="h-3 w-3 shrink-0" />
                        <span className="truncate">{brief.activiteType}</span>
                    </div>
                )}
                {client.urgency && (
                    <div className="flex items-center gap-1 opacity-80">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{client.urgency}</span>
                    </div>
                )}
            </div>
        </div>
    )
})
