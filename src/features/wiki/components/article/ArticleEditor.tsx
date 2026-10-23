import { useRef, useState } from "react"
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
    ArrowDown,
    ArrowUp,
    Check,
    GripVertical,
    Image as ImageIcon,
    Trash2,
    Type,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"
import { toast } from "sonner"
import { WIKI_ARTICLE_STATUS, WIKI_STATUS_LABEL } from "../../constants"
import type {
    WikiArticle,
    WikiArticleFormInput,
    WikiArticleStatus,
    WikiSection,
} from "../../types/wiki-article.types"
import type { WikiCategory } from "../../types/wiki-category.types"
import {
    buildCategoryTree,
    flattenTreeWithDepth,
} from "../../utils/wikiTree"
import { wikiService } from "../../services/wikiService"
import { safeRandomUUID } from "@/shared/lib/uuid"
import { cn } from "@/shared/lib/utils"
import { ArticleSections } from "../shared/ArticleSections"

interface ArticleEditorProps {
    article: WikiArticle | null
    categories: WikiCategory[]
    saving: boolean
    onSave: (input: WikiArticleFormInput) => void
    onCancel: () => void
}

const NO_CATEGORY = "__none__"

const newTextSection = (): WikiSection => ({
    id: safeRandomUUID(),
    type: "text",
    title: "",
    content: "",
})

export function ArticleEditor({
    article,
    categories,
    saving,
    onSave,
    onCancel,
}: ArticleEditorProps) {
    const [title, setTitle] = useState(article?.title ?? "")
    const [categoryId, setCategoryId] = useState<string>(
        article?.category_id ?? NO_CATEGORY
    )
    const [status, setStatus] = useState<WikiArticleStatus>(
        article?.status ?? "draft"
    )
    const [sections, setSections] = useState<WikiSection[]>(() =>
        article?.sections.length ? article.sections : [newTextSection()]
    )
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Réordonnancement par glisser-déposer. Le TouchSensor avec délai évite de
    // déclencher un drag pendant le défilement du panneau sur mobile ; le
    // KeyboardSensor rend la poignée pilotable au clavier.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 200, tolerance: 6 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        setSections((prev) => {
            const oldIndex = prev.findIndex((s) => s.id === active.id)
            const newIndex = prev.findIndex((s) => s.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }

    const flatCategories = flattenTreeWithDepth(buildCategoryTree(categories))
    const canSave = title.trim().length > 0 && !saving

    const updateSection = (id: string, patch: Partial<WikiSection>) =>
        setSections((prev) =>
            prev.map((s) =>
                s.id === id ? ({ ...s, ...patch } as WikiSection) : s
            )
        )

    const removeSection = (id: string) =>
        setSections((prev) => prev.filter((s) => s.id !== id))

    const moveSection = (index: number, dir: -1 | 1) =>
        setSections((prev) => {
            const next = [...prev]
            const target = index + dir
            if (target < 0 || target >= next.length) return prev
            ;[next[index], next[target]] = [next[target], next[index]]
            return next
        })

    const handleAddImage = async (file: File) => {
        try {
            setUploading(true)
            const url = await wikiService.uploadImage(file)
            setSections((prev) => [
                ...prev,
                { id: safeRandomUUID(), type: "image", url, caption: "" },
            ])
        } catch (err) {
            toast.error(
                err instanceof Error
                    ? err.message
                    : "Échec du téléversement de l'image"
            )
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleSave = () => {
        if (!canSave) return
        onSave({
            title: title.trim(),
            category_id: categoryId === NO_CATEGORY ? null : categoryId,
            status,
            sections,
        })
    }

    const previewArticle: WikiArticle = {
        id: "preview",
        category_id: null,
        title: title.trim() || "Sans titre",
        slug: null,
        body: "",
        sections,
        status,
        position: 0,
        created_by: null,
        created_at: "",
        updated_at: "",
    }

    return (
        <div className="space-y-5">
            {/* Métadonnées */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label htmlFor="wiki-title">Titre *</Label>
                    <Input
                        id="wiki-title"
                        placeholder="Titre de l'article"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Catégorie</Label>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Sans catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_CATEGORY}>
                                Sans catégorie
                            </SelectItem>
                            {flatCategories.map(({ category, depth }) => (
                                <SelectItem
                                    key={category.id}
                                    value={category.id}
                                >
                                    <span
                                        style={{ paddingLeft: depth * 14 }}
                                        className={
                                            depth > 0
                                                ? "text-muted-foreground"
                                                : "font-medium"
                                        }
                                    >
                                        {depth > 0 ? "› " : ""}
                                        {category.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-1.5 max-w-xs">
                <Label>Statut</Label>
                <Select
                    value={status}
                    onValueChange={(v) => setStatus(v as WikiArticleStatus)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {WIKI_ARTICLE_STATUS.map((s) => (
                            <SelectItem key={s} value={s}>
                                {WIKI_STATUS_LABEL[s]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Constructeur de page */}
            <Tabs defaultValue="content">
                <TabsList indicator indicatorClassName="rounded-sm" className="grid w-full max-w-xs grid-cols-2">
                    <TabsTrigger value="content">Sections</TabsTrigger>
                    <TabsTrigger value="preview">Aperçu</TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="mt-3 space-y-3">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={sections.map((s) => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-3">
                                {sections.map((section, index) => (
                                    <SectionCard
                                        key={section.id}
                                        section={section}
                                        index={index}
                                        total={sections.length}
                                        onChange={(patch) =>
                                            updateSection(section.id, patch)
                                        }
                                        onMove={(dir) =>
                                            moveSection(index, dir)
                                        }
                                        onRemove={() =>
                                            removeSection(section.id)
                                        }
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    {sections.length === 0 && (
                        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                            Ajoutez une première section.
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                                setSections((p) => [...p, newTextSection()])
                            }
                        >
                            <Type className="h-4 w-4" />
                            Ajouter une section
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            loading={uploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {!uploading && <ImageIcon className="h-4 w-4" />}
                            Ajouter une image
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleAddImage(file)
                            }}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-3">
                    <div className="rounded-lg border p-4 md:p-6">
                        <h1 className="text-2xl font-bold tracking-tight mb-4">
                            {previewArticle.title}
                        </h1>
                        <ArticleSections article={previewArticle} />
                    </div>
                </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="ghost" onClick={onCancel} disabled={saving}>
                    Annuler
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!canSave}
                    loading={saving}
                    className="gap-2"
                >
                    {!saving && <Check className="h-4 w-4" />}
                    Enregistrer
                </Button>
            </div>
        </div>
    )
}

interface SectionCardProps {
    section: WikiSection
    index: number
    total: number
    onChange: (patch: Partial<WikiSection>) => void
    onMove: (dir: -1 | 1) => void
    onRemove: () => void
}

function SectionCard({
    section,
    index,
    total,
    onChange,
    onMove,
    onRemove,
}: SectionCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: section.id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                "rounded-lg border bg-background",
                isDragging && "relative z-10 shadow-lg"
            )}
        >
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                <button
                    type="button"
                    aria-label="Réordonner la section (glisser, ou flèches au clavier)"
                    className="shrink-0 cursor-grab touch-none rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {section.type === "image" ? (
                        <>
                            <ImageIcon className="h-3.5 w-3.5" /> Image
                        </>
                    ) : (
                        <>
                            <Type className="h-3.5 w-3.5" /> Section
                        </>
                    )}
                </span>
                <div className="ml-auto flex items-center gap-0.5">
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={index === 0}
                        onClick={() => onMove(-1)}
                        title="Monter"
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={index === total - 1}
                        onClick={() => onMove(1)}
                        title="Descendre"
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={onRemove}
                        title="Supprimer la section"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="p-3 space-y-2">
                {section.type === "text" ? (
                    <>
                        <Input
                            placeholder="Titre de la section (optionnel)"
                            value={section.title ?? ""}
                            onChange={(e) =>
                                onChange({ title: e.target.value })
                            }
                            className="font-medium"
                        />
                        <Textarea
                            placeholder="Contenu en markdown…"
                            value={section.content}
                            onChange={(e) =>
                                onChange({ content: e.target.value })
                            }
                            className="min-h-[160px] font-mono text-sm"
                        />
                    </>
                ) : (
                    <>
                        {section.url && (
                            <img
                                src={section.url}
                                alt={section.alt || section.caption || ""}
                                className="max-h-64 w-auto rounded-lg border bg-muted/30"
                            />
                        )}
                        <Input
                            placeholder="Légende (optionnel)"
                            value={section.caption ?? ""}
                            onChange={(e) =>
                                onChange({ caption: e.target.value })
                            }
                        />
                    </>
                )}
            </div>
        </div>
    )
}
