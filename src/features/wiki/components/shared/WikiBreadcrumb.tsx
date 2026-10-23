import { Home } from "lucide-react"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/shared/ui/atoms/breadcrumb"
import { useWikiContext } from "../../hooks/context/useWikiContext"
import { getCategoryPath } from "../../utils/wikiTree"

/**
 * Fil d'Ariane racine → catégorie → (article courant).
 *
 * Quand un article est ouvert, le chemin reflète SA catégorie et son titre,
 * de sorte que le fil reste ancré dans la barre d'outils (aucun saut vers
 * l'en-tête de l'article).
 * @param leaf override manuel du libellé de fin (sinon déduit du contexte).
 */
export function WikiBreadcrumb({ leaf }: { leaf?: string }) {
    const {
        breadcrumb,
        categories,
        selectedArticle,
        setSelectedCategoryId,
        setSelectedArticle,
    } = useWikiContext()

    const path = selectedArticle
        ? getCategoryPath(categories, selectedArticle.category_id)
        : breadcrumb
    const leafLabel = leaf ?? selectedArticle?.title

    const goRoot = () => {
        setSelectedCategoryId(null)
        setSelectedArticle(null)
    }
    const goCategory = (id: string) => {
        setSelectedCategoryId(id)
        setSelectedArticle(null)
    }

    return (
        <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem>
                    <button
                        type="button"
                        onClick={goRoot}
                        className="flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                        <Home className="h-3.5 w-3.5" />
                        Wiki
                    </button>
                </BreadcrumbItem>

                {path.map((category, i) => {
                    const isLast = i === path.length - 1 && !leafLabel
                    // Tableau (séparateur + item) plutôt qu'un Fragment : le
                    // plugin de dev injecte `data-source` sur tout élément JSX,
                    // ce que React.Fragment refuse.
                    return [
                        <BreadcrumbSeparator key={`sep-${category.id}`} />,
                        <BreadcrumbItem key={category.id}>
                            {isLast ? (
                                <BreadcrumbPage className="font-medium">
                                    {category.name}
                                </BreadcrumbPage>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => goCategory(category.id)}
                                    className="transition-colors hover:text-foreground"
                                >
                                    {category.name}
                                </button>
                            )}
                        </BreadcrumbItem>,
                    ]
                })}

                {leafLabel && [
                    <BreadcrumbSeparator key="sep-leaf" />,
                    <BreadcrumbItem key="leaf" className="min-w-0">
                        <BreadcrumbPage className="max-w-[40ch] truncate font-medium">
                            {leafLabel}
                        </BreadcrumbPage>
                    </BreadcrumbItem>,
                ]}
            </BreadcrumbList>
        </Breadcrumb>
    )
}
