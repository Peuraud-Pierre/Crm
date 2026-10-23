import { useEffect, useMemo, useState } from "react"
import { useAnalytics, getWeekKey, getPeriodRange } from "@/features/crm/context/AnalyticsContext"
import {
    fetchEventStatsRpc,
    fetchEventStatsFallbackByCreators,
} from "@/features/crm/services/statsService"
import { isFerieOrWeekend } from "@/features/crm/utils/calendarConstants"
import { cn } from "@/shared/lib/utils"
import { Zap, DollarSign } from "lucide-react"
import { isCountedSource } from "@/features/crm/utils/statsEligibility"

// Forme minimale d'un RDV consommé par le widget (champs lus uniquement).
type PalierEvent = {
    created_at?: string | null
    source?: string | null
    src?: string | null
    confirmed_by?: string | null
    creator_id?: string | null
    created_by?: string | null
}

// Les TROIS commerciaux ciblés : le widget ne s'affiche que pour eux et compte
// TOUJOURS le cumul des RDV créés par les trois (peu importe lequel est
// sélectionné).
export const TARGET_IDS = new Set([
    "8f93efc7-a3fb-496b-a397-781ae3fc41cf",
    "921e5a2d-1447-4f4c-b893-2f935a996973",
    "2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade",
])

// Paliers hebdomadaires (seuils mensuels ÷ 4) — pour la couleur des barres
const PALIERS_WEEKLY = [
    {
        min: 50,
        color: "bg-violet-500",
        border: "border-violet-400",
        bg: "bg-violet-50 dark:bg-violet-900/20",
        text: "text-violet-600",
    },
    {
        min: 38,
        color: "bg-red-500",
        border: "border-red-400",
        bg: "bg-red-50 dark:bg-red-900/20",
        text: "text-red-600",
    },
    {
        min: 30,
        color: "bg-orange-500",
        border: "border-orange-400",
        bg: "bg-orange-50 dark:bg-orange-900/20",
        text: "text-orange-600",
    },
    {
        min: 25,
        color: "bg-yellow-500",
        border: "border-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-900/20",
        text: "text-yellow-600",
    },
    {
        min: 18,
        color: "bg-emerald-500",
        border: "border-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        text: "text-emerald-600",
    },
    {
        min: 15,
        color: "bg-gray-400",
        border: "border-gray-300",
        bg: "bg-gray-50 dark:bg-gray-800/40",
        text: "text-gray-500",
    },
] as const

function getWeeklyPalier(n: number) {
    return PALIERS_WEEKLY.find((p) => n >= p.min) ?? null
}

// Paliers mensuels combinés (show uniquement) — du plus haut au plus bas
const PALIERS = [
    {
        min: 200,
        bonus: 600,
        label: "200 RDV",
        color: "bg-violet-500",
        text: "text-violet-600",
        border: "border-violet-400",
        bg: "bg-violet-50 dark:bg-violet-900/20",
    },
    {
        min: 150,
        bonus: 500,
        label: "150 RDV",
        color: "bg-red-500",
        text: "text-red-600",
        border: "border-red-400",
        bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
        min: 120,
        bonus: 250,
        label: "120 RDV",
        color: "bg-orange-500",
        text: "text-orange-600",
        border: "border-orange-400",
        bg: "bg-orange-50 dark:bg-orange-900/20",
    },
    {
        min: 100,
        bonus: 150,
        label: "100 RDV",
        color: "bg-yellow-500",
        text: "text-yellow-600",
        border: "border-yellow-400",
        bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    {
        min: 70,
        bonus: 100,
        label: "70–80 RDV",
        color: "bg-emerald-500",
        text: "text-emerald-600",
        border: "border-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    {
        min: 60,
        bonus: 0,
        label: "60 RDV",
        color: "bg-gray-400",
        text: "text-gray-500",
        border: "border-gray-300",
        bg: "bg-gray-50 dark:bg-gray-800/40",
    },
] as const

type Palier = (typeof PALIERS)[number]

function getPalierForCount(n: number): Palier | null {
    return PALIERS.find((p) => n >= p.min) ?? null
}

// Découpe un range en semaines calées sur le mois : la 1re semaine démarre au
// 1er du mois (pas de recul au lundi), puis par tranches de 7 jours (1–7, 8–14,
// …) jusqu'au dernier jour du mois.
function buildWeekSlots(start: Date, end: Date) {
    const slots: { key: string; label: string; start: Date; end: Date }[] = []
    const cur = new Date(start)

    let w = 1
    while (cur < end) {
        const s = new Date(cur)
        const e = new Date(cur)
        e.setDate(e.getDate() + 7)
        const slotEnd = e > end ? new Date(end) : e
        if (s < end) {
            slots.push({
                key: getWeekKey(s),
                label: `S${w}`,
                start: s,
                end: slotEnd,
            })
        }
        cur.setDate(cur.getDate() + 7)
        w++
    }
    return slots
}

// Diviseur appliqué au nombre de RDV pris (3 par défaut : prime partagée).
const DIVISOR_OPTIONS = [1, 2, 3, 4, 5, 6] as const

export function EventsPalier() {
    const { selectedCommercial, selectedPeriod, selectedFilter, crmUsers } =
        useAnalytics()

    // Par combien diviser le nombre de RDV pris (3 par défaut, modifiable).
    const [divisor, setDivisor] = useState<number>(3)

    // Le widget ne s'affiche que pour les trois commerciaux ciblés, mais il
    // calcule TOUJOURS le cumul des trois : on garde le booléen pour le rendu et
    // on laisse tous les hooks s'exécuter (règles des hooks).
    const isTarget = TARGET_IDS.has(selectedCommercial)

    const userName =
        crmUsers.find((u) => u.id === selectedCommercial)?.name ?? "Commercial"

    // Bornes de la période sélectionnée (fallback : mois en cours)
    const periodRange = useMemo(() => {
        const r = getPeriodRange(selectedPeriod, selectedFilter)
        if (r) return r
        const now = new Date()
        return {
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        }
    }, [selectedPeriod, selectedFilter])

    const periodLabel =
        selectedFilter ??
        new Date().toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
        })

    // RDV des TROIS commerciaux ciblés, récupérés INDÉPENDAMMENT du commercial
    // sélectionné (le RPC get_crm_event_stats ignore l'utilisateur courant et
    // déduplique déjà par client/jour). On applique côté JS les mêmes filtres
    // que les stats : source crm, créateurs autorisés, exclusion week-end/férié
    // sur created_at. → cumul fixe des trois, inchangé selon la sélection.
    const [ownerEvents, setOwnerEvents] = useState<PalierEvent[]>([])
    useEffect(() => {
        let cancelled = false
        const fmt = (d: Date) => {
            const y = d.getFullYear()
            const m = String(d.getMonth() + 1).padStart(2, "0")
            const day = String(d.getDate()).padStart(2, "0")
            return `${y}-${m}-${day} 00:00:00`
        }
        const start = fmt(periodRange.start)
        const end = fmt(periodRange.end)
        const ids = Array.from(TARGET_IDS)

        const load = async () => {
            // 1) RPC (dédupliqué côté SQL, ignore l'utilisateur courant).
            const rpc = await fetchEventStatsRpc(start, end)

            let rows: PalierEvent[] | null = null
            if (!rpc.error && rpc.data) {
                rows = (rpc.data as unknown as PalierEvent[]).filter(
                    (e) =>
                        isCountedSource(e) &&
                        TARGET_IDS.has(e.created_by ?? e.creator_id ?? "") &&
                        !isFerieOrWeekend(e.created_at)
                )
            } else {
                // 2) Fallback select direct si le RPC est absent en base (mêmes
                // filtres + déduplication que use_stats), pour les 3 créateurs.
                if (rpc.error) {
                    console.warn(
                        "[EventsPalier] RPC get_crm_event_stats indisponible → fallback select direct:",
                        rpc.error.message
                    )
                }
                const fb = await fetchEventStatsFallbackByCreators(
                    start,
                    end,
                    ids
                )

                if (!fb.error && fb.data) {
                    const seen = new Set<string>()
                    const distinct: PalierEvent[] = []
                    for (const e of fb.data as unknown as (PalierEvent & {
                        id?: string
                        id_client?: string | null
                        debut?: string | null
                        description?: string | null
                    })[]) {
                        if (!isCountedSource(e)) continue
                        if (isFerieOrWeekend(e.created_at)) continue
                        const desc = (e.description || "").toLowerCase()
                        if (
                            desc.includes("indisponible") ||
                            desc.includes("non disponible")
                        )
                            continue
                        const datePart = e.debut
                            ? String(e.debut).split("T")[0]
                            : "null"
                        const clientId = e.id_client || e.id
                        const key = `${e.creator_id}_${clientId}_${datePart}`
                        if (seen.has(key)) continue
                        seen.add(key)
                        distinct.push(e)
                    }
                    rows = distinct
                }
            }

            if (cancelled) return
            setOwnerEvents(rows ?? [])
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [periodRange])

    // Semaines de la période sélectionnée
    const weekSlots = useMemo(
        () => buildWeekSlots(periodRange.start, periodRange.end),
        [periodRange]
    )

    // Compte par semaine
    const countsByWeek = useMemo(() => {
        const map: Record<string, number> = {}
        weekSlots.forEach((s) => {
            map[s.key] = 0
        })
        ownerEvents.forEach((evt) => {
            if (!evt.created_at) return
            const d = new Date(evt.created_at)
            const slot = weekSlots.find((s) => d >= s.start && d < s.end)
            if (slot) map[slot.key] = (map[slot.key] ?? 0) + 1
        })
        return map
    }, [ownerEvents, weekSlots])

    // Count par semaine (sans bonus individuel — la prime est sur le total mensuel).
    // Le nombre de RDV pris est divisé par le diviseur choisi (3 par défaut).
    const weekBonuses = useMemo(
        () =>
            weekSlots.map((s) => ({
                slot: s,
                count: Math.round((countsByWeek[s.key] ?? 0) / divisor),
            })),
        [countsByWeek, weekSlots, divisor]
    )

    const maxCount = Math.max(...weekBonuses.map((w) => w.count), 1)

    // Total mensuel → UN seul palier → UNE seule prime
    const totalCount = useMemo(
        () => weekBonuses.reduce((sum, w) => sum + w.count, 0),
        [weekBonuses]
    )
    const currentPalier = getPalierForCount(totalCount)
    const totalBonus = currentPalier?.bonus ?? 0
    const nextPalier =
        PALIERS.slice()
            .reverse()
            .find((p) => totalCount < p.min) ?? null

    // Affichage réservé aux trois commerciaux ciblés (après les hooks).
    if (!isTarget) return null

    return (
        <div className="w-full rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-muted/40 border-b border-border/40">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">
                    Paliers de performance — {userName}
                </span>
                <div className="ml-auto flex items-center gap-3">
                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span>÷</span>
                        <select
                            value={divisor}
                            onChange={(e) => setDivisor(Number(e.target.value))}
                            className="bg-transparent border border-border/60 rounded px-1.5 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            title="Diviseur appliqué au nombre de RDV pris"
                        >
                            {DIVISOR_OPTIONS.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="text-xs text-muted-foreground capitalize">
                        {periodLabel}
                    </span>
                    {currentPalier && (
                        <span
                            className={cn(
                                "text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                currentPalier.border,
                                currentPalier.bg,
                                currentPalier.text
                            )}
                        >
                            {currentPalier.label}
                        </span>
                    )}
                    <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {totalBonus > 0
                                ? `${totalBonus}$`
                                : "Pas encore de prime"}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-border/30">
                {/* Colonne gauche : grille des paliers */}
                <div className="flex flex-col gap-1.5 px-5 py-4 min-w-[240px] max-w-[280px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Barème mensuel (RDV show — cumul à deux)
                    </p>
                    {[...PALIERS].reverse().map((p) => (
                        <div
                            key={p.min}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium",
                                p.border,
                                p.bg
                            )}
                        >
                            <div
                                className={cn(
                                    "w-2 h-2 rounded-full shrink-0",
                                    p.color
                                )}
                            />
                            <span className={cn("flex-1", p.text)}>
                                {p.label}
                            </span>
                            <span
                                className={cn("font-bold tabular-nums", p.text)}
                            >
                                {p.bonus === 0 ? "—" : `${p.bonus}$`}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Colonne droite : barres par semaine */}
                <div className="flex-1 px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        RDV show par semaine (cumul : {totalCount})
                    </p>
                    {weekSlots.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Sélectionnez une période.
                        </p>
                    ) : (
                        <div
                            className="flex items-end gap-2"
                            style={{ height: "120px" }}
                        >
                            {weekBonuses.map(({ slot, count }) => {
                                const heightPct = (count / maxCount) * 100
                                const wp = getWeeklyPalier(count)
                                const barColor =
                                    wp?.color ?? "bg-muted-foreground/20"

                                return (
                                    <div
                                        key={slot.key}
                                        className={cn(
                                            "flex-1 flex flex-col items-center gap-0.5 rounded-lg p-1 border transition-colors duration-slower",
                                            wp
                                                ? cn(wp.bg, wp.border)
                                                : "border-transparent"
                                        )}
                                    >
                                        {/* Barre */}
                                        <div
                                            className="w-full flex flex-col justify-end bg-muted/30 rounded-t-md overflow-hidden"
                                            style={{ height: "72px" }}
                                        >
                                            <div
                                                className={cn(
                                                    "w-full transition-[height] duration-slower rounded-t-md",
                                                    barColor
                                                )}
                                                style={{
                                                    height: `${heightPct}%`,
                                                    minHeight:
                                                        count > 0
                                                            ? "4px"
                                                            : "0px",
                                                }}
                                            />
                                        </div>

                                        {/* Label semaine + dates */}
                                        <span
                                            className={cn(
                                                "text-[10px] font-medium text-center w-full",
                                                wp
                                                    ? wp.text
                                                    : "text-muted-foreground"
                                            )}
                                        >
                                            {slot.label}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground/70 text-center w-full leading-tight">
                                            {slot.start.getDate()}–
                                            {new Date(
                                                slot.end.getTime() - 1
                                            ).getDate()}
                                        </span>
                                        {/* Nombre d'events */}
                                        <span
                                            className={cn(
                                                "text-[11px] font-bold tabular-nums",
                                                wp ? wp.text : "text-foreground"
                                            )}
                                        >
                                            {count}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Barre de progression semaine en cours → prochain palier */}
                    {weekSlots.length > 0 && (
                        <div className="mt-4 space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                                <span>
                                    Total {periodLabel} :{" "}
                                    <strong className="text-foreground">
                                        {totalCount} events
                                    </strong>
                                    {nextPalier
                                        ? ` → ${nextPalier.min - totalCount} de plus pour ${nextPalier.bonus}$`
                                        : " — Palier max atteint 🎉"}
                                </span>
                                {nextPalier && (
                                    <span className="tabular-nums">
                                        {totalCount}/{nextPalier.min}
                                    </span>
                                )}
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-[width] duration-glacial",
                                        nextPalier
                                            ? (currentPalier?.color ??
                                                  "bg-gray-400")
                                            : "bg-violet-500"
                                    )}
                                    style={{
                                        width: `${nextPalier ? Math.min((totalCount / nextPalier.min) * 100, 100) : 100}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
