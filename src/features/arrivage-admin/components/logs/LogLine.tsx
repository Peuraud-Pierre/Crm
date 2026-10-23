import { memo } from "react"
import { Check, Copy } from "lucide-react"
import { motion } from "framer-motion"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { formatDateTime } from "@/features/arrivage-admin/utils/format"
import type { ApiLogLine } from "@/features/arrivage-admin/types"

type BadgeVariant = "secondary" | "outline" | "warning" | "destructive"

const LEVEL_VARIANTS: Record<string, BadgeVariant> = {
    DEBUG: "outline",
    INFO: "secondary",
    WARN: "warning",
    ERROR: "destructive",
}

function levelVariant(level: string): BadgeVariant {
    return LEVEL_VARIANTS[level.toUpperCase()] ?? "secondary"
}

/** Représentation texte d'une ligne, pour le presse-papier. */
function toPlainText(line: ApiLogLine): string {
    const parts = [formatDateTime(line.ts), line.level, line.msg]
    if (line.method && line.path) parts.push(`${line.method} ${line.path}`)
    if (line.status !== null) parts.push(`status=${line.status}`)
    if (line.duration_ms !== null) parts.push(`duration_ms=${line.duration_ms}`)
    if (line.req_id) parts.push(`req_id=${line.req_id}`)
    if (line.attrs) parts.push(JSON.stringify(line.attrs))
    return parts.join(" · ")
}

interface LogLineProps {
    line: ApiLogLine
    /** Position dans la page — pilote le décalage de l'animation d'entrée. */
    index: number
    copied: boolean
    /**
     * Reçu du parent — vestige du contournement de `useReducedMotion()` de
     * framer-motion, qui s'abonnait à un media query PAR APPEL (jusqu'à 100
     * abonnements par page ici). La cause est désormais traitée à la source
     * par `usePrefersReducedMotion()` (un seul listener pour tout l'arbre),
     * mais passer la valeur en prop reste préférable sur une liste de cette
     * taille : un hook de moins à exécuter par ligne. Voir DESIGN_SYSTEM.md §13.5.
     */
    reducedMotion: boolean
    onCopy: (id: string, text: string) => void
    /** Filtre la console sur toutes les lignes de la même requête. */
    onFilterReqId: (reqId: string) => void
}

/**
 * Une ligne de log. Même composant en desktop et en mobile : c'est une liste
 * verticale dans les deux cas, seuls la densité et le retour à la ligne des
 * métadonnées changent.
 *
 * Mémoïsé : sans ça, copier une ligne re-rendrait les 99 autres.
 */
function LogLineComponent({
    line,
    index,
    copied,
    reducedMotion,
    onCopy,
    onFilterReqId,
}: LogLineProps) {
    const meta: string[] = []
    if (line.method && line.path) meta.push(`${line.method} ${line.path}`)
    else if (line.path) meta.push(line.path)
    if (line.status !== null) meta.push(`HTTP ${line.status}`)
    if (line.duration_ms !== null) meta.push(`${line.duration_ms} ms`)

    // `attrs` porte tout ce qui n'a pas été promu en colonne (email, count,
    // err…). Affiché tel quel : c'est du diagnostic, pas de la présentation.
    const attrEntries = line.attrs ? Object.entries(line.attrs) : []

    return (
        <motion.li
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            // Le décalage est plafonné : au-delà d'une dizaine de lignes, une
            // cascade complète sur 100 entrées donnerait une page molle.
            transition={{ duration: 0.2, delay: Math.min(index, 10) * 0.02 }}
            className="group space-y-1.5 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={levelVariant(line.level)} className="shrink-0">
                    {line.level}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                    {formatDateTime(line.ts)}
                </span>
                <span className="w-full break-words text-sm sm:w-auto sm:flex-1">
                    {line.msg}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => onCopy(String(line.id), toPlainText(line))}
                    title="Copier la ligne"
                    aria-label="Copier la ligne de log"
                >
                    {copied ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                        <Copy className="h-3.5 w-3.5" />
                    )}
                </Button>
            </div>

            {(meta.length > 0 || line.req_id) && (
                <p className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-muted-foreground">
                    {meta.length > 0 && <span>{meta.join(" · ")}</span>}
                    {line.req_id && (
                        <button
                            type="button"
                            onClick={() => onFilterReqId(line.req_id as string)}
                            title="Voir toutes les lignes de cette requête"
                            className="rounded-sm underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground"
                        >
                            req {line.req_id}
                        </button>
                    )}
                </p>
            )}

            {attrEntries.length > 0 && (
                <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
                    {attrEntries.map(([key, value]) => (
                        <div key={key} className="flex min-w-0 gap-1">
                            <dt className="shrink-0">{key}</dt>
                            <dd className="min-w-0 break-all text-foreground/80">
                                {typeof value === "object"
                                    ? JSON.stringify(value)
                                    : String(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </motion.li>
    )
}

export const LogLine = memo(LogLineComponent)
