import { cn } from "@/shared/lib/utils"
import { Users, X } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/shared/ui/atoms/sheet"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"

export function CreateProject({
    canCreateProjects,
}: {
    canCreateProjects: boolean
}) {
    const {
        currentUserId,
        createProjectOpen,
        setCreateProjectOpen,
        projectForm,
        setProjectForm,
        addMemberToProjectForm,
        removeMemberFromForm,
        handleCreateProject,
        submitting,
    } = useProjectListContext()

    const {
        filteredCreationDirectory,
        selectedCreationMembers,
        projectDirectorySearch,
        setProjectDirectorySearch,
    } = useProjectMembersContext()

    if (canCreateProjects) {
        return (
            <Sheet
                open={createProjectOpen}
                onOpenChange={setCreateProjectOpen}
            >
                <SheetTrigger asChild>
                    <Button className="shrink-0 gap-2" aria-label="Nouveau projet">
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Nouveau projet</span>
                        <span className="sm:hidden">Projet</span>
                    </Button>
                </SheetTrigger>
                <SheetContent className="flex w-full flex-col sm:max-w-lg">
                    <SheetHeader className="shrink-0 pr-8">
                        <SheetTitle>Créer un projet</SheetTitle>
                        <SheetDescription>
                            Donnez un nom, un objectif et invitez les premiers
                            collaborateurs.
                        </SheetDescription>
                    </SheetHeader>

                    {/* min-h-0 : sans lui le contenu pousse le footer hors de l'écran
                        au lieu de scroller à l'intérieur du sheet.
                        -mx-1 px-1 : overflow-y-auto force overflow-x à auto, ce qui
                        rognait l'anneau de focus des champs w-full ; la gouttière lui
                        laisse la place, la marge négative préserve l'alignement. */}
                    <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-2">
                        <div className="shrink-0 space-y-2">
                            <Label htmlFor="project-name">Nom</Label>
                            <Input
                                id="project-name"
                                placeholder="Refonte portail client"
                                value={projectForm.name}
                                onChange={(event) =>
                                    setProjectForm((prev) => ({
                                        ...prev,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="shrink-0 space-y-2">
                            <Label htmlFor="project-description">
                                Objectif
                            </Label>
                            <Textarea
                                id="project-description"
                                placeholder="Décrivez l'objectif ou le périmètre du projet"
                                value={projectForm.description}
                                onChange={(event) =>
                                    setProjectForm((prev) => ({
                                        ...prev,
                                        description: event.target.value,
                                    }))
                                }
                                rows={4}
                            />
                        </div>
                        {/* flex-1 : l'annuaire absorbe la hauteur restante du sheet
                            plutôt que de rester bloqué sur une hauteur fixe. */}
                        <div className="flex min-h-0 flex-1 flex-col gap-2">
                            <Label>Collaborateurs</Label>
                            <Input
                                placeholder="Rechercher un collaborateur"
                                value={projectDirectorySearch}
                                onChange={(event) =>
                                    setProjectDirectorySearch(
                                        event.target.value
                                    )
                                }
                            />
                            <div className="min-h-32 flex-1 space-y-1 overflow-y-auto rounded-md border border-dashed bg-muted/30 p-2">
                                {filteredCreationDirectory.length === 0 ? (
                                    <div className="rounded-md border border-dashed bg-background/40 p-3 text-center text-xs text-muted-foreground">
                                        Aucun collaborateur trouvé
                                    </div>
                                ) : (
                                    filteredCreationDirectory.map((member) => {
                                        const isSelected =
                                            projectForm.members.includes(
                                                member.user_id
                                            )
                                        const isSelf =
                                            member.user_id === currentUserId
                                        const disabled = isSelected || isSelf
                                        return (
                                            <button
                                                type="button"
                                                key={member.user_id}
                                                onClick={() =>
                                                    addMemberToProjectForm(
                                                        member.user_id
                                                    )
                                                }
                                                disabled={disabled}
                                                className={cn(
                                                    "flex w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-left text-xs transition",
                                                    disabled
                                                        ? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
                                                        : "border-transparent hover:border-emerald-200 hover:bg-emerald-50"
                                                )}
                                            >
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate font-medium text-foreground">
                                                        {member.full_name ??
                                                            member.email ??
                                                            "Collaborateur"}
                                                    </span>
                                                    <span className="truncate text-[11px] text-muted-foreground">
                                                        {member.email ??
                                                            "Email manquant"}
                                                    </span>
                                                </div>
                                                <span className="shrink-0 text-[11px] font-medium">
                                                    {isSelf
                                                        ? "Responsable"
                                                        : isSelected
                                                        ? "Ajouté"
                                                        : "Ajouter"}
                                                </span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                            {selectedCreationMembers.length > 0 && (
                                <div className="flex shrink-0 flex-wrap gap-2 pt-2">
                                    {selectedCreationMembers.map((member) => (
                                        <Badge
                                            key={member.user_id}
                                            variant="secondary"
                                            className="gap-1"
                                        >
                                            {member.full_name ??
                                                member.email ??
                                                "Collaborateur"}
                                            <button
                                                type="button"
                                                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() =>
                                                    removeMemberFromForm(
                                                        member.user_id
                                                    )
                                                }
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <SheetFooter className="shrink-0">
                        <Button
                            variant="outline"
                            onClick={() => setCreateProjectOpen(false)}
                        >
                            Annuler
                        </Button>
                        <Button
                            onClick={handleCreateProject}
                            disabled={submitting === "project"}
                        >
                            Créer
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Accès en consultation : contactez votre responsable de service
            pour créer un projet.
        </div>
    )
}
