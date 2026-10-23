"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/shared/ui/atoms/badge"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Label } from "@/shared/ui/atoms/label"
import {
    fetchAudienceOptions,
    type AudienceOption,
} from "../../services/announcementService"

interface Props {
    roleIds: string[]
    serviceIds: string[]
    onChange: (next: { roleIds: string[]; serviceIds: string[] }) => void
}

function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/**
 * Choix de l'audience d'une annonce.
 *
 * Sémantique volontairement explicite dans l'UI : ne rien cocher signifie
 * « tout le monde », et cocher un rôle ET un service produit une union
 * (les deux publics la voient), pas une intersection. C'est ce que fait
 * la fonction `annonce_targets_viewer` côté base, et l'ambiguïté sur ce
 * point est la première source d'erreur d'un ciblage.
 */
export function AudiencePicker({ roleIds, serviceIds, onChange }: Props) {
    const [options, setOptions] = useState<{
        roles: AudienceOption[]
        services: AudienceOption[]
    }>({ roles: [], services: [] })

    useEffect(() => {
        let cancelled = false

        fetchAudienceOptions()
            .then((data) => {
                if (!cancelled) setOptions(data)
            })
            .catch((err) => {
                console.error("[AudiencePicker] fetchAudienceOptions:", err)
                toast.error("Erreur lors du chargement des rôles et services")
            })

        return () => {
            cancelled = true
        }
    }, [])

    const isEveryone = roleIds.length === 0 && serviceIds.length === 0

    return (
        <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                    <Users className="size-4" />
                    Audience
                </Label>
                {isEveryone ? (
                    <Badge variant="secondary">Tout le monde</Badge>
                ) : (
                    <Badge variant="default">
                        {roleIds.length + serviceIds.length} sélection
                        {roleIds.length + serviceIds.length > 1 ? "s" : ""}
                    </Badge>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Ne rien cocher diffuse l'annonce à tous. Cocher des rôles
                <em> et </em> des services élargit l'audience à l'ensemble des
                deux, il ne la restreint pas.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Rôles</legend>
                    {options.roles.map((role) => (
                        <label
                            key={role.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                            <Checkbox
                                checked={roleIds.includes(role.id)}
                                onCheckedChange={() =>
                                    onChange({
                                        roleIds: toggle(roleIds, role.id),
                                        serviceIds,
                                    })
                                }
                            />
                            {role.nom}
                        </label>
                    ))}
                </fieldset>

                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Services</legend>
                    {options.services.map((service) => (
                        <label
                            key={service.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                            <Checkbox
                                checked={serviceIds.includes(service.id)}
                                onCheckedChange={() =>
                                    onChange({
                                        roleIds,
                                        serviceIds: toggle(
                                            serviceIds,
                                            service.id
                                        ),
                                    })
                                }
                            />
                            {service.nom}
                        </label>
                    ))}
                </fieldset>
            </div>
        </div>
    )
}
