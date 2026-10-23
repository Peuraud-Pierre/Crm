import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/shared/ui/atoms/alert-dialog"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useChangelogContext } from "../../hooks/context/ChangelogProvider"
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash, X } from "lucide-react"
import { useState } from "react"
import type { ChangelogCategory } from "../../types/changelog.types"

interface CategoryFormState {
    name: string
    color: string
    icon: string
}

// eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
const EMPTY_FORM: CategoryFormState = { name: "", color: "#6366f1", icon: "" }

export function ChangelogCategoryManager() {
    const {
        categories,
        createCategory,
        editCategory,
        removeCategory,
        reorderCategories,
    } = useChangelogContext()

    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM)

    const sorted = [...categories].sort((a, b) => a.position - b.position)

    const handleAdd = async () => {
        if (!form.name.trim()) return
        await createCategory({
            name: form.name.trim(),
            color: form.color,
            icon: form.icon || undefined,
            position: categories.length,
        })
        setForm(EMPTY_FORM)
        setIsAdding(false)
    }

    const handleEdit = async () => {
        if (!editingId || !form.name.trim()) return
        const cat = categories.find((c) => c.id === editingId)
        if (!cat) return
        await editCategory(editingId, {
            name: form.name.trim(),
            color: form.color,
            icon: form.icon || undefined,
            position: cat.position,
        })
        setEditingId(null)
        setForm(EMPTY_FORM)
    }

    const startEdit = (cat: ChangelogCategory) => {
        setEditingId(cat.id)
        setForm({ name: cat.name, color: cat.color, icon: cat.icon || "" })
        setIsAdding(false)
    }

    const handleDelete = async (categoryId: string) => {
        await removeCategory(categoryId)
    }

    const handleMove = async (index: number, direction: "up" | "down") => {
        const ids = sorted.map((c) => c.id)
        const swapIndex = direction === "up" ? index - 1 : index + 1
        if (swapIndex < 0 || swapIndex >= ids.length) return
        ;[ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]]
        await reorderCategories(ids)
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Catégories</h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setIsAdding(true)
                        setEditingId(null)
                        setForm(EMPTY_FORM)
                    }}
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Nouvelle catégorie
                </Button>
            </div>

            <div className="space-y-2">
                {sorted.map((cat, index) => (
                    <div
                        key={cat.id}
                        className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                    >
                        <div
                            className="w-4 h-4 rounded-full shrink-0 border"
                            style={{ backgroundColor: cat.color }}
                        />
                        <span className="flex-1 font-medium text-sm">
                            {cat.name}
                        </span>

                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={index === 0}
                                onClick={() => handleMove(index, "up")}
                                aria-label={`Monter ${cat.name}`}
                            >
                                <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={index === sorted.length - 1}
                                onClick={() => handleMove(index, "down")}
                                aria-label={`Descendre ${cat.name}`}
                            >
                                <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startEdit(cat)}
                                aria-label={`Modifier ${cat.name}`}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        aria-label={`Supprimer ${cat.name}`}
                                    >
                                        <Trash className="w-3.5 h-3.5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Supprimer « {cat.name} » ?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Cette catégorie sera définitivement
                                            supprimée.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Annuler
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => handleDelete(cat.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Supprimer
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                ))}
            </div>

            {/* Dialog ajout/édition */}
            <Dialog
                open={isAdding || editingId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setIsAdding(false)
                        setEditingId(null)
                        setForm(EMPTY_FORM)
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId
                                ? "Modifier la catégorie"
                                : "Nouvelle catégorie"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <div>
                            <Label htmlFor="cat-name">Nom</Label>
                            <Input
                                id="cat-name"
                                value={form.name}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        name: e.target.value,
                                    }))
                                }
                                placeholder="Ex: Améliorations"
                                className="mt-1"
                                autoFocus
                            />
                        </div>

                        <div>
                            <Label htmlFor="cat-color">Couleur</Label>
                            <div className="flex items-center gap-3 mt-1">
                                <input
                                    type="color"
                                    aria-label="Sélecteur de couleur"
                                    value={form.color}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            color: e.target.value,
                                        }))
                                    }
                                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                                />
                                <Input
                                    id="cat-color"
                                    value={form.color}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            color: e.target.value,
                                        }))
                                    }
                                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
                                    placeholder="#6366f1"
                                    className="flex-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="cat-icon">
                                Icône Lucide (optionnel)
                            </Label>
                            <Input
                                id="cat-icon"
                                value={form.icon}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        icon: e.target.value,
                                    }))
                                }
                                placeholder="Ex: star, zap, shield"
                                className="mt-1"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsAdding(false)
                                    setEditingId(null)
                                    setForm(EMPTY_FORM)
                                }}
                            >
                                <X className="w-4 h-4 mr-1" />
                                Annuler
                            </Button>
                            <Button
                                onClick={editingId ? handleEdit : handleAdd}
                            >
                                <Save className="w-4 h-4 mr-1" />
                                {editingId ? "Mettre à jour" : "Créer"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
