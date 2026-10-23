import { parseList, serializeList } from "@/shared/lib/settingsList"
import type {
    WidgetSetting,
    WidgetSettingOption,
    WidgetSettingValue,
} from "@/shared/types/widget.types"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Switch } from "@/shared/ui/atoms/switch"
import { Textarea } from "@/shared/ui/atoms/textarea"

interface Props {
    setting: WidgetSetting
    value: WidgetSettingValue | undefined
    onChange: (value: WidgetSettingValue) => void
    /**
     * Options d'un `multiselect` dont la source est résolue au rendu
     * (`optionsSource`). Le panneau les calcule et les passe ici : ce
     * composant ne connaît ni l'auth ni le routage, il ne fait que rendre
     * les options qu'on lui donne.
     */
    resolvedOptions?: WidgetSettingOption[]
}

/**
 * Un réglage, rendu selon son type déclaré. Chaque branche retombe sur
 * `defaultValue` quand la valeur enregistrée n'est pas du type attendu :
 * le JSON vient de la base, il a pu être écrit par une version
 * antérieure du widget.
 */
export function SettingField({
    setting,
    value,
    onChange,
    resolvedOptions,
}: Props) {
    const id = `setting-${setting.key}`
    const describedBy = setting.description ? `${id}-aide` : undefined

    if (setting.type === "multiselect") {
        const options = resolvedOptions ?? setting.options ?? []
        const selected = parseList(
            typeof value === "string" ? value : setting.defaultValue
        )

        function toggle(optionValue: string, checked: boolean) {
            const next = checked
                ? [...selected, optionValue]
                : selected.filter((key) => key !== optionValue)
            onChange(serializeList(next))
        }

        return (
            <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <Label>{setting.label}</Label>
                    <Hint id={describedBy} text={setting.description} />
                </div>

                {options.length === 0 ? (
                    // Pas un état vide au sens du DESIGN_SYSTEM §13.8 :
                    // une notice d'une ligne au fil du contenu, pas un
                    // bloc centré occupant la zone.
                    <p className="text-xs text-muted-foreground">
                        Aucun choix disponible.
                    </p>
                ) : (
                    <div
                        role="group"
                        aria-describedby={describedBy}
                        aria-label={setting.label}
                        className="flex max-h-64 flex-col gap-0.5 overflow-y-auto rounded-md border border-border/60 p-1"
                    >
                        {options.map((option) => {
                            const checked = selected.includes(option.value)
                            const optionId = `${id}-${option.value}`

                            return (
                                <label
                                    key={option.value}
                                    htmlFor={optionId}
                                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors duration-fast hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Checkbox
                                        id={optionId}
                                        checked={checked}
                                        onCheckedChange={(next) =>
                                            toggle(option.value, next === true)
                                        }
                                    />
                                    <span className="min-w-0 truncate">
                                        {option.label}
                                    </span>
                                </label>
                            )
                        })}
                    </div>
                )}

                {/* Rien de coché ne veut pas dire une liste vide : c'est
                    l'état par défaut d'un module qu'on vient de poser, et
                    il doit montrer quelque chose. L'afficher évite de
                    prendre le comportement pour une panne. */}
                {selected.length === 0 && options.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Aucune sélection : tout est affiché.
                    </p>
                )}
            </div>
        )
    }

    if (setting.type === "boolean") {
        const checked =
            typeof value === "boolean" ? value : setting.defaultValue

        return (
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <Label htmlFor={id}>{setting.label}</Label>
                    <Hint id={describedBy} text={setting.description} />
                </div>
                <Switch
                    id={id}
                    checked={checked}
                    aria-describedby={describedBy}
                    onCheckedChange={onChange}
                />
            </div>
        )
    }

    if (setting.type === "select") {
        const current = typeof value === "string" ? value : setting.defaultValue

        return (
            <Field setting={setting} id={id} describedBy={describedBy}>
                <Select value={current} onValueChange={onChange}>
                    <SelectTrigger id={id} aria-describedby={describedBy}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {setting.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>
        )
    }

    if (setting.type === "number") {
        const current = typeof value === "number" ? value : setting.defaultValue

        return (
            <Field setting={setting} id={id} describedBy={describedBy}>
                <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={setting.min}
                    max={setting.max}
                    value={current}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                        const parsed = Number(e.target.value)
                        if (Number.isNaN(parsed)) return
                        onChange(
                            Math.min(Math.max(parsed, setting.min), setting.max)
                        )
                    }}
                />
            </Field>
        )
    }

    const current = typeof value === "string" ? value : setting.defaultValue

    return (
        <Field setting={setting} id={id} describedBy={describedBy}>
            {setting.multiline ? (
                <Textarea
                    id={id}
                    rows={6}
                    maxLength={setting.maxLength}
                    placeholder={setting.placeholder}
                    value={current}
                    aria-describedby={describedBy}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <Input
                    id={id}
                    maxLength={setting.maxLength}
                    placeholder={setting.placeholder}
                    value={current}
                    aria-describedby={describedBy}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}
        </Field>
    )
}

interface FieldProps {
    setting: WidgetSetting
    id: string
    describedBy: string | undefined
    children: React.ReactNode
}

/** Libellé au-dessus, champ au milieu, explication en dessous. */
function Field({ setting, id, describedBy, children }: FieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{setting.label}</Label>
            {children}
            <Hint id={describedBy} text={setting.description} />
        </div>
    )
}

function Hint({ id, text }: { id?: string; text?: string }) {
    if (!text) return null

    return (
        <p id={id} className="text-xs text-muted-foreground">
            {text}
        </p>
    )
}
