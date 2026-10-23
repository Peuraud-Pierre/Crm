import { useMemo } from "react"
import { Edit, Trash2, Calendar, Clock, Plus } from "lucide-react"
import { type activites as ActiviteType } from "@/features/crm/hooks/CRM_hook/use_activites"
import { useCRMContext } from "@/features/crm/context/CRMContext"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"

interface CustomerActivityTimelineProps {
    setOpenEventModal: (val: boolean) => void
}

export function CustomerActivityTimeline({
    setOpenEventModal,
}: CustomerActivityTimelineProps) {
    const { activites, setEdit, setEvent, delete_activites } = useCRMContext()
    // --- LOGIQUE AJOUT ACTIVITÉ ---
    const handleCreateEvent = () => {
        setEvent(null) // On reset l'événement en cours
        setEdit(false) // On passe en mode création
        setOpenEventModal(true) // On ouvre la modale
    }

    // Optimisation : Tri et Regroupement
    const groupedActivities = useMemo(() => {
        const list = Array.isArray(activites) ? activites : []

        const sorted = [...list].sort(
            (a, b) =>
                (b.date ? new Date(b.date).getTime() : 0) -
                (a.date ? new Date(a.date).getTime() : 0)
        )

        const groups: Record<string, ActiviteType[]> = {}

        sorted.forEach((act) => {
            if (!act.date) return
            const date = new Date(act.date)
            const monthYear = date.toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
            })
            const formattedGroup =
                monthYear.charAt(0).toUpperCase() + monthYear.slice(1)

            if (!groups[formattedGroup]) groups[formattedGroup] = []
            groups[formattedGroup].push(act)
        })

        return groups
    }, [activites])

    const formatTime = (dateString: string) => {
        const d = new Date(dateString)
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
        if (!hasTime) return null
        return d.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const formatDateDay = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
        })
    }

    return (
        <div className="space-y-6">
            {/* --- BOUTON AJOUTER --- */}
            <Button
                onClick={handleCreateEvent}
                className="w-full text-red-600 bg-red-100 hover:bg-red-200 dark:bg-gray-800 dark:hover:bg-red-800/50 shadow-sm border-0 mb-4"
            >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter une Activité
            </Button>

            {!activites || activites.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4 text-center border-2 border-dashed rounded-lg">
                    Aucune activité enregistrée pour le moment.
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground font-medium">
                            Historique des interactions
                        </p>
                        <div className="h-px bg-border flex-1" />
                    </div>

                    {Object.entries(groupedActivities).map(([month, acts]) => (
                        <div key={month} className="relative">
                            {/* En-tête du mois */}
                            <div className="mb-4 inline-flex items-center justify-center px-3 py-1 rounded-full bg-muted/50 text-xs font-semibold text-muted-foreground border border-border">
                                {month}
                            </div>

                            <div className="flex flex-col ml-2 space-y-0">
                                {acts.map((act, i) => {
                                    const isLast = i === acts.length - 1
                                    const timeStr = act.date
                                        ? formatTime(act.date)
                                        : null

                                    return (
                                        <div
                                            key={act.id || i}
                                            className="flex group relative pb-8 last:pb-0"
                                        >
                                            {/* COLONNE TIMELINE */}
                                            <div className="flex flex-col items-center mr-4">
                                                {/* Point */}
                                                <div
                                                    className={cn(
                                                        "w-3 h-3 rounded-full border-2 border-background z-10 shrink-0 mt-1.5",
                                                        "bg-primary shadow-sm"
                                                    )}
                                                />
                                                {/* Ligne */}
                                                {!isLast && (
                                                    <div className="w-px h-full bg-border absolute left-[5px] top-4 -z-0" />
                                                )}
                                            </div>

                                            {/* CARTE CONTENU */}
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    className={cn(
                                                        "relative p-4 rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-[box-shadow,border-color,background-color] duration-base",
                                                        "hover:shadow-md hover:border-primary/30 hover:bg-accent/5 flex flex-col" // Ajout de flex flex-col pour structurer la carte
                                                    )}
                                                >
                                                    {/* En-tête Carte */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {act.date
                                                                    ? formatDateDay(
                                                                          act.date
                                                                      )
                                                                    : "Date inconnue"}
                                                            </span>
                                                            {timeStr && (
                                                                <>
                                                                    <span>
                                                                        •
                                                                    </span>
                                                                    <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-[10px]">
                                                                        <Clock className="w-3 h-3" />
                                                                        {
                                                                            timeStr
                                                                        }
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Actions (Edit/Delete) */}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-base">
                                                            <button
                                                                title="Modifier"
                                                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.stopPropagation()
                                                                    setEdit(
                                                                        true
                                                                    )
                                                                    setEvent(
                                                                        act
                                                                    )
                                                                    setOpenEventModal(
                                                                        true
                                                                    )
                                                                }}
                                                            >
                                                                <Edit
                                                                    size={14}
                                                                />
                                                            </button>

                                                            <button
                                                                title="Supprimer"
                                                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                                onClick={(
                                                                    e
                                                                ) => {
                                                                    e.stopPropagation()
                                                                    const hasClientId =
                                                                        (
                                                                            client: unknown
                                                                        ): client is {
                                                                            id:
                                                                                | string
                                                                                | number
                                                                        } =>
                                                                            typeof client ===
                                                                                "object" &&
                                                                            client !==
                                                                                null &&
                                                                            "id" in
                                                                                client

                                                                    const clientId =
                                                                        hasClientId(
                                                                            act.client
                                                                        )
                                                                            ? act
                                                                                  .client
                                                                                  .id
                                                                            : act.client

                                                                    const clientIdString =
                                                                        clientId !==
                                                                            undefined &&
                                                                        clientId !==
                                                                            null
                                                                            ? String(
                                                                                  clientId
                                                                              )
                                                                            : undefined

                                                                    if (act.id)
                                                                        delete_activites(
                                                                            act.id,
                                                                            clientIdString
                                                                        )
                                                                }}
                                                            >
                                                                <Trash2
                                                                    size={14}
                                                                />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Contenu Carte */}
                                                    <div className="space-y-1 mb-2">
                                                        {" "}
                                                        {/* Ajout de mb-2 pour séparer du footer */}
                                                        {act.title && (
                                                            <h4 className="font-semibold text-sm text-foreground tracking-tight">
                                                                {act.title}
                                                            </h4>
                                                        )}
                                                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                                            {act.content || (
                                                                <span className="italic text-xs opacity-50">
                                                                    Aucune
                                                                    description...
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>

                                                    {/* 🎯 Footer de la carte : Assigné à (en bas à droite) */}
                                                    <div className="flex justify-end mt-auto pt-2 border-t border-border/50">
                                                        {act.owner &&
                                                            typeof act.owner !==
                                                                "string" &&
                                                            act.owner
                                                                .full_name && (
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    Créé par{" "}
                                                                    <span className="font-medium text-foreground">
                                                                        {
                                                                            act
                                                                                .owner
                                                                                .full_name
                                                                        }
                                                                    </span>
                                                                </p>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}
