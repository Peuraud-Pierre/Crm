import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { useWikiContext } from "../hooks/context/useWikiContext"
import { ArticleEditor } from "./article/ArticleEditor"

/**
 * Éditeur d'article présenté dans un panneau latéral (Sheet partagé).
 * Rendu une seule fois au niveau de la page et piloté par le contexte, il
 * couvre l'édition depuis la consultation comme depuis le panneau de gestion.
 */
export function ArticleEditorSheet() {
    const {
        canManage,
        editorOpen,
        editingArticle,
        categories,
        savingArticle,
        saveArticle,
        closeEditor,
    } = useWikiContext()

    if (!canManage) return null

    return (
        <Sheet
            open={editorOpen}
            onOpenChange={(open) => {
                if (!open) closeEditor()
            }}
        >
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
            >
                <SheetHeader className="shrink-0 space-y-1 border-b px-6 py-4 text-left">
                    <SheetTitle>
                        {editingArticle
                            ? "Modifier l'article"
                            : "Nouvel article"}
                    </SheetTitle>
                    <SheetDescription>
                        Construisez la page par sections de texte et d'images.
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <ArticleEditor
                        key={editingArticle?.id ?? "new"}
                        article={editingArticle}
                        categories={categories}
                        saving={savingArticle}
                        onSave={saveArticle}
                        onCancel={closeEditor}
                    />
                </div>
            </SheetContent>
        </Sheet>
    )
}
