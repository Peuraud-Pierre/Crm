import {ChevronDown, Grid, LayoutList, Plus, Search, SearchX, FolderKanban } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { useRef, useState } from "react"
import { cn } from "@/shared/lib/utils"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/atoms/collapsible"
import { ProjectCard } from "./projectCard"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectUIContext } from "@/features/projects/hooks/context/projectUIContext"
import { CreateProject } from "@/features/projects/components/project/CreateProject"
import type { ProjectTeam } from "@/features/projects/types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"

export function ProjectsHome() {
    // Conteneur de la bascule grille/liste : offsetParent de la pastille.
    const displayRef = useRef<HTMLDivElement | null>(null)
    const {
        projectsInvolved,
        projectsOthers,
        archivedProjects,
        selectedProjectId,
        setSelectedProjectId,
        canCreateProjects,
        setCreateProjectOpen,
    } = useProjectListContext()
    const { displayStyle, setDisplayStyle } = useProjectUIContext()

    const [search, setSearch] = useState("")
    const [involvedOpen, setInvolvedOpen] = useState(true)
    const [othersOpen, setOthersOpen] = useState(false)
    const [archivedOpen, setArchivedOpen] = useState(false)

    const filterProjects = (list: ProjectTeam[]) => {
        if (!search.trim()) return list
        const q = search.toLowerCase()
        return list.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.description ?? "").toLowerCase().includes(q)
        )
    }

    const filteredInvolved = filterProjects(projectsInvolved)
    const filteredOthers = filterProjects(projectsOthers)
    const filteredArchived = filterProjects(archivedProjects)

    const hasResults =
        filteredInvolved.length > 0 ||
        filteredOthers.length > 0 ||
        filteredArchived.length > 0

    const listMode = displayStyle === "list"

    return (
        <div className="flex flex-1 flex-col gap-6 p-3 sm:p-6">
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-3">
                {/* w-full sous sm : le titre prend sa propre ligne, sinon il ne reste
                    pas assez de place aux actions et le bouton sort de l'écran. */}
                <h1 className="w-full sm:w-auto text-lg font-semibold text-foreground">Projets</h1>

                <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                    {/* Search */}
                    <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher un projet..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 w-full text-xs"
                        />
                    </div>

                    <Separator orientation="vertical" className="h-6 shrink-0" />

                    {/* Grid / List toggle */}
                    <TabButtonGroup
                        containerRef={displayRef}
                        className="flex shrink-0 items-center gap-1 rounded-lg border bg-muted/50 p-1"
                    >
                        <TabButton
                            id="grid"
                            title="Vue grille"
                            icon={Grid}
                            active={listMode ? "list" : "grid"}
                            set={() => setDisplayStyle("grid")}
                        />
                        <TabButton
                            id="list"
                            title="Vue liste"
                            icon={LayoutList}
                            active={listMode ? "list" : "grid"}
                            set={() => setDisplayStyle("list")}
                        />
                    </TabButtonGroup>

                    {canCreateProjects && (
                        <CreateProject canCreateProjects={canCreateProjects} />
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            {!hasResults && (
                <EmptyState
                    className="flex-1"
                    variant={search ? "search" : "default"}
                    icon={search ? SearchX : FolderKanban}
                    title={search ? "Aucun résultat" : "Aucun projet"}
                    description={
                        search
                            ? "Aucun projet ne correspond à votre recherche."
                            : "Aucun projet disponible."
                    }
                    action={
                        !search && canCreateProjects
                            ? {
                                  label: "Créer mon premier projet",
                                  onClick: () => setCreateProjectOpen(true),
                                  icon: Plus,
                              }
                            : undefined
                    }
                />
            )}

            {filteredInvolved.length > 0 && (
                <Section
                    title="Mes projets"
                    count={filteredInvolved.length}
                    projects={filteredInvolved}
                    selectedId={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    listMode={listMode}
                    open={involvedOpen}
                    onToggle={() => setInvolvedOpen((v) => !v)}
                />
            )}

            {filteredOthers.length > 0 && (
                <>
                    {filteredInvolved.length > 0 && <Separator />}
                    <Section
                        title="Autres projets"
                        count={filteredOthers.length}
                        projects={filteredOthers}
                        selectedId={selectedProjectId}
                        onSelect={setSelectedProjectId}
                        listMode={listMode}
                        muted
                        open={othersOpen}
                        onToggle={() => setOthersOpen((v) => !v)}
                    />
                </>
            )}

            {filteredArchived.length > 0 && (
                <>
                    {(filteredInvolved.length > 0 || filteredOthers.length > 0) && <Separator />}
                    <Section
                        title="Archivés"
                        count={filteredArchived.length}
                        projects={filteredArchived}
                        selectedId={selectedProjectId}
                        onSelect={setSelectedProjectId}
                        listMode={listMode}
                        muted
                        open={archivedOpen}
                        onToggle={() => setArchivedOpen((v) => !v)}
                    />
                </>
            )}
        </div>
    )
}

/* ─── Section ──────────────────────────────────────────────────────────────── */

function Section({
    title,
    count,
    projects,
    selectedId,
    onSelect,
    listMode,
    muted,
    open,
    onToggle,
}: {
    title: string
    count: number
    projects: ProjectTeam[]
    selectedId: string | null
    onSelect: (id: string) => void
    listMode: boolean
    muted?: boolean
    open: boolean
    onToggle: () => void
}) {
    return (
        <Collapsible open={open} onOpenChange={onToggle} className="space-y-3">
            <CollapsibleTrigger className="flex w-full items-center gap-2 group">
                <span
                    className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        muted ? "text-muted-foreground/60" : "text-muted-foreground"
                    )}
                >
                    {title}
                </span>
                <span className={cn(
                    "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    muted ? "bg-muted/60 text-muted-foreground/50" : "bg-muted text-muted-foreground"
                )}>
                    {count}
                </span>
                <ChevronDown
                    className={cn(
                        "ml-auto h-3.5 w-3.5 transition-transform duration-base",
                        muted ? "text-muted-foreground/40" : "text-muted-foreground/60",
                        open && "rotate-180"
                    )}
                />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-[collapsible-up_0.15s_ease-out] data-[state=open]:animate-[collapsible-down_0.15s_ease-out]">
                <div
                    className={
                        listMode
                            ? "flex flex-col gap-2"
                            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }
                >
                    {projects.map((p) => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            selected={selectedId === p.id}
                            onClick={() => onSelect(p.id)}
                            listMode={listMode}
                        />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}



