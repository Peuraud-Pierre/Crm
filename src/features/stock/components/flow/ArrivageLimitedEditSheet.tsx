import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Building2, Info, SquarePen } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    useArrivageManuelContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import type { ArrivageStatus } from "@/features/stock/types/stock.types"
import {
    TRANSPORT_MODES,
    ARRIVAGE_STATUS_CONFIG,
    INVOICE_ALERT_DAYS,
    STOCK_PERMISSIONS,
} from "@/features/stock/constants"
import { daysFromDechargement } from "@/features/stock/utils/arrivageHelpers"
import { cn } from "@/shared/lib/utils"

// Déchargé fusionné avec reçu — non proposé à la saisie manuelle
const STATUSES = (Object.entries(ARRIVAGE_STATUS_CONFIG) as [ArrivageStatus, { label: string }][])
    .filter(([v]) => v !== "déchargé")
    .map(([value, { label }]) => ({ value, label }))

interface Props {
    row: ArrivageManuelRow
    onClose: () => void
}

// Converts a UTC/TZ-aware timestamp to the "YYYY-MM-DDTHH:mm" format
// expected by <input type="datetime-local">, using the browser's local timezone.
function toLocalDatetimeInput(ts: string): string {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function rowToForm(row: ArrivageManuelRow) {
    return {
        container_no:         row.container_no,
        conteneur_no_raw:     row.conteneur_no_raw ?? "",
        fournisseur_id:       row.fournisseur_id ?? "",
        status:               row.status as ArrivageStatus,
        status_auto:          row.status_auto,
        invoice_date:         row.invoice_date ?? "",
        notes:                row.notes ?? "",
        transport_mode:       row.transport_mode ?? "",
        departure_date:       row.departure_date ?? "",
        port_arrival_date:    row.port_arrival_date ?? "",
        total_weight_kg:      row.total_weight_kg?.toString() ?? "",
        total_qty:            row.total_qty?.toString() ?? "",
        prev_dechargement_at: row.prev_dechargement_at
            ? toLocalDatetimeInput(row.prev_dechargement_at)
            : "",
    }
}

function jLabel(days: number): string {
    if (days === 0) return "J"
    return days > 0 ? `J-${days}` : `J+${Math.abs(days)}`
}

function dechargementAlertText(days: number): string {
    if (days === 0) return "déchargement aujourd'hui"
    if (days > 0) return `déchargement dans ${days} jour${days > 1 ? "s" : ""}`
    const abs = Math.abs(days)
    return `déchargement passé il y a ${abs} jour${abs > 1 ? "s" : ""}`
}

export default function ArrivageLimitedEditSheet({ row, onClose }: Props) {
    const { update, remove } = useArrivageManuelContext()
    const { fournisseurs } = useReferentialContext()
    const { hasPermission } = useAuth()
    const canDelete = hasPermission(STOCK_PERMISSIONS.arrivageDelete)

    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState(() => rowToForm(row))

    // Resync du formulaire contrôlé quand l'entité éditée (row) change.
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setForm(rowToForm(row))
    }, [row])

    const fournisseurOptions = fournisseurs.map(f => ({
        value: f.id,
        label: f.name,
        icon: Building2,
        subLabel: f.siege_localisation ?? undefined,
    }))

    const set = <K extends keyof typeof form>(key: K) =>
        (value: string) => setForm(f => ({ ...f, [key]: value }))

    // Days from now to dechargement (negative = overdue)
    const alertDays = useMemo(
        () => (form.invoice_date ? null : daysFromDechargement(form.prev_dechargement_at || null)),
        [form.prev_dechargement_at, form.invoice_date]
    )

    const showInvoiceAlert =
        form.status !== "annulé" &&
        alertDays !== null &&
        alertDays <= INVOICE_ALERT_DAYS

    async function handleSave() {
        setLoading(true)
        try {
            await update(row.id, {
                container_no:         form.container_no.trim().toUpperCase(),
                conteneur_no_raw:     form.conteneur_no_raw.trim() || null,
                fournisseur_id:       form.fournisseur_id || null,
                status:               form.status,
                status_auto:          false, // sauvegarder = confirmer
                invoice_date:         form.invoice_date || null,
                notes:                form.notes || null,
                transport_mode:       form.transport_mode || null,
                departure_date:       form.departure_date || null,
                port_arrival_date:    form.port_arrival_date || null,
                total_weight_kg:      form.total_weight_kg ? Number(form.total_weight_kg) : null,
                total_qty:            form.total_qty ? Number(form.total_qty) : null,
                // Convert local datetime to UTC ISO before sending to Supabase
                prev_dechargement_at: form.prev_dechargement_at
                    ? new Date(form.prev_dechargement_at).toISOString()
                    : null,
            })
            onClose()
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete() {
        await remove(row.id)
        onClose()
    }

    return (
        <FormSheet
            open
            onClose={onClose}
            icon={SquarePen}
            title={<span className="font-mono">{row.container_no}</span>}
            description="Modifier les informations de cet arrivage"
            onSubmit={handleSave}
            loading={loading}
            onDelete={canDelete ? handleDelete : undefined}
            deleteLabel="Supprimer l'arrivage"
            deleteConfirm={{
                title: `Supprimer l'arrivage ${row.container_no} ?`,
                description:
                    "Cette action est définitive. L'arrivage disparaîtra du tableau, de l'export et de la newsletter ; son historique de modifications, lui, est conservé.",
            }}
        >

                        {/* ── Alerte facture manquante ─────────────────────────── */}
                        {showInvoiceAlert && alertDays !== null && (
                            <div className="animate-slide-in-top flex items-start gap-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 px-3.5 py-3">
                                <AlertTriangle size={15} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700 dark:text-red-300 leading-snug">
                                    <span className="font-semibold">Facture manquante —</span>{" "}
                                    {dechargementAlertText(alertDays)}.
                                    Renseigner la date de facture ci-dessous.
                                </p>
                            </div>
                        )}

                        {/* ── Statut auto ──────────────────────────────────────── */}
                        {form.status_auto && (
                            <div className="animate-slide-in-top flex items-start gap-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-3.5 py-3">
                                <Info size={15} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="flex-1 text-xs text-amber-700 dark:text-amber-300 leading-snug">
                                    Le statut{" "}
                                    <span className="font-semibold">
                                        {ARRIVAGE_STATUS_CONFIG[form.status]?.label ?? form.status}
                                    </span>{" "}
                                    a été mis à jour automatiquement. Confirmez ou choisissez un autre statut.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, status_auto: false }))}
                                    className="text-2xs font-medium text-amber-600 dark:text-amber-400 hover:underline shrink-0 leading-none mt-0.5"
                                >
                                    OK
                                </button>
                            </div>
                        )}

                        {/* ── Identification ───────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Identification
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="container_no" className="text-sm font-medium">
                                    N° Conteneur
                                </Label>
                                <Input
                                    id="container_no"
                                    value={form.container_no}
                                    onChange={e => set("container_no")(e.target.value.toUpperCase())}
                                    className="h-10 font-mono uppercase"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="conteneur_no_raw" className="text-sm font-medium">
                                    N° Interne{" "}
                                    <span className="text-muted-foreground text-xs font-normal">(optionnel)</span>
                                </Label>
                                <Input
                                    id="conteneur_no_raw"
                                    placeholder="ex: GR 123"
                                    value={form.conteneur_no_raw}
                                    onChange={e => set("conteneur_no_raw")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <SearchSelect
                                options={fournisseurOptions}
                                value={form.fournisseur_id}
                                onChange={set("fournisseur_id")}
                                placeholder="Rechercher…"
                                variant="input"
                                size="md"
                                label="Fournisseur"
                                emptyMessage="Aucun fournisseur"
                            />
                        </div>

                        <Separator />

                        {/* ── Prévision déchargement ───────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Prévision déchargement
                        </p>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="prev_dechargement_at" className="text-sm font-medium">
                                Date &amp; heure prévues
                            </Label>
                            <Input
                                id="prev_dechargement_at"
                                type="datetime-local"
                                value={form.prev_dechargement_at}
                                onChange={e => set("prev_dechargement_at")(e.target.value)}
                                className={cn(
                                    "h-10",
                                    showInvoiceAlert && "border-red-300 dark:border-red-800 focus-visible:ring-red-400/30"
                                )}
                            />
                            {form.prev_dechargement_at && (
                                <p className={cn(
                                    "text-xs capitalize",
                                    showInvoiceAlert ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                                )}>
                                    {new Date(form.prev_dechargement_at).toLocaleDateString("fr-FR", { weekday: "long" })}
                                    {alertDays !== null && (
                                        <span className="ml-1.5 not-italic font-medium">
                                            · {jLabel(alertDays)}
                                        </span>
                                    )}
                                </p>
                            )}
                        </div>

                        <Separator />

                        {/* ── Facturation ───────────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Facturation
                        </p>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="invoice_date" className={cn(
                                "text-sm font-medium",
                                showInvoiceAlert && "text-red-600 dark:text-red-400"
                            )}>
                                Date facture
                                {showInvoiceAlert && <span className="ml-1 text-red-500">*</span>}
                            </Label>
                            <Input
                                id="invoice_date"
                                type="date"
                                value={form.invoice_date}
                                onChange={e => set("invoice_date")(e.target.value)}
                                className={cn(
                                    "h-10",
                                    showInvoiceAlert && "border-red-300 dark:border-red-800 focus-visible:ring-red-400/30"
                                )}
                            />
                        </div>

                        <Separator />

                        {/* ── Statut ────────────────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Statut
                        </p>

                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium">Statut</Label>
                            <Select
                                value={form.status}
                                onValueChange={(v) =>
                                    setForm(f => ({ ...f, status: v as ArrivageStatus, status_auto: false }))
                                }
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        {/* ── Transport ─────────────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Transport
                        </p>

                        <div className="flex flex-col gap-2">
                            <Label className="text-sm font-medium">Mode</Label>
                            <Select value={form.transport_mode} onValueChange={set("transport_mode")}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Sélectionner…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TRANSPORT_MODES.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="departure_date" className="text-sm font-medium">Départ</Label>
                                <Input
                                    id="departure_date"
                                    type="date"
                                    value={form.departure_date}
                                    onChange={e => set("departure_date")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="port_arrival_date" className="text-sm font-medium">Arrivée Le Havre</Label>
                                <Input
                                    id="port_arrival_date"
                                    type="date"
                                    value={form.port_arrival_date}
                                    onChange={e => set("port_arrival_date")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="poids" className="text-sm font-medium">Poids (kg)</Label>
                                <Input
                                    id="poids"
                                    type="number"
                                    min={0}
                                    value={form.total_weight_kg}
                                    onChange={e => set("total_weight_kg")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="qty" className="text-sm font-medium">Quantité en colis</Label>
                                <Input
                                    id="qty"
                                    type="number"
                                    min={0}
                                    value={form.total_qty}
                                    onChange={e => set("total_qty")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* ── Notes ─────────────────────────────────────────────── */}
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Commentaire libre…"
                                value={form.notes}
                                onChange={e => set("notes")(e.target.value)}
                                className="resize-none h-20 text-sm"
                            />
                        </div>
        </FormSheet>
    )
}
