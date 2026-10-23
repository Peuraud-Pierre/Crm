import { Monitor, Moon, Palette, Sun } from "lucide-react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import type { ThemeChoice } from "@/features/profile/types"

interface AppearanceCardProps {
    theme: ThemeChoice
    disabled: boolean
    onChange: (theme: ThemeChoice) => void
}

const THEME_OPTIONS: {
    value: ThemeChoice
    label: string
    hint: string
    icon: typeof Sun
}[] = [
    { value: "light", label: "Clair", hint: "Toujours clair", icon: Sun },
    { value: "dark", label: "Sombre", hint: "Toujours sombre", icon: Moon },
    {
        value: "system",
        label: "Système",
        hint: "Suit votre appareil",
        icon: Monitor,
    },
]

export function AppearanceCard({
    theme,
    disabled,
    onChange,
}: AppearanceCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Apparence
                </CardTitle>
                <CardDescription>
                    Le thème est enregistré sur votre compte et vous suit d'un
                    appareil à l'autre.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div
                    role="radiogroup"
                    aria-label="Thème de l'interface"
                    className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                    {THEME_OPTIONS.map(({ value, label, hint, icon: Icon }) => {
                        const active = theme === value
                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                disabled={disabled}
                                onClick={() => onChange(value)}
                                className={cn(
                                    "flex flex-col items-start gap-1 rounded-lg border border-border p-4 text-left transition-colors",
                                    "hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
                                    active && "border-primary bg-primary/5"
                                )}
                            >
                                <span
                                    className={cn(
                                        "rounded-md p-2 ring-1",
                                        active
                                            ? "bg-primary/10 text-primary ring-primary/20"
                                            : "bg-muted text-muted-foreground ring-border"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-medium">
                                    {label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {hint}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
