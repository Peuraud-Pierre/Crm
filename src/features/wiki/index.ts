// API publique de la feature wiki (guide Architecture §11).
// Ne PAS ré-exporter les composants internes.

export type {
    WikiArticle,
    WikiArticleStatus,
} from "./types/wiki-article.types"
export type { WikiCategory } from "./types/wiki-category.types"
export { default as Wiki } from "./routes/Wiki"
