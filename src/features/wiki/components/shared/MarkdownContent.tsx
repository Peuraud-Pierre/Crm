import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/shared/lib/utils"
import { WIKI_THEME } from "../../theme"

interface MarkdownContentProps {
    content: string
    className?: string
}

/**
 * Rendu d'un contenu markdown (support GFM : tables, listes, etc.).
 * Le styling vient de WIKI_THEME.markdown (pas de @tailwindcss/typography
 * dans le projet).
 *
 * Mémoïsé : le parsing markdown est coûteux et l'article se re-render à chaque
 * mise à jour du scroll-spy (sommaire). Sans `memo`, chaque section serait
 * re-parsée à chaque défilement.
 */
export const MarkdownContent = memo(function MarkdownContent({
    content,
    className,
}: MarkdownContentProps) {
    return (
        <div className={cn(WIKI_THEME.markdown, className)}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
    )
})
