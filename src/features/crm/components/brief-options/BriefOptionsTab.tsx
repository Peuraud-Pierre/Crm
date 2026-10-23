import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
    Check,
    CheckCheck,
    ChevronDown,
    MoreVertical,
    Pencil,
    Plus,
    Trash2,
    X,
    XCircle,
} from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useBriefOptionsAdmin } from "@/features/crm/hooks/CRM_hook/use_brief_options_admin"
import { BRIEF_CATEGORIES, type BriefCategorie } from "@/features/crm/types"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardHeader } from "@/shared/ui/atoms/card"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/atoms/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { Input } from "@/shared/ui/atoms/input"
import { Switch } from "@/shared/ui/atoms/switch"
import { BriefOptionFormDialog } from "./BriefOptionFormDialog"
import { CATEGORIE_LABELS } from "./categorieLabels"

// Code de permission d'écriture sur les listes du brief — inline, comme les
// autres codes de permission de SinglePageCRM.tsx (ex: "crm.tournee"), pas
// de registre central ADMIN_PERMISSIONS-like dans cette feature à ce jour.
const CRM_BRIEF_OPTIONS_MANAGE = "crm.brief_options.manage"

// Au-delà de ce nombre de valeurs, la liste passe en scroll interne — évite
// qu'une catégorie longue (produits, marques...) n'allonge démesurément la
// carte.
const OPTIONS_SCROLL_THRESHOLD = 5

/**
 * Administration des listes de valeurs dynamiques du brief CRM
 * (colonneBrief.tsx) : plateformes, provenances, localisations, produits,
 * marques, styles, matières — une section par catégorie.
 *
 * Renommer une valeur (cf. use_brief_options_admin.tsx) ne met à jour que
 * le référentiel : un brief déjà enregistré garde l'ancien libellé tant
 * qu'il n'est pas resauvegardé.
 */
export function BriefOptionsTab() {
    const { hasPermission } = useAuth()
    const canManage = hasPermission(CRM_BRIEF_OPTIONS_MANAGE)
    const {
        byCategorie,
        loading,
        create_BriefOption,
        toggle_BriefOptionActive,
        rename_BriefOption,
        delete_BriefOption,
    } = useBriefOptionsAdmin()

    return (
        <div className="space-y-4">
            {canManage && (
                <div className="flex justify-end">
                    <BriefOptionFormDialog onSubmit={create_BriefOption} />
                </div>
            )}
            {/* Grid (pas columns) : les cartes s'alignent en rangées propres
                plutôt qu'en masonry, qui remontait les cartes courtes dans
                les vides et cassait l'ordre de lecture gauche→droite. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {BRIEF_CATEGORIES.map((categorie, index) => (
                    <div
                        key={categorie}
                        style={{
                            animationDelay: `${Math.min(index * 60, 360)}ms`,
                        }}
                        className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
                    >
                        <CategorieCard
                            categorie={categorie}
                            options={byCategorie[categorie] ?? []}
                            loading={loading}
                            canManage={canManage}
                            onCreate={create_BriefOption}
                            onToggleActive={toggle_BriefOptionActive}
                            onRename={rename_BriefOption}
                            onDelete={delete_BriefOption}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

function CategorieCard({
    categorie,
    options,
    loading,
    canManage,
    onCreate,
    onToggleActive,
    onRename,
    onDelete,
}: {
    categorie: BriefCategorie
    options: { id: number; value: string; active: boolean }[]
    loading: boolean
    canManage: boolean
    onCreate: (categorie: BriefCategorie, value: string) => void
    onToggleActive: (id: number, active: boolean) => void
    onRename: (id: number, value: string) => void
    onDelete: (id: number) => void
}) {
    const [newValue, setNewValue] = useState("")
    const [open, setOpen] = useState(true)

    const handleAdd = () => {
        if (!newValue.trim()) return
        onCreate(categorie, newValue)
        setNewValue("")
    }

    const activateAll = () => {
        for (const o of options) if (!o.active) onToggleActive(o.id, true)
    }
    const deactivateAll = () => {
        for (const o of options) if (o.active) onToggleActive(o.id, false)
    }

    return (
        <Card>
            <Collapsible open={open} onOpenChange={setOpen}>
                <CardHeader className="py-3 flex-row items-center justify-between gap-2 space-y-0">
                    <CollapsibleTrigger className="flex flex-1 min-w-0 items-center justify-between text-base font-semibold group">
                        <span className="flex items-center gap-2">
                            {CATEGORIE_LABELS[categorie]}
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                {options.length}
                            </span>
                        </span>
                        <ChevronDown
                            className={cn(
                                "w-4 h-4 text-muted-foreground transition-transform mr-1",
                                open && "rotate-180"
                            )}
                        />
                    </CollapsibleTrigger>

                    {canManage && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    disabled={options.length === 0}
                                    onClick={activateAll}
                                >
                                    <CheckCheck className="w-4 h-4 mr-2 text-success" />
                                    Tout activer
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    disabled={options.length === 0}
                                    onClick={deactivateAll}
                                >
                                    <XCircle className="w-4 h-4 mr-2 text-muted-foreground" />
                                    Tout désactiver
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0">
                        <div
                            className={cn(
                                "flex flex-col gap-2",
                                options.length > OPTIONS_SCROLL_THRESHOLD &&
                                    "max-h-52 overflow-y-auto overflow-x-hidden pr-1"
                            )}
                        >
                            <AnimatePresence mode="popLayout" initial={false}>
                                {options.map((option) => (
                                    <OptionRow
                                        key={option.id}
                                        option={option}
                                        canManage={canManage}
                                        onToggleActive={onToggleActive}
                                        onRename={onRename}
                                        onDelete={onDelete}
                                    />
                                ))}
                            </AnimatePresence>
                            {!loading && options.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">
                                    Aucune valeur.
                                </p>
                            )}
                        </div>

                        {canManage && (
                            <div className="flex gap-2 pt-2">
                                <Input
                                    value={newValue}
                                    onChange={(e) =>
                                        setNewValue(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && handleAdd()
                                    }
                                    placeholder="Nouvelle valeur..."
                                    className="h-8 text-sm"
                                />
                                <Button
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                    disabled={!newValue.trim()}
                                    onClick={handleAdd}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    )
}

function OptionRow({
    option,
    canManage,
    onToggleActive,
    onRename,
    onDelete,
}: {
    option: { id: number; value: string; active: boolean }
    canManage: boolean
    onToggleActive: (id: number, active: boolean) => void
    onRename: (id: number, value: string) => void
    onDelete: (id: number) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(option.value)

    const startEdit = () => {
        setDraft(option.value)
        setEditing(true)
    }

    const commit = () => {
        if (draft.trim() && draft.trim() !== option.value) {
            onRename(option.id, draft)
        }
        setEditing(false)
    }

    return (
        <motion.div
            layout="position"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{
                opacity: 0,
                height: 0,
                marginBottom: 0,
                scale: 0.97,
                transition: { duration: 0.18 },
            }}
        >
            {editing ? (
                <div className="flex items-center gap-2 text-sm">
                    <Input
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commit()
                            if (e.key === "Escape") setEditing(false)
                        }}
                        className="h-8 text-sm"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={commit}
                    >
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setEditing(false)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-muted/50 transition-colors">
                    <span
                        className={
                            option.active
                                ? ""
                                : "text-muted-foreground line-through"
                        }
                    >
                        {option.value}
                    </span>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={option.active}
                            disabled={!canManage}
                            onCheckedChange={(active) =>
                                onToggleActive(option.id, active)
                            }
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canManage}
                            onClick={startEdit}
                        >
                            <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!canManage}
                            onClick={() => onDelete(option.id)}
                        >
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                    </div>
                </div>
            )}
        </motion.div>
    )
}
