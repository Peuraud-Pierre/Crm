import { useState } from "react"
import { Check, X, type LucideIcon } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Switch } from "@/shared/ui/atoms/switch"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"

/**
 * Édition en ligne et création d'un référentiel À CHAMPS TEXTE (trieurs,
 * types de sortie, boutiques, pastilles) pour `ReferentialPanel`. Un
 * référentiel à champs plus riches (listes, contrôles) écrit ses propres
 * formulaires.
 */

export interface FieldDef {
    key: string
    label: string
    value?: string
    placeholder?: string
    /** Champ facultatif : peut rester vide. */
    optional?: boolean
}

export function EditRow({ fields, actif, onSave, onCancel }: {
    fields: FieldDef[]
    actif: boolean
    onSave: (values: Record<string, string>, actif: boolean) => void
    onCancel: () => void
}) {
    const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value ?? ""])))
    const [enabled, setEnabled] = useState(actif)
    const valid = fields.every((f) => f.optional || values[f.key].trim())

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && valid) onSave(values, enabled)
        if (e.key === "Escape") onCancel()
    }

    return (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-end dark:bg-primary/10">
            <div className="flex w-full flex-col gap-3 sm:flex-row">
                {fields.map((f, i) => (
                    <div key={f.key} className="flex flex-1 flex-col gap-1.5">
                        <Label className="ml-0.5 text-xs font-medium text-muted-foreground">{f.label}</Label>
                        <Input
                            value={values[f.key]}
                            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                            onKeyDown={onKeyDown}
                            autoFocus={i === 0}
                            className="h-9 text-sm"
                        />
                    </div>
                ))}
                <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-2">
                    <Switch checked={enabled} onCheckedChange={setEnabled} />
                    Actif
                </label>
            </div>
            <div className="flex gap-2">
                <Button size="sm" onClick={() => onSave(values, enabled)} disabled={!valid} aria-label="Enregistrer">
                    <Check size={14} />
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Annuler">
                    <X size={14} />
                </Button>
            </div>
        </div>
    )
}

export function CreateSheet({ open, onClose, icon, title, fields, onCreate }: {
    open: boolean
    onClose: () => void
    icon: LucideIcon
    title: string
    fields: FieldDef[]
    onCreate: (values: Record<string, string>) => Promise<boolean>
}) {
    const empty = () => Object.fromEntries(fields.map((f) => [f.key, ""]))
    const [values, setValues] = useState(empty)
    const [loading, setLoading] = useState(false)
    const close = () => {
        setValues(empty())
        onClose()
    }

    return (
        <FormSheet
            open={open}
            onClose={close}
            icon={icon}
            title={title}
            size="md"
            loading={loading}
            submitDisabled={!fields.every((f) => f.optional || values[f.key].trim())}
            onSubmit={async () => {
                setLoading(true)
                const ok = await onCreate(values)
                setLoading(false)
                if (ok) close()
            }}
        >
            <div className="mt-4 flex flex-col gap-5">
                {fields.map((f, i) => (
                    <div key={f.key} className="flex flex-col gap-2">
                        <Label className="text-sm font-semibold">{f.label} {!f.optional && <span className="text-destructive">*</span>}</Label>
                        <Input
                            value={values[f.key]}
                            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                            placeholder={f.placeholder}
                            autoFocus={i === 0}
                            className="h-10"
                        />
                    </div>
                ))}
            </div>
        </FormSheet>
    )
}
