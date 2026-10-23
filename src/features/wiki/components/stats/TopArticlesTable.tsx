import { BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import type { WikiTopArticle } from "../../types/wiki-analytics.types"

interface TopArticlesTableProps {
    articles: WikiTopArticle[]
    /** Chemin lisible de la catégorie (« Stock › Arrivage »). */
    categoryPath: (categoryId: string | null) => string
    onSelect: (articleId: string) => void
}

/**
 * Classement des articles consultés. Au-delà du volume, les colonnes « temps »
 * et « terminée » distinguent l'article vraiment utile de celui qu'on ouvre
 * par erreur.
 */
export function TopArticlesTable({
    articles,
    categoryPath,
    onSelect,
}: TopArticlesTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Articles les plus consultés
                </CardTitle>
            </CardHeader>
            <CardContent>
                {articles.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={BarChart3}
                        title="Aucune consultation"
                        description="Aucun article n'a été ouvert sur cette période."
                    />
                ) : (
                    // Le tableau défile seul : la page ne part jamais en
                    // défilement horizontal.
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-xs text-muted-foreground">
                                    <th className="pb-2 pr-3 font-medium">
                                        Article
                                    </th>
                                    <th className="pb-2 pr-3 text-right font-medium tabular-nums">
                                        Vues
                                    </th>
                                    <th className="pb-2 pr-3 text-right font-medium tabular-nums">
                                        Lecteurs
                                    </th>
                                    <th className="pb-2 pr-3 text-right font-medium tabular-nums">
                                        Temps moyen
                                    </th>
                                    <th className="pb-2 text-right font-medium tabular-nums">
                                        Terminée
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {articles.map((a) => (
                                    <tr
                                        key={a.article_id}
                                        tabIndex={0}
                                        role="button"
                                        onClick={() => onSelect(a.article_id)}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                e.preventDefault()
                                                onSelect(a.article_id)
                                            }
                                        }}
                                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                    >
                                        <td className="max-w-xs py-2 pr-3">
                                            <p className="truncate font-medium">
                                                {a.title}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {categoryPath(a.category_id)}
                                            </p>
                                        </td>
                                        <td className="py-2 pr-3 text-right tabular-nums">
                                            {a.views}
                                        </td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                                            {a.unique_readers}
                                        </td>
                                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                                            {Math.round(a.avg_dwell_seconds)} s
                                        </td>
                                        <td
                                            className={cn(
                                                "py-2 text-right tabular-nums",
                                                a.completion_rate >= 50
                                                    ? "text-success"
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {a.completion_rate} %
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
