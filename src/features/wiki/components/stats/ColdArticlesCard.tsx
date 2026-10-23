import { Sparkles } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { WikiColdArticle } from "../../types/wiki-analytics.types"

interface ColdArticlesCardProps {
    articles: WikiColdArticle[]
    categoryPath: (categoryId: string | null) => string
    onSelect: (articleId: string) => void
}

/**
 * Articles publiés que personne n'a ouverts sur la période. C'est le pendant
 * actionnable du classement : ce qui est à re-promouvoir, fusionner ou
 * archiver.
 *
 * La liste vient de sa propre RPC : la déduire du top (plafonné à 10) ferait
 * passer pour « jamais lu » tout article classé au-delà du plafond.
 */
export function ColdArticlesCard({
    articles,
    categoryPath,
    onSelect,
}: ColdArticlesCardProps) {
    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">
                    Jamais consultés
                </CardTitle>
                {articles.length > 0 && (
                    <Badge variant="outline" className="tabular-nums">
                        {articles.length}
                    </Badge>
                )}
            </CardHeader>
            <CardContent>
                {articles.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Sparkles}
                        title="Tout le wiki a servi"
                        description="Chaque article publié a été ouvert au moins une fois."
                    />
                ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                        {articles.map((a) => (
                            <li key={a.article_id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(a.article_id)}
                                    className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                                >
                                    <p className="truncate text-sm font-medium">
                                        {a.title}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {categoryPath(a.category_id)}
                                    </p>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
