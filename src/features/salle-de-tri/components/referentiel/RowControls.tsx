import { useState } from "react"
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Switch } from "@/shared/ui/atoms/switch"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { ConfirmAction } from "@/shared/ui/molecules/confirm-action"
import { cn } from "@/shared/lib/utils"

/** Bascule actif / inactif d'une ligne ; lecture seule sans droit. */
export function ActifSwitch({ actif, label, onChange }: { actif: boolean; label: string; onChange?: (actif: boolean) => void }) {
    if (!onChange) {
        return actif ? null : <span className="text-xs italic text-muted-foreground">Inactif</span>
    }
    return (
        <Switch
            checked={actif}
            onCheckedChange={onChange}
            aria-label={`${label} : ${actif ? "actif" : "inactif"}`}
            title={actif ? "Actif — proposé à la saisie" : "Inactif — masqué à la saisie, gardé dans l'historique"}
        />
    )
}

interface RowMenuProps {
    label: string
    onEdit?: () => void
    /** Suppression : description de ce qu'elle implique. */
    remove?: { hint: string; onConfirm: () => Promise<boolean> }
}

/** Menu ⋯ d'une ligne : modifier, supprimer (confirmé). Rien sans droit. */
export function RowMenu({ label, onEdit, remove }: RowMenuProps) {
    const [confirm, setConfirm] = useState(false)
    if (!onEdit && !remove) return null
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground md:h-8 md:w-8" aria-label={`Actions : ${label}`}>
                        <MoreHorizontal size={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {onEdit && (
                        <DropdownMenuItem onSelect={onEdit}>
                            <Pencil size={14} />
                            Modifier
                        </DropdownMenuItem>
                    )}
                    {remove && (
                        <DropdownMenuItem onSelect={() => setConfirm(true)} className="text-destructive focus:text-destructive">
                            <Trash2 size={14} />
                            Supprimer
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
            {remove && (
                <ConfirmAction
                    open={confirm}
                    onOpenChange={setConfirm}
                    title={`Supprimer ${label} ?`}
                    description={remove.hint}
                    confirmLabel="Supprimer"
                    destructive
                    onConfirm={remove.onConfirm}
                />
            )}
        </>
    )
}

interface InlineEditProps {
    fields: { key: string; label: string; value: string; className?: string; format?: (raw: string) => string }[]
    onCancel: () => void
    /** Rend `true` si l'enregistrement a abouti. */
    onSave: (values: Record<string, string>) => Promise<boolean>
}

/** Édition sur place d'une ligne : Entrée enregistre, Échap annule. */
export function InlineEdit({ fields, onCancel, onSave }: InlineEditProps) {
    const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value])))
    const [busy, setBusy] = useState(false)
    const ready = fields.every((f) => values[f.key]?.trim())

    const save = async () => {
        if (!ready || busy) return
        setBusy(true)
        try {
            if (await onSave(values)) onCancel()
        } finally {
            setBusy(false)
        }
    }

    return (
        <form
            className="flex w-full items-center gap-2"
            onSubmit={(e) => {
                e.preventDefault()
                void save()
            }}
            onKeyDown={(e) => e.key === "Escape" && onCancel()}
        >
            {fields.map((f, i) => (
                <Input
                    key={f.key}
                    autoFocus={i === 0}
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: f.format ? f.format(e.target.value) : e.target.value })}
                    aria-label={f.label}
                    className={cn("h-8 text-sm", f.className ?? "min-w-0 flex-1")}
                />
            ))}
            <Button type="submit" size="sm" className="h-8 w-8 shrink-0 p-0" disabled={!ready} loading={busy} aria-label="Enregistrer">
                <Check size={14} />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={onCancel} aria-label="Annuler">
                <X size={14} />
            </Button>
        </form>
    )
}
