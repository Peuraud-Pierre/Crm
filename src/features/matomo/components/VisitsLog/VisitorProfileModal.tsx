import { ExternalLink } from "lucide-react"
import { flagUrl, isVisitsLogDisabled } from "@/features/matomo/services/matomoService"
import { useMatomoVisitorProfile } from "@/features/matomo/hooks/data/useMatomo"
import { Dialog, DialogContent_2, DialogTitle } from "@/shared/ui/atoms/dialog"
import BlockError from "../BlockError"
import VisitsLogDisabled from "./VisitsLogDisabled"
import {
    buildEnvironmentRows,
    ProfileSkeleton,
    Row,
    Section,
    StatTile,
} from "./VisitorProfileBlocks"
import { safeDisplay } from "./utils"
import { fmtDuration, fmtInt as fmt, pluralWord } from "../../utils/format"

interface VisitorProfileModalProps {
    siteId: string
    visitorId: string
    onClose: () => void
}

export default function VisitorProfileModal({
    siteId,
    visitorId,
    onClose,
}: VisitorProfileModalProps) {
    const query = useMatomoVisitorProfile(siteId, visitorId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forme Matomo (Live.getVisitorProfile) large et non typée, lue champ par champ avec repli « — »
    const profile = query.data as any

    const country = profile?.countries?.[0]

    const environment = buildEnvironmentRows(profile)

    return (
        // Radix Dialog : piège de focus, restitution du focus à la ligne du
        // journal, Échap, clic sur le voile et verrouillage du défilement.
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            {/* Arrondi + overflow-hidden sur l'enveloppe, scroll sur le corps : la
                scrollbar (non-overlay sur Firefox) est ainsi rognée par le radius au
                lieu d'écraser l'arrondi du coin droit. Header et corps sont frères,
                donc le titre et la fermeture restent visibles pendant le défilement.
                DialogContent_2 : la variante du design system plein écran sur
                mobile (un profil de plusieurs écrans n'a rien à gagner à flotter
                avec 16px de voile autour), centrée et plafonnée au-dessus de sm. */}
            <DialogContent_2
                aria-describedby={undefined}
                className="flex max-w-3xl flex-col gap-0 overflow-hidden bg-popover p-0 text-popover-foreground"
            >
                {/* ─── Header ─── */}
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border py-3 pl-4 pr-12 sm:py-4 sm:pl-6">
                    <div className="min-w-0">
                        <DialogTitle className="text-lg font-semibold sm:text-xl">
                            Profil du visiteur
                        </DialogTitle>
                        {/* L'identifiant en sous-titre : donne du contexte immédiat et
                            évite le grand vide entre un titre court et la croix. */}
                        <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {visitorId}
                        </p>
                    </div>
                </div>

                {/* ─── Corps défilant ─── */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                    {query.isPending && <ProfileSkeleton />}

                    {query.isError &&
                        (isVisitsLogDisabled(query.error) ? (
                            <VisitsLogDisabled />
                        ) : (
                            <BlockError
                                error={query.error}
                                onRetry={() => query.refetch()}
                                retrying={query.isFetching}
                            />
                        ))}

                    {query.isSuccess && profile && (
                        <div className="space-y-7">
                            {/* ─── Identité ─── */}
                            <dl className="divide-y divide-border/60">
                                <Row label="Pays">
                                    <span className="inline-flex items-center gap-1.5">
                                        {country?.prettyName || "—"}
                                        {country?.flag && (
                                            <img
                                                src={flagUrl(country.flag)}
                                                alt=""
                                                className="inline-block h-4 w-5 shrink-0"
                                            />
                                        )}
                                    </span>
                                </Row>
                                <Row label="Continent">
                                    {profile.continents?.[0]?.prettyName || "—"}
                                </Row>
                                <Row label="Première visite">
                                    {safeDisplay(profile.firstVisit)}
                                </Row>
                                <Row label="Dernière visite">
                                    {safeDisplay(profile.lastVisit)}
                                </Row>
                                <Row label="Durée totale">
                                    {profile.totalVisitDurationPretty ||
                                        fmtDuration(profile.totalVisitDuration)}
                                </Row>
                            </dl>

                            {/* ─── Chiffres clés ─── */}
                            <Section title="Chiffres clés">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    <StatTile
                                        label="Visites"
                                        value={fmt(profile.totalVisits)}
                                    />
                                    <StatTile
                                        label="Actions"
                                        value={fmt(profile.totalActions)}
                                    />
                                    <StatTile
                                        label="Vues de page"
                                        value={fmt(profile.totalPageViews)}
                                    />
                                    <StatTile
                                        label="Vues uniques"
                                        value={fmt(profile.totalUniquePageViews)}
                                    />
                                </div>
                                {profile.summary && (
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        A passé{" "}
                                        <span className="font-medium text-foreground">
                                            {
                                                profile.summary
                                                    .totalTimeSpentPretty
                                            }
                                        </span>{" "}
                                        sur le site, pour{" "}
                                        <span className="font-medium text-foreground">
                                            {fmt(
                                                profile.summary.totalPageViews
                                            )}
                                        </span>{" "}
                                        {pluralWord(profile.summary.totalPageViews, "page")} en{" "}
                                        <span className="font-medium text-foreground">
                                            {fmt(profile.summary.totalVisits)}
                                        </span>{" "}
                                        {pluralWord(profile.summary.totalVisits, "visite")}, et{" "}
                                        <span className="font-medium text-foreground">
                                            {fmt(
                                                profile.summary.totalConversions
                                            )}
                                        </span>{" "}
                                        {pluralWord(
                                            profile.summary.totalConversions,
                                            "objectif converti",
                                            "objectifs convertis"
                                        )}
                                        .
                                    </p>
                                )}
                            </Section>

                            {/* ─── Environnement ─── */}
                            {environment.length > 0 && (
                                <Section title="Appareils & navigateurs">
                                    <ul className="space-y-1.5">
                                        {environment.map(
                                            ({ key, Icon, text }) => (
                                                <li
                                                    key={key}
                                                    className="flex items-start gap-2 text-sm"
                                                >
                                                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 break-words">
                                                        {text}
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </Section>
                            )}

                            {/* ─── Localisation ─── */}
                            {profile.countries?.length > 0 && (
                                <Section title="Localisation">
                                    <ul className="space-y-1.5">
                                        {profile.countries.map(
                                            (c: {
                                                prettyName: string
                                                flag?: string
                                                nbVisits: number
                                            }) => (
                                                <li
                                                    key={c.prettyName}
                                                    className="flex items-center justify-between gap-3 text-sm"
                                                >
                                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                                        {c.flag && (
                                                            <img
                                                                src={flagUrl(
                                                                    c.flag
                                                                )}
                                                                alt=""
                                                                className="h-4 w-5 shrink-0"
                                                            />
                                                        )}
                                                        <span className="truncate">
                                                            {c.prettyName}
                                                        </span>
                                                    </span>
                                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                                        {fmt(c.nbVisits)}{" "}
                                                        {pluralWord(c.nbVisits, "visite")}
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </Section>
                            )}

                            {/* ─── Source de trafic ─── */}
                            {profile.referrerTypeName && (
                                <Section title="Source de trafic">
                                    <p className="text-sm">
                                        {profile.referrerTypeName}
                                        {profile.referrerName && (
                                            <>
                                                {" — via "}
                                                <span className="font-medium">
                                                    {profile.referrerName}
                                                </span>
                                            </>
                                        )}
                                    </p>
                                </Section>
                            )}

                            {/* ─── Historique ─── */}
                            {profile.lastVisits?.length > 0 && (
                                <Section title="Historique des visites">
                                    <div className="space-y-2">
                                        {profile.lastVisits.map(
                                            (visit: {
                                                prettyDate?: string
                                                serverDate?: string
                                                actions?: number
                                                visitDurationPretty?: string
                                                referrerName?: string
                                                referrerTypeName?: string
                                            }) => (
                                                <div
                                                    key={`${visit.serverDate ?? visit.prettyDate}-${visit.actions}-${visit.visitDurationPretty}`}
                                                    className="rounded-md border border-border bg-muted/40 p-3"
                                                >
                                                    <p className="text-xs font-medium text-foreground">
                                                        {visit.prettyDate ||
                                                            visit.serverDate}
                                                    </p>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        <span className="tabular-nums">
                                                            {fmt(
                                                                visit.actions ??
                                                                    0
                                                            )}
                                                        </span>{" "}
                                                        {/* Matomo compte des actions (pages, téléchargements, clics sortants), pas des pages. */}
                                                        {pluralWord(visit.actions ?? 0, "action")} ·{" "}
                                                        {visit.visitDurationPretty ||
                                                            "—"}{" "}
                                                        ·{" "}
                                                        {visit.referrerName ||
                                                            visit.referrerTypeName ||
                                                            "source inconnue"}
                                                    </p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </Section>
                            )}

                            {/* ─── Pages visitées ─── */}
                            {profile.visitedPages?.length > 0 && (
                                <Section
                                    title={`Pages visitées (${profile.visitedPages.length})`}
                                >
                                    <ul className="space-y-1.5">
                                        {profile.visitedPages.map(
                                            (p: {
                                                url: string
                                                count: number
                                            }) => (
                                                <li
                                                    key={p.url}
                                                    className="flex items-baseline justify-between gap-3 text-xs"
                                                >
                                                    <a
                                                        href={p.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="min-w-0 break-all rounded-sm text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    >
                                                        {p.url}
                                                        {/* Ouvre le site public dans un autre onglet :
                                                            dit avant le clic, pas découvert après. */}
                                                        <ExternalLink
                                                            aria-hidden
                                                            className="ml-1 inline size-3 align-baseline"
                                                        />
                                                        <span className="sr-only">
                                                            {" "}(nouvel onglet)
                                                        </span>
                                                    </a>
                                                    <span className="shrink-0 tabular-nums text-muted-foreground">
                                                        {fmt(p.count)}×
                                                    </span>
                                                </li>
                                            )
                                        )}
                                    </ul>
                                </Section>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent_2>
        </Dialog>
    )
}
