import { useState } from "react"
import { PackagePlus, Building2 } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
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
import {
    useArrivageManuelContext,
    useReferentialContext,
} from "@/features/stock/hooks/context/StockProvider"
import { TRANSPORT_MODES } from "@/features/stock/constants"

interface Props {
    open: boolean
    onClose: () => void
}

const EMPTY_FORM = {
    fournisseur_id:   "",
    container_no:     "",
    conteneur_no_raw: "",
    total_weight_kg:  "",
    total_qty:        "",
    transport_mode:   "",
    departure_date:   "",
    invoice_date:     "",
}

export default function ArrivageLimitedCreationSheet({ open, onClose }: Props) {
    const { create } = useArrivageManuelContext()
    const { fournisseurs } = useReferentialContext()

    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)

    const fournisseurOptions = fournisseurs.map(f => ({
        value: f.id,
        label: f.name,
        icon: Building2,
        subLabel: f.siege_localisation ?? undefined,
    }))

    const set = <K extends keyof typeof form>(key: K) =>
        (value: string) => setForm(f => ({ ...f, [key]: value }))

    function reset() {
        setForm(EMPTY_FORM)
    }

    const isValid = !!form.fournisseur_id && !!form.container_no.trim()

    async function handleSubmit() {
        setLoading(true)
        const result = await create({
            container_no:     form.container_no.trim().toUpperCase(),
            fournisseur_id:   form.fournisseur_id || null,
            conteneur_no_raw: form.conteneur_no_raw.trim() || null,
            total_weight_kg:  form.total_weight_kg ? Number(form.total_weight_kg) : null,
            total_qty:        form.total_qty ? Number(form.total_qty) : null,
            transport_mode:   form.transport_mode || null,
            departure_date:   form.departure_date || null,
            invoice_date:     form.invoice_date || null,
        })
        setLoading(false)
        if (result) {
            reset()
            onClose()
        }
    }

    function handleClose() {
        reset()
        onClose()
    }

    return (
        <FormSheet
            open={open}
            onClose={handleClose}
            icon={PackagePlus}
            title="Nouvel arrivage"
            description="Saisie manuelle — les données facture sont renseignées via l'import Excel."
            onSubmit={handleSubmit}
            submitLabel="Créer l'arrivage"
            submitDisabled={!isValid}
            loading={loading}
        >

                        {/* ── Identification ───────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Identification
                        </p>

                        <div className="flex flex-col gap-2">
                            
                            <SearchSelect
                                options={fournisseurOptions}
                                value={form.fournisseur_id}
                                onChange={set("fournisseur_id")}
                                placeholder="Rechercher un fournisseur…"
                                variant="input"
                                size="md"
                                showValidation
                                required
                                label="Fournisseur"
                                emptyMessage="Aucun fournisseur"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="container_no" className="text-sm font-medium">
                                N° Conteneur <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="container_no"
                                placeholder="ex: CSLU6080095"
                                value={form.container_no}
                                onChange={e => set("container_no")(e.target.value.toUpperCase())}
                                className="h-10 font-mono uppercase"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="conteneur_no_raw" className="text-sm font-medium">
                                    N° Conteneur interne{" "}
                                    <span className="text-muted-foreground text-xs font-normal">(optionnel)</span>
                                </Label>
                                <Input
                                    id="conteneur_no_raw"
                                    placeholder="ex: GR 123, INDE 456"
                                    value={form.conteneur_no_raw}
                                    onChange={e => set("conteneur_no_raw")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="invoice_date" className="text-sm font-medium">
                                    Date facture{" "}
                                    <span className="text-muted-foreground text-xs font-normal">(optionnel)</span>
                                </Label>
                                <Input
                                    id="invoice_date"
                                    type="date"
                                    value={form.invoice_date}
                                    onChange={e => set("invoice_date")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* ── Transport ─────────────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Transport
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label className="text-sm font-medium">Mode de transport</Label>
                                <Select
                                    value={form.transport_mode}
                                    onValueChange={set("transport_mode")}
                                >
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
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="departure_date" className="text-sm font-medium">
                                    Date de départ{" "}
                                    <span className="text-muted-foreground text-xs font-normal">(optionnel)</span>
                                </Label>
                                <Input
                                    id="departure_date"
                                    type="date"
                                    value={form.departure_date}
                                    onChange={e => set("departure_date")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* ── Poids & quantité ──────────────────────────────────── */}
                        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Poids &amp; quantité
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="poids" className="text-sm font-medium">Poids (kg)</Label>
                                <Input
                                    id="poids"
                                    type="number"
                                    min={0}
                                    placeholder="ex: 18500"
                                    value={form.total_weight_kg}
                                    onChange={e => set("total_weight_kg")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="qty" className="text-sm font-medium">
                                    Quantité en colis{" "}
                                    <span className="text-muted-foreground text-xs font-normal">(optionnel)</span>
                                </Label>
                                <Input
                                    id="qty"
                                    type="number"
                                    min={0}
                                    placeholder="ex: 548"
                                    value={form.total_qty}
                                    onChange={e => set("total_qty")(e.target.value)}
                                    className="h-10"
                                />
                            </div>
                        </div>
        </FormSheet>
    )
}
