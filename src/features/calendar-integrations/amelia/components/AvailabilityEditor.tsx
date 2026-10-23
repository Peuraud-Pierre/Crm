/*
 * Clés de liste basées sur l'index : ces listes sont éditables en place et sans
 * identifiant stable. Une clé dérivée des valeurs (date/horaire/libellé) change à
 * chaque frappe, ce qui remonte l'input et fait perdre le focus (on ne pouvait
 * écrire qu'une lettre à la fois). L'index est ici la clé correcte.
 */
/* eslint-disable react-x/no-array-index-key */
import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2, Save, RotateCcw, CalendarOff, Clock } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAmeliaAvailability } from "../hooks/useAmeliaAvailability"
import type {
    ClosurePeriod,
    DayOff,
    SpecialDay,
    WeeklySlot,
} from "../services/AmeliaAvailabilityService"

// ISO : 1=lundi … 7=dimanche
const DAYS: { iso: number; label: string }[] = [
    { iso: 1, label: "Lundi" },
    { iso: 2, label: "Mardi" },
    { iso: 3, label: "Mercredi" },
    { iso: 4, label: "Jeudi" },
    { iso: 5, label: "Vendredi" },
    { iso: 6, label: "Samedi" },
    { iso: 7, label: "Dimanche" },
]

interface Slot {
    start: string
    end: string
}

// Modèle par défaut proposé à un commercial qui n'a jamais configuré sa dispo :
// lun→ven 09:00–18:00. Non persistant tant que l'utilisateur n'enregistre pas.
const buildDefaultWeekly = (): Record<number, Slot[]> => ({
    1: [{ start: "09:00", end: "18:00" }],
    2: [{ start: "09:00", end: "18:00" }],
    3: [{ start: "09:00", end: "18:00" }],
    4: [{ start: "09:00", end: "18:00" }],
    5: [{ start: "09:00", end: "18:00" }],
})

/** Forme commune des hooks de disponibilité (commercial ou entreprise). */
type AvailabilityController = (userId?: string) => {
    availability: {
        weekly: WeeklySlot[]
        daysOff: DayOff[]
        special: SpecialDay[]
        // Périodes de fermeture (canal entreprise uniquement, mode onlyDaysOff).
        closures?: ClosurePeriod[]
    }
    loading: boolean
    saving: boolean
    error: string | null
    reload: () => Promise<void>
    save: (
        payload: {
            weekly: WeeklySlot[]
            daysOff: DayOff[]
            special: SpecialDay[]
            closures?: ClosurePeriod[]
        }
    ) => Promise<boolean>
}

interface AvailabilityEditorProps {
    /** user_id Supabase ciblé. Omis = la dispo de l'utilisateur courant.
     *  Si renseigné (≠ soi), nécessite un rôle manager côté bridge. */
    userId?: string
    title?: string
    /** Hook fournissant les données. Défaut : useAmeliaAvailability (par commercial).
     *  Passer useCompanyAvailability pour éditer les horaires d'entreprise. */
    useController?: AvailabilityController
    /** Mode entreprise : n'afficher/éditer que les jours de fermeture (Company Days
     *  Off globaux Amelia). Masque les horaires hebdo et les journées spéciales,
     *  qui restent gérés par commercial. */
    onlyDaysOff?: boolean
}

export function AvailabilityEditor({
    userId,
    title,
    useController,
    onlyDaysOff = false,
}: AvailabilityEditorProps) {
    const controller = useController ?? useAmeliaAvailability
    const { availability, loading, saving, error, reload, save } =
        controller(userId)

    const [weekly, setWeekly] = useState<Record<number, Slot[]>>({})
    const [special, setSpecial] = useState<SpecialDay[]>([])
    // Périodes de congés (commercial) / de fermeture (entreprise).
    const [closures, setClosures] = useState<ClosurePeriod[]>([])
    // true tant qu'on affiche le modèle par défaut (jamais configuré + non enregistré).
    const [usingDefault, setUsingDefault] = useState(false)

    // (Ré)initialise l'état local à chaque (re)chargement depuis le bridge.
    useEffect(() => {
        const grouped: Record<number, Slot[]> = {}
        for (const s of availability.weekly) {
            ;(grouped[s.dayOfWeek] ??= []).push({ start: s.start, end: s.end })
        }
        // En mode « jours de fermeture uniquement », pas de modèle hebdo par défaut.
        const neverConfigured =
            !onlyDaysOff &&
            availability.weekly.length === 0 &&
            (availability.closures?.length ?? 0) === 0 &&
            availability.special.length === 0
        // Resync de l'état local d'édition sur changement de l'entité `availability`
        /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect */
        setWeekly(neverConfigured ? buildDefaultWeekly() : grouped)
        setUsingDefault(neverConfigured)
        setSpecial(availability.special.map((s) => ({ ...s })))
        setClosures((availability.closures ?? []).map((c) => ({ ...c })))
        /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
    }, [availability, onlyDaysOff])

    const applyDefault = () => {
        setWeekly(buildDefaultWeekly())
        setUsingDefault(true)
    }

    // ─── Horaires hebdo ──────────────────────────────────────────────────────
    const addSlot = (iso: number) =>
        setWeekly((w) => ({
            ...w,
            [iso]: [...(w[iso] ?? []), { start: "09:00", end: "18:00" }],
        }))
    const updateSlot = (
        iso: number,
        idx: number,
        field: keyof Slot,
        value: string
    ) =>
        setWeekly((w) => ({
            ...w,
            [iso]: (w[iso] ?? []).map((s, i) =>
                i === idx ? { ...s, [field]: value } : s
            ),
        }))
    const removeSlot = (iso: number, idx: number) =>
        setWeekly((w) => ({
            ...w,
            [iso]: (w[iso] ?? []).filter((_, i) => i !== idx),
        }))

    // ─── Périodes de congés / fermeture ──────────────────────────────────────
    const addClosure = () =>
        setClosures((c) => [...c, { startDate: "", endDate: "", name: "" }])
    const updateClosure = (
        idx: number,
        field: keyof ClosurePeriod,
        value: string
    ) =>
        setClosures((c) =>
            c.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
        )
    const removeClosure = (idx: number) =>
        setClosures((c) => c.filter((_, i) => i !== idx))

    // ─── Journées spéciales ──────────────────────────────────────────────────
    const addSpecial = () =>
        setSpecial((s) => [...s, { day: "", start: "09:00", end: "18:00" }])
    const updateSpecial = (
        idx: number,
        field: keyof SpecialDay,
        value: string
    ) =>
        setSpecial((s) =>
            s.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
        )
    const removeSpecial = (idx: number) =>
        setSpecial((s) => s.filter((_, i) => i !== idx))

    // ─── Validation + sauvegarde ─────────────────────────────────────────────
    const weeklyFlat = useMemo(
        () =>
            Object.entries(weekly).flatMap(([iso, slots]) =>
                slots.map((s) => ({
                    dayOfWeek: Number(iso),
                    start: s.start,
                    end: s.end,
                }))
            ),
        [weekly]
    )

    const validationError = useMemo(() => {
        for (const s of weeklyFlat) {
            if (s.start >= s.end)
                return "Un créneau hebdomadaire a une fin ≤ début."
        }
        for (const s of special) {
            if (!s.day) return "Une journée spéciale n'a pas de date."
            if (s.start >= s.end)
                return "Une journée spéciale a une fin ≤ début."
        }
        for (const c of closures) {
            if (!c.startDate) return "Une période n'a pas de date de début."
            if (!c.endDate) return "Une période n'a pas de date de fin."
            if (c.endDate < c.startDate)
                return "Une période a une fin antérieure au début."
        }
        return null
    }, [weeklyFlat, special, closures])

    const handleSave = async () => {
        if (validationError) {
            toast.error("Vérifie les horaires", { description: validationError })
            return
        }
        const ok = await save({
            weekly: weeklyFlat,
            daysOff: [], // canal mono-jour déprécié : remplacé par les périodes (closures)
            special: special.filter((s) => s.day),
            closures: closures.filter((c) => c.startDate),
        })
        if (ok) {
            toast.success("Disponibilité enregistrée", {
                description: "Le planning a été synchronisé avec Amelia.",
            })
        } else {
            toast.error("Échec de l'enregistrement", {
                description: error ?? "Réessaie dans un instant.",
            })
        }
    }

    if (loading) {
        return (
            <Card className="p-6 flex items-center justify-center min-h-[200px] text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement de la
                disponibilité…
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-bold tracking-tight">
                    {title ?? "Mes disponibilités"}
                </h2>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={reload}
                        disabled={saving}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" /> Annuler
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        loading={saving}
                        className="gap-2"
                    >
                        {!saving && <Save className="h-4 w-4" />}
                        Enregistrer
                    </Button>
                </div>
            </div>

            {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-slow">
                    {error}
                </p>
            )}

            {usingDefault && !onlyDaysOff && (
                <p className="text-sm text-warning bg-warning/10 rounded-md px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-slow">
                    Horaires par défaut proposés (lun–ven, 9h–18h). Ajustez-les
                    puis enregistrez pour les appliquer.
                </p>
            )}

            {/* ─── Horaires hebdomadaires ─── */}
            {!onlyDaysOff && (
            <Card
                style={{ animationDelay: "0ms" }}
                className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
            >
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">
                            Horaires hebdomadaires
                        </h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground"
                        onClick={applyDefault}
                    >
                        <RotateCcw className="h-3.5 w-3.5" /> Modèle par défaut
                    </Button>
                </div>
                <div className="space-y-3">
                    {DAYS.map(({ iso, label }, dayIndex) => {
                        const slots = weekly[iso] ?? []
                        return (
                            <div
                                key={iso}
                                style={{
                                    animationDelay: `${Math.min(dayIndex * 40, 280)}ms`,
                                }}
                                className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 border-b border-border/40 pb-3 last:border-0 animate-in fade-in slide-in-from-left-2 fill-mode-backwards duration-slow ease-out"
                            >
                                <span className="w-24 shrink-0 text-sm font-medium pt-1.5">
                                    {label}
                                </span>
                                <div className="flex-1 space-y-2">
                                    {slots.length === 0 && (
                                        <span className="text-xs text-muted-foreground italic">
                                            Indisponible
                                        </span>
                                    )}
                                    {slots.map((s, idx) => (
                                        <div
                                            key={`slot-${iso}-${idx}`}
                                            className="flex items-center gap-2"
                                        >
                                            <Input
                                                type="time"
                                                value={s.start}
                                                onChange={(e) =>
                                                    updateSlot(
                                                        iso,
                                                        idx,
                                                        "start",
                                                        e.target.value
                                                    )
                                                }
                                                className="w-28 h-8"
                                            />
                                            <span className="text-muted-foreground text-xs">
                                                →
                                            </span>
                                            <Input
                                                type="time"
                                                value={s.end}
                                                onChange={(e) =>
                                                    updateSlot(
                                                        iso,
                                                        idx,
                                                        "end",
                                                        e.target.value
                                                    )
                                                }
                                                className="w-28 h-8"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() =>
                                                    removeSlot(iso, idx)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 gap-1 text-xs text-primary"
                                        onClick={() => addSlot(iso)}
                                    >
                                        <Plus className="h-3.5 w-3.5" /> Ajouter
                                        un créneau
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>
            )}

            {/* ─── Périodes de congés (commercial) / fermeture (entreprise) ─── */}
            <Card
                style={{ animationDelay: "80ms" }}
                className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <CalendarOff className="h-4 w-4 text-destructive" />
                        <h3 className="font-semibold text-sm">
                            {onlyDaysOff
                                ? "Périodes de fermeture"
                                : "Congés / absences"}
                        </h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-primary"
                        onClick={addClosure}
                    >
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                    </Button>
                </div>
                {closures.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        {onlyDaysOff
                            ? "Aucune période de fermeture enregistrée."
                            : "Aucun congé enregistré."}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {closures.map((c, idx) => (
                            <div
                                key={`closure-${idx}`}
                                style={{
                                    animationDelay: `${Math.min(idx * 60, 240)}ms`,
                                }}
                                className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
                            >
                                <Input
                                    type="date"
                                    value={c.startDate}
                                    onChange={(e) =>
                                        updateClosure(idx, "startDate", e.target.value)
                                    }
                                    className="w-40 h-8"
                                />
                                <span className="text-muted-foreground text-xs">
                                    →
                                </span>
                                <Input
                                    type="date"
                                    value={c.endDate}
                                    onChange={(e) =>
                                        updateClosure(idx, "endDate", e.target.value)
                                    }
                                    className="w-40 h-8"
                                />
                                <Input
                                    placeholder="Libellé (optionnel)"
                                    value={c.name ?? ""}
                                    onChange={(e) =>
                                        updateClosure(idx, "name", e.target.value)
                                    }
                                    className="flex-1 h-8"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeClosure(idx)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* ─── Journées spéciales ─── */}
            {!onlyDaysOff && (
            <Card
                style={{ animationDelay: "160ms" }}
                className="p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-chart-5" />
                        <h3 className="font-semibold text-sm">
                            Journées à horaires spécifiques
                        </h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-primary"
                        onClick={addSpecial}
                    >
                        <Plus className="h-3.5 w-3.5" /> Ajouter
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Remplace les horaires hebdomadaires pour une date précise.
                </p>
                {special.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                        Aucune journée spéciale.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {special.map((s, idx) => (
                            <div
                                key={`special-${idx}`}
                                style={{
                                    animationDelay: `${Math.min(idx * 60, 240)}ms`,
                                }}
                                className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-slow ease-out"
                            >
                                <Input
                                    type="date"
                                    value={s.day}
                                    onChange={(e) =>
                                        updateSpecial(idx, "day", e.target.value)
                                    }
                                    className="w-40 h-8"
                                />
                                <Input
                                    type="time"
                                    value={s.start}
                                    onChange={(e) =>
                                        updateSpecial(
                                            idx,
                                            "start",
                                            e.target.value
                                        )
                                    }
                                    className="w-28 h-8"
                                />
                                <span className="text-muted-foreground text-xs">
                                    →
                                </span>
                                <Input
                                    type="time"
                                    value={s.end}
                                    onChange={(e) =>
                                        updateSpecial(idx, "end", e.target.value)
                                    }
                                    className="w-28 h-8"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeSpecial(idx)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
            )}

            <Separator />
            <p className="text-[11px] text-muted-foreground">
                Les modifications sont enregistrées dans le CRM puis synchronisées
                avec Amelia à l'enregistrement.
            </p>
        </div>
    )
}
