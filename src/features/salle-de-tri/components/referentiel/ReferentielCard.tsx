import { useState, type ReactNode } from "react"
import { Plus, type LucideIcon } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"

interface AddField {
    key: string
    placeholder: string
    /** Classe de largeur du champ (le libellé prend le reste). */
    className?: string
    /** Mise en forme à la frappe (ex. majuscules d'un code). */
    format?: (raw: string) => string
}

interface ReferentielCardProps {
    icon: LucideIcon
    title: string
    /** Compte affiché à côté du titre. */
    count: number
    description: string
    /** Absent : pas de droit de création, pas de ligne d'ajout. */
    add?: {
        fields: AddField[]
        label: string
        /** Rend `true` si l'ajout a abouti : les champs se vident. */
        onAdd: (values: Record<string, string>) => Promise<boolean>
    }
    /** Contrôle à droite de l'en-tête (recherche…). */
    toolbar?: ReactNode
    className?: string
    children: ReactNode
}

/**
 * Cadre d'une liste de référentiel légère : titre et compte, une ligne
 * d'ajout directe (Entrée valide, sans ouvrir de sheet), puis la liste.
 */
export function ReferentielCard({ icon: Icon, title, count, description, add, toolbar, className, children }: ReferentielCardProps) {
    const empty = Object.fromEntries((add?.fields ?? []).map((f) => [f.key, ""]))
    const [values, setValues] = useState<Record<string, string>>(empty)
    const [busy, setBusy] = useState(false)
    const ready = add?.fields.every((f) => values[f.key]?.trim()) ?? false

    const submit = async () => {
        if (!add || !ready || busy) return
        setBusy(true)
        try {
            if (await add.onAdd(values)) setValues(empty)
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-card", className)}>
            <header className="flex flex-col gap-3 border-b border-border p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                        <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Icon size={16} aria-hidden /></span>
                        <div className="min-w-0">
                            <h3 className="flex items-baseline gap-2 text-sm font-semibold">
                                {title}
                                <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
                            </h3>
                            <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                    </div>
                    {toolbar}
                </div>

                {add && (
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                            e.preventDefault()
                            void submit()
                        }}
                    >
                        {add.fields.map((f) => (
                            <Input
                                key={f.key}
                                value={values[f.key] ?? ""}
                                onChange={(e) => setValues({ ...values, [f.key]: f.format ? f.format(e.target.value) : e.target.value })}
                                placeholder={f.placeholder}
                                aria-label={f.placeholder}
                                className={cn("h-9 text-sm", f.className ?? "min-w-0 flex-1")}
                            />
                        ))}
                        <Button type="submit" size="sm" className="h-9 shrink-0" disabled={!ready} loading={busy} aria-label={add.label}>
                            <Plus size={14} />
                            <span className="hidden sm:inline">{add.label}</span>
                        </Button>
                    </form>
                )}
            </header>
            {children}
        </section>
    )
}
