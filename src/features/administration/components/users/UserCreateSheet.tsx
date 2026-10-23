import { useState } from "react"
import { Eye, EyeOff, Plus } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/shared/ui/atoms/sheet"
import { Switch } from "@/shared/ui/atoms/switch"
import { cn } from "@/shared/lib/utils"
import { isEmailValid, isPasswordValid } from "../../utils/format"
import type {
    CreateUserInput,
    EntityOption,
    InviteUserInput,
} from "../../types"
import { FicheSection } from "../shared/FicheSection"
import { PasswordStrength } from "@/shared/ui/molecules/password-strength"

const EMPTY_FORM = {
    email: "",
    full_name: "",
    role: "",
    service: "",
    password: "",
    invite: false,
}

interface UserCreateSheetProps {
    roles: EntityOption[]
    services: EntityOption[]
    /** users.create absent → bouton désactivé. */
    canCreate: boolean
    onCreate: (input: CreateUserInput) => Promise<boolean>
    onInvite: (input: InviteUserInput) => Promise<boolean>
}

/**
 * Bouton « Nouvel utilisateur » + fiche de création en panneau latéral,
 * sectionnée Identité / Accès / Authentification.
 */
export function UserCreateSheet({
    roles,
    services,
    canCreate,
    onCreate,
    onInvite,
}: UserCreateSheetProps) {
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState(EMPTY_FORM)
    const [showPassword, setShowPassword] = useState(false)
    const [touched, setTouched] = useState({ email: false, password: false })
    const [submitting, setSubmitting] = useState(false)

    const emailError = touched.email && form.email && !isEmailValid(form.email)
    const passwordError =
        touched.password && form.password && !isPasswordValid(form.password)

    const isValid =
        !!form.email &&
        isEmailValid(form.email) &&
        !!form.full_name &&
        (form.invite || (!!form.password && isPasswordValid(form.password))) &&
        !!form.role &&
        !!form.service

    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (!next) {
            setForm(EMPTY_FORM)
            setShowPassword(false)
            setTouched({ email: false, password: false })
            setSubmitting(false)
        }
    }

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!isValid) return
        setSubmitting(true)
        const base = {
            email: form.email,
            full_name: form.full_name,
            role: form.role,
            service: form.service,
        }
        const ok = form.invite
            ? await onInvite(base)
            : await onCreate({ ...base, password: form.password })
        if (ok) {
            handleOpenChange(false)
        } else {
            setSubmitting(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={handleOpenChange}>
            <SheetTrigger asChild>
                <Button
                    className="shrink-0"
                    disabled={!canCreate}
                    aria-label="Nouvel utilisateur"
                >
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Nouvel utilisateur</span>
                </Button>
            </SheetTrigger>
            <SheetContent
                side="right"
                className="w-full overflow-y-auto sm:max-w-xl"
            >
                <SheetHeader>
                    <SheetTitle>Nouvel utilisateur</SheetTitle>
                    <SheetDescription>
                        Créez le compte directement ou envoyez une invitation
                        par email.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="mt-6 space-y-8">
                    <FicheSection title="Identité">
                        <div className="space-y-2">
                            <Label htmlFor="create_email">Email *</Label>
                            <Input
                                id="create_email"
                                type="email"
                                autoComplete="email"
                                autoFocus
                                placeholder="email@company.com"
                                value={form.email}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        email: e.target.value,
                                    }))
                                }
                                onBlur={() =>
                                    setTouched((prev) => ({
                                        ...prev,
                                        email: true,
                                    }))
                                }
                                aria-invalid={!!emailError}
                                className={cn(
                                    emailError && "border-destructive"
                                )}
                                required
                            />
                            {emailError && (
                                <p
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    Veuillez saisir un email valide.
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create_full_name">
                                Nom complet *
                            </Label>
                            <Input
                                id="create_full_name"
                                autoComplete="name"
                                placeholder="Prénom Nom"
                                value={form.full_name}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        full_name: e.target.value,
                                    }))
                                }
                            />
                        </div>
                    </FicheSection>

                    <FicheSection title="Accès">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create_role">Rôle *</Label>
                                <Select
                                    value={form.role}
                                    onValueChange={(role) =>
                                        setForm((prev) => ({ ...prev, role }))
                                    }
                                >
                                    <SelectTrigger id="create_role">
                                        <SelectValue placeholder="Sélectionner un rôle" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem
                                                key={role.id}
                                                value={role.id}
                                            >
                                                {role.nom}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="create_service">
                                    Service *
                                </Label>
                                <Select
                                    value={form.service}
                                    onValueChange={(service) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            service,
                                        }))
                                    }
                                >
                                    <SelectTrigger id="create_service">
                                        <SelectValue placeholder="Sélectionner un service" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map((service) => (
                                            <SelectItem
                                                key={service.id}
                                                value={service.id}
                                            >
                                                {service.nom}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </FicheSection>

                    <FicheSection title="Authentification">
                        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div>
                                <p className="text-sm font-medium">
                                    Inviter par email
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    L&apos;utilisateur choisira son mot de
                                    passe via l&apos;invitation
                                </p>
                            </div>
                            <Switch
                                checked={form.invite}
                                onCheckedChange={(checked) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        invite: checked,
                                        password: checked ? "" : prev.password,
                                    }))
                                }
                            />
                        </div>

                        {!form.invite && (
                            <div className="space-y-2">
                                <Label htmlFor="create_password">
                                    Mot de passe *
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="create_password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        autoComplete="new-password"
                                        placeholder="Mot de passe"
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                password: e.target.value,
                                            }))
                                        }
                                        onBlur={() =>
                                            setTouched((prev) => ({
                                                ...prev,
                                                password: true,
                                            }))
                                        }
                                        aria-invalid={!!passwordError}
                                        className={cn(
                                            "pr-10",
                                            passwordError &&
                                                "border-destructive"
                                        )}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword((s) => !s)
                                        }
                                        aria-label={
                                            showPassword
                                                ? "Masquer le mot de passe"
                                                : "Afficher le mot de passe"
                                        }
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>

                                {form.password && (
                                    <PasswordStrength
                                        password={form.password}
                                    />
                                )}
                            </div>
                        )}
                    </FicheSection>

                    <div className="flex gap-2 pt-2">
                        <Button
                            type="submit"
                            className="flex-1"
                            disabled={!isValid || submitting}
                        >
                            {submitting
                                ? "Envoi..."
                                : form.invite
                                  ? "Inviter"
                                  : "Créer"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            className="flex-1"
                        >
                            Annuler
                        </Button>
                    </div>
                </form>
            </SheetContent>
        </Sheet>
    )
}
