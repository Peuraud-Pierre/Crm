import { useState } from "react"
import { Avatar, AvatarFallback } from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
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
import { Separator } from "@/shared/ui/atoms/separator"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { getInitials, getStatusColor, getStatusLabel } from "../../utils/format"
import type {
    AdminProfile,
    EntityOption,
    ProfileUpdateInput,
} from "../../types"
import { FicheSection } from "../shared/FicheSection"
import { UserPermissionsSection } from "./UserPermissionsSection"

interface UserSheetProps {
    /** null = fermé. */
    user: AdminProfile | null
    roles: EntityOption[]
    services: EntityOption[]
    /** users.update absent → formulaire et permissions en lecture seule. */
    canUpdate: boolean
    onClose: () => void
    onSave: (userId: string, updates: ProfileUpdateInput) => Promise<boolean>
}

/**
 * Fiche d'accès utilisateur : identité en tête, section Profil (formulaire)
 * et section Permissions, empilées dans un panneau latéral. La fiche reste
 * ouverte après enregistrement — le realtime la tient à jour via la liste.
 */
export function UserSheet({
    user,
    roles,
    services,
    canUpdate,
    onClose,
    onSave,
}: UserSheetProps) {
    return (
        <Sheet
            open={!!user}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <SheetContent
                side="right"
                className="w-full overflow-y-auto sm:max-w-xl"
            >
                {user && (
                    <>
                        <SheetHeader className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12 shrink-0">
                                    <AvatarFallback>
                                        {getInitials(user.full_name)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 text-left">
                                    <SheetTitle className="truncate">
                                        {user.full_name}
                                    </SheetTitle>
                                    <SheetDescription className="truncate">
                                        {user.email}
                                    </SheetDescription>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge className={getStatusColor(user.status)}>
                                    {getStatusLabel(user.status)}
                                </Badge>
                                <Badge variant="secondary">
                                    {user.role?.nom || "Sans rôle"}
                                </Badge>
                                <Badge variant="outline">
                                    {user.service?.nom || "Non assigné"}
                                </Badge>
                            </div>
                        </SheetHeader>

                        <div className="mt-6 space-y-6">
                            {/* key = remount à chaque utilisateur : le
                                formulaire s'initialise sans effet. */}
                            <ProfileSection
                                key={user.user_id}
                                user={user}
                                roles={roles}
                                services={services}
                                canUpdate={canUpdate}
                                onSave={onSave}
                            />

                            <Separator />

                            <UserPermissionsSection
                                user={user}
                                canManage={canUpdate}
                            />
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function ProfileSection({
    user,
    roles,
    services,
    canUpdate,
    onSave,
}: {
    user: AdminProfile
    roles: EntityOption[]
    services: EntityOption[]
    canUpdate: boolean
    onSave: (userId: string, updates: ProfileUpdateInput) => Promise<boolean>
}) {
    const [form, setForm] = useState({
        full_name: user.full_name || "",
        email: user.email || "",
        role_id: user.role_id || "",
        service_id: user.service_id || "",
    })
    const [saving, setSaving] = useState(false)

    async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault()
        setSaving(true)
        await onSave(user.user_id, {
            full_name: form.full_name,
            email: form.email,
            role_id: form.role_id || undefined,
            service_id: form.service_id || undefined,
        })
        setSaving(false)
    }

    return (
        <FicheSection title="Profil">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="edit_full_name">Nom complet</Label>
                        <Input
                            id="edit_full_name"
                            value={form.full_name}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    full_name: e.target.value,
                                }))
                            }
                            disabled={!canUpdate}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_email">Email</Label>
                        <Input
                            id="edit_email"
                            type="email"
                            value={form.email}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    email: e.target.value,
                                }))
                            }
                            disabled={!canUpdate}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_role">Rôle</Label>
                        <Select
                            value={form.role_id}
                            onValueChange={(role_id) =>
                                setForm((prev) => ({ ...prev, role_id }))
                            }
                            disabled={!canUpdate}
                        >
                            <SelectTrigger id="edit_role">
                                <SelectValue placeholder="Sélectionnez un rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                        {role.nom}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_service">Service</Label>
                        <Select
                            value={form.service_id}
                            onValueChange={(service_id) =>
                                setForm((prev) => ({ ...prev, service_id }))
                            }
                            disabled={!canUpdate}
                        >
                            <SelectTrigger id="edit_service">
                                <SelectValue placeholder="Sélectionnez un service" />
                            </SelectTrigger>
                            <SelectContent>
                                {services.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.nom}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {canUpdate && (
                    <div className="flex justify-end">
                        <Button type="submit" disabled={saving}>
                            {saving
                                ? "Enregistrement..."
                                : "Enregistrer le profil"}
                        </Button>
                    </div>
                )}
            </form>
        </FicheSection>
    )
}
