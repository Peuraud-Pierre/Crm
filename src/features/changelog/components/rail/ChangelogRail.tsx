import { useMemo, useState } from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Sparkles } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import { useChangelog } from "../../hooks/data/useChangelog"
import { selectLatestPublished } from "../../utils/selectVersions"
import { ChangelogReader } from "../reader/ChangelogReader"

/** Au-delà, la ligne devient illisible et la version perd sa lisibilité. */
const PREVIEW_ITEMS = 3

/**
 * Ourlet des nouveautés, en pied de page.
 *
 * Il tient sur une ligne, et il n'en fait jamais plus : la version, sa
 * date, et de quoi savoir si ça vaut la peine de l'ouvrir.
 *
 * Il se dépliait auparavant sur la timeline complète, dans une boîte de
 * hauteur bornée — d'où quatre ascenseurs imbriqués et une lecture
 * impossible. « Tout voir » ouvre désormais un lecteur plein écran, qui
 * n'en a qu'un.
 *
 * Le composant ne se positionne pas : c'est le pied de `Dashboard.tsx`
 * qui le colle en bas, avec la barre d'outils au-dessus. Un composant qui
 * décide seul d'être `sticky` impose son empilement à qui l'accueille.
 */
export function ChangelogRail() {
    const { versions, loading } = useChangelog()
    const [reading, setReading] = useState(false)

    const latest = useMemo(
        () => selectLatestPublished(versions),
        [versions]
    )

    if (loading) {
        return (
            <SkeletonGroup
                label="Chargement des nouveautés"
                className="flex h-12 items-center gap-3 border-t bg-card px-4 sm:px-6"
            >
                <Skeleton className="size-4 rounded-full" />
                <Skeleton className="h-4 w-56" />
            </SkeletonGroup>
        )
    }

    if (!latest) return null

    const preview = latest.items.slice(0, PREVIEW_ITEMS)
    const remaining = latest.items.length - preview.length

    return (
        <section aria-label="Nouveautés" className="border-t bg-card">
            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
                <Sparkles className="size-4 shrink-0 text-primary" />

                <Badge variant="secondary" className="shrink-0">
                    v{latest.version}
                </Badge>

                {latest.deployment_date && (
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                        {format(
                            new Date(latest.deployment_date),
                            "d MMMM yyyy",
                            { locale: fr }
                        )}
                    </span>
                )}

                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {preview.map((item) => item.title).join(" · ")}
                    {remaining > 0 && ` · +${remaining}`}
                </p>

                <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setReading(true)}
                >
                    Tout voir
                </Button>
            </div>

            <ChangelogReader open={reading} onOpenChange={setReading} />
        </section>
    )
}
