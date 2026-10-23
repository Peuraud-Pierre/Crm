import { Check, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// Critères de robustesse alignés sur isPasswordValid
// (features/administration/utils/format.ts) : un mot de passe accepté à la
// création d'un compte doit l'être aussi à sa réinitialisation.
const PASSWORD_CRITERIA: { label: string; test: (p: string) => boolean }[] = [
    { label: "8 caractères minimum", test: (p) => p.length >= 8 },
    { label: "Une majuscule", test: (p) => /[A-Z]/.test(p) },
    { label: "Une minuscule", test: (p) => /[a-z]/.test(p) },
    { label: "Un chiffre", test: (p) => /\d/.test(p) },
    { label: "Un caractère spécial", test: (p) => /[^\w\s]/.test(p) },
]

/** `true` quand tous les critères affichés par la jauge sont remplis. */
export function isPasswordStrong(password: string): boolean {
    return PASSWORD_CRITERIA.every((c) => c.test(password))
}

/** Jauge de robustesse + liste des critères du mot de passe saisi. */
export function PasswordStrength({ password }: { password: string }) {
    const passedCount = PASSWORD_CRITERIA.filter((c) =>
        c.test(password)
    ).length
    const strengthPct = (passedCount / PASSWORD_CRITERIA.length) * 100
    const strengthColor =
        passedCount <= 2
            ? "bg-destructive"
            : passedCount <= 4
              ? "bg-warning"
              : "bg-success"

    return (
        <div className="space-y-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                    className={cn(
                        "h-full transition-[width,background-color] duration-slow",
                        strengthColor
                    )}
                    style={{ width: `${strengthPct}%` }}
                />
            </div>
            <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                {PASSWORD_CRITERIA.map((c) => {
                    const ok = c.test(password)
                    return (
                        <li
                            key={c.label}
                            className={cn(
                                "flex items-center gap-1.5 text-xs",
                                ok ? "text-success" : "text-muted-foreground"
                            )}
                        >
                            {ok ? (
                                <Check className="h-3 w-3 shrink-0" />
                            ) : (
                                <X className="h-3 w-3 shrink-0" />
                            )}
                            {c.label}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
