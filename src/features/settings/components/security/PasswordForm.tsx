import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { cn } from "@/shared/lib/utils"
import { usePasswordManagerOffset } from "@/shared/hooks/usePasswordManagerOffset"
import { PasswordStrength } from "@/shared/ui/molecules/password-strength"
import { updateUserPassword } from "@/features/profile/services/profileService"

interface PasswordInputProps {
    id: string
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

function PasswordInput({
    id,
    label,
    value,
    onChange,
    placeholder,
}: PasswordInputProps) {
    const [show, setShow] = useState(false)
    const { ref, hasOverlay } = usePasswordManagerOffset<HTMLDivElement>()

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div ref={ref} className="relative">
                <Input
                    id={id}
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    // On laisse plus de place à droite quand un gestionnaire
                    // de mots de passe injecte sa propre icône.
                    className={cn(hasOverlay ? "pr-16" : "pr-10")}
                />
                <button
                    type="button"
                    data-password-toggle="true"
                    onClick={() => setShow((previous) => !previous)}
                    aria-label={
                        show
                            ? "Masquer le mot de passe"
                            : "Afficher le mot de passe"
                    }
                    className={cn(
                        "absolute inset-y-0 flex items-center text-muted-foreground hover:text-foreground focus-visible:outline-none",
                        // Décalé vers la gauche pour ne pas être recouvert
                        // par l'icône de l'extension.
                        hasOverlay ? "right-8 pr-1" : "right-0 pr-3"
                    )}
                >
                    {show ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    )
}

const EMPTY_FORM = { newPassword: "", confirmPassword: "" }

export function PasswordForm() {
    const [form, setForm] = useState(EMPTY_FORM)
    const [loading, setLoading] = useState(false)

    const set =
        <K extends keyof typeof form>(key: K) =>
        (value: string) =>
            setForm((previous) => ({ ...previous, [key]: value }))

    const filled = form.newPassword.length > 0 && form.confirmPassword.length > 0
    // La divergence n'est signalée qu'une fois la confirmation commencée.
    const mismatch =
        form.confirmPassword.length > 0 &&
        form.newPassword !== form.confirmPassword
    const isValid = filled && !mismatch

    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        // Garde explicite : la confirmation était auparavant saisie puis
        // ignorée, le mot de passe partait sans être vérifié.
        if (!isValid) return

        setLoading(true)
        try {
            await updateUserPassword(form.newPassword)
            setForm(EMPTY_FORM)
            toast.success("Mot de passe mis à jour avec succès.")
        } catch (err) {
            console.error("[PasswordForm] updateUserPassword:", err)
            toast.error(
                err instanceof Error
                    ? `Erreur lors de la mise à jour du mot de passe : ${err.message}`
                    : "Erreur lors de la mise à jour du mot de passe."
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordInput
                id="newPassword"
                label="Nouveau mot de passe"
                value={form.newPassword}
                onChange={set("newPassword")}
                placeholder="Entrez un nouveau mot de passe"
            />

            {form.newPassword.length > 0 && (
                <PasswordStrength password={form.newPassword} />
            )}

            <PasswordInput
                id="confirmPassword"
                label="Confirmer le mot de passe"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Confirmez le mot de passe"
            />

            {mismatch && (
                <p role="alert" className="text-xs text-destructive">
                    Les deux mots de passe ne correspondent pas.
                </p>
            )}

            <Button type="submit" disabled={!isValid} loading={loading}>
                Modifier le mot de passe
            </Button>
        </form>
    )
}
