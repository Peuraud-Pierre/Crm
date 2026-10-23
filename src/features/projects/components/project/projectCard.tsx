import { Badge } from "@/shared/ui/atoms/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import { cn } from "@/shared/lib/utils"
import { hashToColor } from "@/features/projects/utils/hashToColor"
import type { ProjectTeam } from "@/features/projects/types"

interface ProjectCardProps {
    project: ProjectTeam
    selected: boolean
    onClick: () => void
    /** list mode renders a compact horizontal row instead of a full card */
    listMode?: boolean
}

export function ProjectCard({ project, selected, onClick, listMode }: ProjectCardProps) {
    const isArchived = project.status === "archived"
    const activeSprint = project.sprints?.find((s) => s.status !== "archived")
    const totalTasks = activeSprint?.tasks?.length ?? 0
    const doneTasks = activeSprint?.tasks?.filter((t) => t.status === "done").length ?? 0
    const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100)

    const visibleMembers = project.members.slice(0, 4)
    const extraCount = project.members.length - visibleMembers.length

    if (listMode) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(
                    "flex w-full items-center gap-4 rounded-lg border bg-card px-4 py-3 text-left transition-[box-shadow,border-color] hover:shadow-sm hover:border-primary/30",
                    selected && "border-primary/50 bg-primary/5",
                    isArchived && "opacity-60"
                )}
            >
                {/* Color dot */}
                <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: hashToColor(project.id) }}
                />

                {/* Name */}
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {project.name}
                </span>

                {/* Sprint */}
                {activeSprint && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {activeSprint.name}
                    </span>
                )}

                {/* Progress */}
                {totalTasks > 0 && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {progress}%
                    </span>
                )}

                {/* Status */}
                {isArchived && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Archivé
                    </Badge>
                )}

                {/* Members */}
                <div className="flex shrink-0 -space-x-1.5">
                    {visibleMembers.map((m) => {
                        const color = hashToColor(m.user_id)
                        const label =
                            m.profile?.full_name ?? m.profile?.email ?? "?"
                        return (
                            <Avatar
                                key={m.user_id}
                                className="h-5 w-5 ring-1 ring-card"
                            >
                                <AvatarImage
                                    src={resolveAvatarUrl(m.profile?.avatar_url)}
                                    alt={label}
                                />
                                <AvatarFallback
                                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                    className="text-[8px] font-bold text-white"
                                    style={{ backgroundColor: color }}
                                >
                                    {label[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                            </Avatar>
                        )
                    })}
                    {extraCount > 0 && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted ring-1 ring-card text-[8px] font-semibold text-muted-foreground">
                            +{extraCount}
                        </div>
                    )}
                </div>
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-[box-shadow,border-color] hover:shadow-md hover:border-primary/30",
                selected && "border-primary/50 bg-primary/5 shadow-md",
                isArchived && "opacity-60"
            )}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div
                        className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: hashToColor(project.id) }}
                    />
                    <span className="truncate text-sm font-semibold text-foreground">
                        {project.name}
                    </span>
                </div>
                {isArchived && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Archivé
                    </Badge>
                )}
            </div>

            {/* Description */}
            {project.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                    {project.description}
                </p>
            )}

            {/* Active sprint */}
            {activeSprint && (
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground truncate">
                        {activeSprint.name}
                    </span>
                </div>
            )}

            {/* Progress bar */}
            {totalTasks > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Progression</span>
                        <span>{doneTasks}/{totalTasks} · {progress}%</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-slow"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Footer: members */}
            <div className="flex items-center justify-between">
                <div className="flex -space-x-1.5">
                    {visibleMembers.map((m) => {
                        const color = hashToColor(m.user_id)
                        const label =
                            m.profile?.full_name ?? m.profile?.email ?? "?"
                        return (
                            <Avatar
                                key={m.user_id}
                                className="h-6 w-6 ring-2 ring-card"
                            >
                                <AvatarImage
                                    src={resolveAvatarUrl(m.profile?.avatar_url)}
                                    alt={label}
                                />
                                <AvatarFallback
                                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                    className="text-[9px] font-bold text-white"
                                    style={{ backgroundColor: color }}
                                >
                                    {label[0]?.toUpperCase() ?? "?"}
                                </AvatarFallback>
                            </Avatar>
                        )
                    })}
                    {extraCount > 0 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted ring-2 ring-card text-[9px] font-semibold text-muted-foreground">
                            +{extraCount}
                        </div>
                    )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                    {project.members.length} membre{project.members.length > 1 ? "s" : ""}
                </span>
            </div>
        </button>
    )
}
