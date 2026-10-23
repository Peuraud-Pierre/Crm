import WikiProvider from "../hooks/context/WikiProvider"
import { useWikiContext } from "../hooks/context/useWikiContext"
import { WikiToolbar } from "../components/WikiToolbar"
import { WikiManagePanel } from "../components/WikiManagePanel"
import { ArticleEditorSheet } from "../components/ArticleEditorSheet"
import { CategoryTree } from "../components/category/CategoryTree"
import { ArticleList } from "../components/article/ArticleList"
import { ArticleView } from "../components/article/ArticleView"

/**
 * Corps du wiki : lecture (arbre + contenu) ou gestion (panneau pleine largeur),
 * selon le mode courant. L'édition d'article se fait dans un panneau latéral
 * (voir ArticleEditorSheet), sans masquer l'arbre de navigation.
 */
function WikiBody() {
    const { mode, canManage, selectedArticle } = useWikiContext()

    if (mode === "manage" && canManage) {
        return (
            <div className="min-h-0 flex-1 overflow-y-auto">
                <WikiManagePanel />
            </div>
        )
    }

    return (
        <div className="flex min-h-0 flex-1">
            {/* Arbre persistant (desktop) — défile indépendamment du contenu */}
            <aside className="hidden w-72 shrink-0 overflow-y-auto border-r md:block">
                <CategoryTree />
            </aside>

            {/* La zone de contenu ne porte plus l'overflow : chaque vue gère son
                propre défilement (l'article fige son arbre + son sommaire). */}
            <div className="flex min-h-0 min-w-0 flex-1">
                {selectedArticle ? (
                    <ArticleView />
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <ArticleList />
                    </div>
                )}
            </div>
        </div>
    )
}

/** Route /wiki — consultation + gestion unifiées (permission wiki.view). */
export default function Wiki() {
    return (
        <WikiProvider>
            <div className="flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden">
                <WikiToolbar />
                <WikiBody />
            </div>
            <ArticleEditorSheet />
        </WikiProvider>
    )
}
