import { Badge } from "@/shared/ui/atoms/badge"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { X } from "lucide-react"

export function Members() {
    const {
        selectedProject,
        canManageProject,
        submitting,
        hashToColor,
        handleRemoveMember,
    } = useProjectListContext()

    const { projectMembers } = useProjectMembersContext()

    return (
        <>
            <p className="text-xs font-medium text-muted-foreground uppercase">
                Membres
            </p>
            <div className="flex flex-wrap gap-2">
                {projectMembers.map((member) => {
                    const color = hashToColor(member.userId)
                    const canRemoveMember =
                        canManageProject &&
                        member.userId !== selectedProject?.owner_id
                    const isRemoving = submitting === `remove:${member.userId}`
                    return (
                        <div
                            key={member.userId}
                            className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                            style={{
                                borderColor: color,
                                backgroundColor: `${color}22`,
                            }}
                        >
                            <span
                                // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: color }}
                            >
                                {member.label?.[0]?.toUpperCase() ?? "?"}
                            </span>
                            <span className="text-foreground">
                                {member.label}
                            </span>
                            {member.userId === selectedProject?.owner_id && (
                                <Badge
                                    variant="secondary"
                                    className="border-0 bg-muted px-1 text-[10px]"
                                >
                                    Responsable
                                </Badge>
                            )}
                            {canRemoveMember && (
                                <button
                                    type="button"
                                    className="ml-1 text-xs text-muted-foreground transition hover:text-destructive"
                                    onClick={() =>
                                        handleRemoveMember(member.userId)
                                    }
                                    disabled={isRemoving}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </>
    )
}
