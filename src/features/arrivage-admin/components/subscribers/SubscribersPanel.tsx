import { useMemo, useState } from "react"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { Search, Users } from "lucide-react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { RefreshButton } from "@/features/arrivage-admin/components/shared/RefreshButton"
import { SendAllDialog } from "@/features/arrivage-admin/components/shared/SendAllDialog"
import { SubscriberCard } from "@/features/arrivage-admin/components/subscribers/SubscriberCard"
import { SubscriberTable } from "@/features/arrivage-admin/components/subscribers/SubscriberTable"
import type { Subscriber } from "@/features/arrivage-admin/types"

const SKELETON_CARDS = ["sc1", "sc2", "sc3", "sc4"]

type ActiveFilter = "all" | "active" | "inactive"
/** Filtre par newsletter reçue — indépendant du statut arrivage actif/inactif. */
type NewsletterFilter = "all" | "arrivage" | "stats"

interface SubscribersPanelProps {
    subscribers: Subscriber[]
    loading: boolean
    canSend: boolean
    sendingId: string | null
    sendingAll: boolean
    onRefresh: () => void
    onResend: (userId: string) => void
    onSendAll: () => Promise<void>
    onToggleArrivage: (userId: string, arrivage: boolean) => void
    onToggleCrmStat: (userId: string, crmStat: boolean) => void
}

export function SubscribersPanel({
    subscribers,
    loading,
    canSend,
    sendingId,
    sendingAll,
    onRefresh,
    onResend,
    onSendAll,
    onToggleArrivage,
    onToggleCrmStat,
}: SubscribersPanelProps) {
    const [search, setSearch] = useState("")
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all")
    const [newsletterFilter, setNewsletterFilter] =
        useState<NewsletterFilter>("all")
    // Un seul abonnement au media query pour toute la liste de cartes.
    const reducedMotion = usePrefersReducedMotion()

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase()
        return subscribers.filter(s => {
            if (activeFilter === "active" && !s.active) return false
            if (activeFilter === "inactive" && s.active) return false
            if (newsletterFilter === "arrivage" && !s.arrivage) return false
            if (newsletterFilter === "stats" && !s.crm_stat) return false
            if (!needle) return true
            return (
                s.email.toLowerCase().includes(needle) ||
                (s.full_name ?? "").toLowerCase().includes(needle)
            )
        })
    }, [subscribers, search, activeFilter, newsletterFilter])

    const isEmpty = !loading && filtered.length === 0

    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Abonnés</CardTitle>
                    <div className="flex shrink-0 gap-2">
                        <RefreshButton
                            loading={loading}
                            onClick={onRefresh}
                            label="la liste des abonnés"
                        />
                        {canSend && (
                            <SendAllDialog
                                sending={sendingAll}
                                onConfirm={onSendAll}
                            />
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher (nom, email)…"
                            className="pl-9"
                            aria-label="Rechercher un abonné"
                        />
                    </div>
                    <Select
                        value={activeFilter}
                        onValueChange={v => setActiveFilter(v as ActiveFilter)}
                    >
                        <SelectTrigger
                            className="w-full sm:w-40"
                            aria-label="Filtrer par statut"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous</SelectItem>
                            <SelectItem value="active">Actifs</SelectItem>
                            <SelectItem value="inactive">Inactifs</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={newsletterFilter}
                        onValueChange={v =>
                            setNewsletterFilter(v as NewsletterFilter)
                        }
                    >
                        <SelectTrigger
                            className="w-full sm:w-44"
                            aria-label="Filtrer par newsletter reçue"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                Toutes newsletters
                            </SelectItem>
                            <SelectItem value="arrivage">Arrivage</SelectItem>
                            <SelectItem value="stats">Stats CRM</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>

            <CardContent className="p-0" aria-busy={loading}>
                {isEmpty ? (
                    <EmptyState
                        icon={Users}
                        title={
                            subscribers.length === 0
                                ? "Aucun abonné"
                                : "Aucun abonné ne correspond"
                        }
                        description={
                            subscribers.length === 0
                                ? "Générez un code d'invitation puis associez-le à un utilisateur pour créer le premier abonnement."
                                : "Ajustez la recherche ou les filtres de statut/newsletter."
                        }
                    />
                ) : (
                    <>
                        {/* Desktop : table */}
                        <div className="hidden md:block">
                            <SubscriberTable
                                subscribers={filtered}
                                loading={loading}
                                canSend={canSend}
                                sendingId={sendingId}
                                sendingAll={sendingAll}
                                onResend={onResend}
                                onToggleArrivage={onToggleArrivage}
                                onToggleCrmStat={onToggleCrmStat}
                            />
                        </div>

                        {/* Mobile : cartes */}
                        <div className="space-y-3 p-4 md:hidden">
                            {loading
                                ? SKELETON_CARDS.map(key => (
                                      <Skeleton
                                          key={key}
                                          className="h-32 w-full rounded-lg"
                                      />
                                  ))
                                : filtered.map((s, index) => (
                                      <SubscriberCard
                                          key={s.user_id}
                                          subscriber={s}
                                          canSend={canSend}
                                          sending={sendingId === s.user_id}
                                          disabled={sendingAll}
                                          index={index}
                                          reducedMotion={reducedMotion}
                                          onResend={onResend}
                                          onToggleArrivage={onToggleArrivage}
                                          onToggleCrmStat={onToggleCrmStat}
                                      />
                                  ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
