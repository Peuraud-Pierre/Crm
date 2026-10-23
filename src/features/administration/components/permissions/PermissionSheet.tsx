import { useMemo, useState } from "react"
import { Briefcase, KeyRound, Search, Shield } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Checkbox } from "@/shared/ui/atoms/checkbox"
import { Input } from "@/shared/ui/atoms/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import { categoryLabel } from "../shared/categoryLabels"
import { FicheSection } from "../shared/FicheSection"
import type {
    EntityKind,
    EntityOption,
    Permission,
    PermissionHolders as Holders,
} from "../../types"
import { PermissionHolders } from "./PermissionHolders"

interface PermissionSheetProps {
    /** null = fermé. */
    permission: Permission | null
    holders: Holders | null
    roles: EntityOption[]
    services: EntityOption[]
    /** roles_services.manage manquant → fiche en lecture seule. */
    canManage: boolean
    onClose: () => void
    onToggle: (
        entity: { kind: EntityKind; id: string },
        grant: boolean
    ) => Promise<boolean>
}

/**
 * Fiche d'accès d'une permission : détenteurs en lecture seule, ou
 * attribution directe rôles/services si gérable. Une permission ne se
 * renomme ni ne se supprime depuis l'UI (définie en base) — pas de section
 * identité éditable ni de suppression, contrairement à EntitySheet.
 */
export function PermissionSheet({
    permission,
    holders,
    roles,
    services,
    canManage,
    onClose,
    onToggle,
}: PermissionSheetProps) {
    const [search, setSearch] = useState("")
    const [pendingKey, setPendingKey] = useState<string | null>(null)

    const heldByRole = new Set((holders?.roles ?? []).map((r) => r.id))
    const heldByService = new Set((holders?.services ?? []).map((s) => s.id))

    const q = search.trim().toLowerCase()
    const filteredRoles = useMemo(
        () => roles.filter((r) => r.nom.toLowerCase().includes(q)),
        [roles, q]
    )
    const filteredServices = useMemo(
        () => services.filter((s) => s.nom.toLowerCase().includes(q)),
        [services, q]
    )

    async function toggle(kind: EntityKind, id: string, grant: boolean) {
        setPendingKey(`${kind}:${id}`)
        await onToggle({ kind, id }, grant)
        setPendingKey(null)
    }

    function renderGroup(
        title: string,
        Icon: LucideIcon,
        kind: EntityKind,
        options: EntityOption[],
        heldIds: Set<string>
    ) {
        if (options.length === 0) return null
        return (
            <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {title}
                </p>
                <ul className="divide-y rounded-md border">
                    {options.map((option) => {
                        const held = heldIds.has(option.id)
                        const pending = pendingKey === `${kind}:${option.id}`
                        return (
                            <li key={option.id}>
                                <label className="flex cursor-pointer items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-muted/50">
                                    <span className="min-w-0 truncate text-sm font-medium">
                                        {option.nom}
                                    </span>
                                    <Checkbox
                                        checked={held}
                                        disabled={pendingKey !== null}
                                        aria-busy={pending}
                                        onCheckedChange={(checked) =>
                                            void toggle(
                                                kind,
                                                option.id,
                                                checked === true
                                            )
                                        }
                                        aria-label={`${held ? "Retirer" : "Attribuer"} ${permission?.label ?? ""} — ${option.nom}`}
                                        className="shrink-0"
                                    />
                                </label>
                            </li>
                        )
                    })}
                </ul>
            </div>
        )
    }

    return (
        <Sheet
            open={!!permission}
            onOpenChange={(open) => {
                if (!open) {
                    setSearch("")
                    setPendingKey(null)
                    onClose()
                }
            }}
        >
            <SheetContent
                side="right"
                className="w-full overflow-y-auto sm:max-w-xl"
            >
                {permission && (
                    <>
                        <SheetHeader className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary ring-1 ring-primary/20">
                                    <KeyRound className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 text-left">
                                    <SheetTitle className="truncate">
                                        {permission.label}
                                    </SheetTitle>
                                    <SheetDescription className="font-mono text-2xs">
                                        {permission.code} ·{" "}
                                        {categoryLabel(
                                            permission.category ?? "Autres"
                                        )}
                                    </SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>

                        <div className="mt-6 space-y-6">
                            <FicheSection title="Détenteurs">
                                {canManage ? (
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={search}
                                                onChange={(e) =>
                                                    setSearch(e.target.value)
                                                }
                                                placeholder="Rechercher un rôle ou service..."
                                                className="pl-10"
                                                aria-label="Rechercher un rôle ou service"
                                            />
                                        </div>
                                        {renderGroup(
                                            "Rôles",
                                            Shield,
                                            "role",
                                            filteredRoles,
                                            heldByRole
                                        )}
                                        {renderGroup(
                                            "Services",
                                            Briefcase,
                                            "service",
                                            filteredServices,
                                            heldByService
                                        )}
                                        {filteredRoles.length === 0 &&
                                            filteredServices.length === 0 && (
                                                <p className="py-4 text-center text-sm text-muted-foreground">
                                                    Aucun résultat.
                                                </p>
                                            )}
                                        {(holders?.userCount ?? 0) > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                +{holders?.userCount}{" "}
                                                utilisateur
                                                {(holders?.userCount ?? 0) > 1
                                                    ? "s"
                                                    : ""}{" "}
                                                en attribution individuelle
                                                (géré depuis leur fiche).
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <PermissionHolders holders={holders} />
                                )}
                            </FicheSection>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
