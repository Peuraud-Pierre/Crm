import { useState } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import type { AppUser } from "@/features/auth/hooks/useAuth/types"
import { useProfileIdentity } from "../../hooks/data/useProfileIdentity"
import { AvatarUploader } from "./AvatarUploader"

interface IdentityFormProps {
    user: NonNullable<AppUser>
    /** Téléphone du profil — absent de AppUser, lu séparément. */
    phone: string | null
}

export function IdentityForm({ user, phone }: IdentityFormProps) {
    const { saving, uploading, saveIdentity, uploadAvatar } =
        useProfileIdentity()

    const [form, setForm] = useState({
        full_name: user.full_name ?? "",
        phone: phone ?? "",
    })

    const set =
        <K extends keyof typeof form>(key: K) =>
        (value: string) =>
            setForm((previous) => ({ ...previous, [key]: value }))

    const isValid = form.full_name.trim().length > 0

    const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!isValid) return

        await saveIdentity({
            full_name: form.full_name.trim(),
            phone: form.phone,
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <AvatarUploader
                avatarUrl={user.avatar_url}
                fullName={user.full_name}
                uploading={uploading}
                onSelect={uploadAvatar}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="full_name">Nom complet</Label>
                    <Input
                        id="full_name"
                        value={form.full_name}
                        onChange={(e) => set("full_name")(e.target.value)}
                        placeholder="Prénom Nom"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone")(e.target.value)}
                        placeholder="06 00 00 00 00"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        value={user.email ?? ""}
                        disabled
                        className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                        L'email d'un compte est géré par un administrateur.
                    </p>
                </div>
            </div>

            <Button type="submit" loading={saving} disabled={!isValid}>
                Enregistrer
            </Button>
        </form>
    )
}
