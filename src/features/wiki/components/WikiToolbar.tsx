import { useRef, useState } from "react"
import { BookOpen, Menu, Plus, Search, Settings2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/shared/ui/atoms/sheet"
import { useWikiContext } from "../hooks/context/useWikiContext"
import type { WikiMode } from "../hooks/context/WikiContext"
import { CategoryTree } from "./category/CategoryTree"
import { WikiBreadcrumb } from "./shared/WikiBreadcrumb"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"

const SEGMENTS: { value: WikiMode; label: string; icon: typeof BookOpen }[] = [
    { value: "read", label: "Consultation", icon: BookOpen },
    { value: "manage", label: "Gestion", icon: Settings2 },
]

/** Interrupteur segmenté Consultation / Gestion (managers). */
function ModeSwitch() {
    const { mode, setMode } = useWikiContext()
    // Conteneur de la bascule : offsetParent de la pastille glissante.
    const modeRef = useRef<HTMLDivElement | null>(null)

    return (
        <TabButtonGroup
            containerRef={modeRef}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border bg-muted/60 p-0.5"
        >
            {SEGMENTS.map(({ value, label, icon }) => (
                <TabButton
                    key={value}
                    id={value}
                    label={label}
                    title={label}
                    icon={icon}
                    active={mode}
                    set={(v) => setMode(v as typeof mode)}
                />
            ))}
        </TabButtonGroup>
    )
}

/**
 * Barre d'outils unique du wiki (sous le header global du shell).
 * Regroupe navigation mobile, fil d'Ariane, recherche, création et le bascule
 * Consultation / Gestion — évite l'empilement de plusieurs barres.
 */
export function WikiToolbar() {
    const {
        canManage,
        mode,
        selectedArticle,
        editorOpen,
        searchQuery,
        setSearchQuery,
        openCreateArticle,
    } = useWikiContext()
    const [navOpen, setNavOpen] = useState(false)

    const isRead = mode === "read"
    const editing = canManage && editorOpen
    // Le fil d'Ariane reste en barre d'outils, même article ouvert (pas de saut).
    const showBreadcrumb = isRead && !editing
    // Recherche + création : seulement en mode liste (pas pendant la lecture).
    const showListChrome = isRead && !selectedArticle && !editing

    return (
        <div className="flex shrink-0 items-center gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
            {/* Tiroir Catégories (mobile, lecture) */}
            {isRead && (
                <Sheet open={navOpen} onOpenChange={setNavOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-label="Catégories"
                            className="h-9 shrink-0 gap-2 md:hidden"
                        >
                            <Menu className="h-4 w-4" />
                            <span className="hidden sm:inline">Catégories</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="flex w-11/12 max-w-sm flex-col p-0"
                        aria-describedby={undefined}
                    >
                        <SheetHeader className="shrink-0 px-4 pt-4 pb-0 pr-12 text-left">
                            <SheetTitle>Catégories</SheetTitle>
                        </SheetHeader>
                        {/* min-h-0 : sans lui, flex-1 ne borne pas la hauteur et l'arbre
                            déborde du tiroir au lieu de scroller. */}
                        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                            <CategoryTree onNavigate={() => setNavOpen(false)} />
                        </div>
                    </SheetContent>
                </Sheet>
            )}

            {/* Contexte gauche : fil d'Ariane (lecture) ou libellé gestion */}
            {showBreadcrumb && (
                <div className="hidden min-w-0 flex-1 md:block">
                    <WikiBreadcrumb />
                </div>
            )}
            {!isRead && (
                <span className="hidden text-sm font-medium text-muted-foreground md:block">
                    Gestion du wiki
                </span>
            )}

            {/* Actions à droite */}
            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                {showListChrome && (
                    <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Rechercher…"
                            aria-label="Rechercher un article"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 rounded-full pl-9"
                        />
                    </div>
                )}

                {canManage && showListChrome && (
                    <Button
                        onClick={openCreateArticle}
                        size="sm"
                        aria-label="Nouvel article"
                        className="h-9 shrink-0 gap-2 rounded-full"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">Nouvel article</span>
                    </Button>
                )}

                {canManage && <ModeSwitch />}
            </div>
        </div>
    )
}
