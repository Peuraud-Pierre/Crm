import { formatDistanceToNow, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import { UsersRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { WikiReader } from "../../types/wiki-analytics.types"

/** Initiales pour le repli d'avatar (« Marie Dupont » → « MD »). */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
}

/**
 * Qui lit le wiki. Sert autant à repérer les services qui s'en servent qu'à
 * identifier ceux qu'il faudrait embarquer.
 */
export function ReadersTable({ readers }: { readers: WikiReader[] }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">Lecteurs</CardTitle>
            </CardHeader>
            <CardContent>
                {readers.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={UsersRound}
                        title="Aucun lecteur"
                        description="Personne n'a ouvert d'article sur cette période."
                    />
                ) : (
                    <ul className="max-h-72 space-y-1 overflow-y-auto">
                        {readers.map((r) => (
                            <li
                                key={r.user_id}
                                className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                            >
                                <Avatar className="h-8 w-8 shrink-0">
                                    {r.avatar_url && (
                                        <AvatarImage
                                            src={r.avatar_url}
                                            alt=""
                                        />
                                    )}
                                    <AvatarFallback className="text-xs">
                                        {initials(r.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        {r.full_name}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {r.articles_read} article
                                        {r.articles_read > 1 ? "s" : ""} · vu{" "}
                                        {formatDistanceToNow(
                                            parseISO(r.last_seen),
                                            { addSuffix: true, locale: fr }
                                        )}
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-semibold tabular-nums">
                                    {r.views}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    )
}
