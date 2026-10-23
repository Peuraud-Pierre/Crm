import { useMemo, useState } from "react"
import { Layers, MapPin, Pencil, PersonStanding, Plus } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { cn } from "@/shared/lib/utils"
import { MAGASIN_THEME, planItemColor } from "@/features/magasins/theme"
import { ZONE_KIND_LABEL } from "@/features/magasins/constants"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import type { ZoneTreeNode } from "@/features/magasins/types/magasin.types"
import { emplacementsUnder } from "@/features/magasins/utils/planTree"
import { geometryOf } from "@/features/magasins/utils/planGeometry"
import { ZoneFormSheet, type ZoneFormTarget } from "./ZoneFormSheet"
import { EmplacementFormSheet, type EmplacementFormTarget } from "./EmplacementFormSheet"

interface EmplacementsTabProps {
    plan: PlanMagasinApi
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
}

/**
 * Onglet Emplacements : l'arborescence zone › rayon › portant › emplacement,
 * et sa saisie. Ce qui est créé ici apparaît dans la palette « à placer » de
 * l'éditeur de plan.
 */
export function EmplacementsTab({ plan, canCreate, canUpdate, canDelete }: EmplacementsTabProps) {
    const [zoneTarget, setZoneTarget] = useState<ZoneFormTarget | null>(null)
    const [emplacementTarget, setEmplacementTarget] = useState<EmplacementFormTarget | null>(null)
    // Chaque ouverture remonte la sheet : son formulaire repart de la cible.
    const [formKey, setFormKey] = useState(0)
    const openZone = (target: ZoneFormTarget | null) => {
        if (target) setFormKey((k) => k + 1)
        setZoneTarget(target)
    }
    const openEmplacement = (target: EmplacementFormTarget | null) => {
        if (target) setFormKey((k) => k + 1)
        setEmplacementTarget(target)
    }

    const rootIndex = useMemo(() => new Map(plan.tree.map((root, i) => [root.id, i])), [plan.tree])

    if (plan.loading) return <Skeleton aria-hidden className="h-64 w-full rounded-2xl" />

    const editedZone = zoneTarget?.zone ?? null
    const editedEmplacement = emplacementTarget?.emplacement ?? null
    const emplacementCount = editedZone
        ? emplacementsUnder(editedZone.id, plan.zones, plan.emplacements).length
        : 0

    // Mannequins rattachés, rangés sous leur zone comme les portants.
    const mannequinsOf = (zoneId: string) =>
        plan.equipements.filter((q) => q.kind === "mannequin" && q.zone_id === zoneId)

    const renderZone = (node: ZoneTreeNode, depth: number, colorIndex: number) => (
        <li key={node.id} className="flex flex-col gap-1">
            <div
                className={cn(
                    "flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2",
                    !node.is_active && "opacity-60",
                )}
            >
                <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-sm"
                    style={{ background: planItemColor(node.color, colorIndex) }}
                />
                <Badge variant="secondary">{ZONE_KIND_LABEL[node.kind]}</Badge>
                <span className="font-semibold text-foreground">{node.code}</span>
                {node.label && <span className="truncate text-sm text-muted-foreground">{node.label}</span>}
                {!node.is_active && <Badge variant="outline">Inactif</Badge>}
                <div className="ml-auto flex flex-wrap items-center gap-1">
                    {canCreate && node.kind === "zone" && (
                        <Button variant="ghost" size="sm" onClick={() => openZone({ zone: null, defaults: { kind: "rayon", parent_id: node.id } })}>
                            <Plus size={14} /> Rayon
                        </Button>
                    )}
                    {canCreate && node.kind !== "etagere" && (
                        <Button variant="ghost" size="sm" onClick={() => openZone({ zone: null, defaults: { kind: "etagere", parent_id: node.id } })}>
                            <Plus size={14} /> Portant
                        </Button>
                    )}
                    {canCreate && (
                        // Créé sans position : il attend dans la palette « à placer » du plan.
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void plan.createEquipement("mannequin", geometryOf(null, 0), node.id)}
                        >
                            <Plus size={14} /> Mannequin
                        </Button>
                    )}
                    {canCreate && (
                        <Button variant="ghost" size="sm" onClick={() => openEmplacement({ emplacement: null, zoneId: node.id })}>
                            <Plus size={14} /> Emplacement
                        </Button>
                    )}
                    {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => openZone({ zone: node })} aria-label={`Modifier ${node.code}`}>
                            <Pencil size={14} />
                        </Button>
                    )}
                </div>
            </div>
            {(node.children.length > 0 || node.emplacements.length > 0 || mannequinsOf(node.id).length > 0) && (
                <ul className="ml-4 flex flex-col gap-1 border-l border-border pl-3">
                    {node.children.map((child) => renderZone(child, depth + 1, colorIndex))}
                    {mannequinsOf(node.id).map((mq) => (
                        <li
                            key={mq.id}
                            className={cn(
                                "flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm",
                                !mq.is_active && "opacity-60",
                            )}
                        >
                            <PersonStanding size={14} className="shrink-0 text-muted-foreground" />
                            <Badge variant="secondary">Mannequin</Badge>
                            <span className="font-medium text-foreground">{mq.code}</span>
                            {mq.label && <span className="truncate text-muted-foreground">{mq.label}</span>}
                            {mq.pos_x == null && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    Non placé
                                </Badge>
                            )}
                        </li>
                    ))}
                    {node.emplacements.map((emp) => (
                        <li
                            key={emp.id}
                            className={cn(
                                "flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-1.5 text-sm",
                                !emp.is_active && "opacity-60",
                            )}
                        >
                            <MapPin size={14} className="shrink-0 text-muted-foreground" />
                            <span className="font-medium text-foreground">{emp.code}</span>
                            {emp.label && <span className="truncate text-muted-foreground">{emp.label}</span>}
                            {!emp.is_active && <Badge variant="outline">Inactif</Badge>}
                            {emp.pos_x == null && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    Non placé
                                </Badge>
                            )}
                            {canUpdate && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="ml-auto"
                                    onClick={() => openEmplacement({ emplacement: emp })}
                                    aria-label={`Modifier l'emplacement ${emp.code}`}
                                >
                                    <Pencil size={14} />
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    )

    return (
        <div className={MAGASIN_THEME.board.container}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className={MAGASIN_THEME.section.groupTitle}>Zones et emplacements</h2>
                    <p className="text-xs text-muted-foreground">
                        {plan.zones.length} niveau{plan.zones.length > 1 ? "x" : ""} · {plan.emplacements.length} emplacement
                        {plan.emplacements.length > 1 ? "s" : ""}
                    </p>
                </div>
                {canCreate && (
                    <Button size="sm" onClick={() => openZone({ zone: null, defaults: { kind: "zone" } })}>
                        <Plus size={14} /> Nouvelle zone
                    </Button>
                )}
            </div>

            {plan.tree.length === 0 ? (
                <EmptyState
                    icon={Layers}
                    title="Aucune zone"
                    description="Commencez par une zone (« Vêtements femme », « Réserve »…), puis ajoutez-y rayons, portants et emplacements."
                    action={canCreate ? { label: "Créer une zone", onClick: () => openZone({ zone: null, defaults: { kind: "zone" } }), icon: Plus } : undefined}
                    className={MAGASIN_THEME.board.emptyState}
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {plan.tree.map((root) => renderZone(root, 0, rootIndex.get(root.id) ?? 0))}
                </ul>
            )}

            <ZoneFormSheet
                key={`zone-${formKey}`}
                target={zoneTarget}
                zones={plan.zones}
                onClose={() => openZone(null)}
                onSubmit={async (input) =>
                    editedZone ? plan.updateZone(editedZone.id, input) : (await plan.createZone(input)) !== null
                }
                onDelete={editedZone && canDelete ? () => plan.removeZone(editedZone.id) : undefined}
                emplacementCount={emplacementCount}
            />
            <EmplacementFormSheet
                key={`emplacement-${formKey}`}
                target={emplacementTarget}
                zones={plan.zones}
                onClose={() => openEmplacement(null)}
                onSubmit={async (input) =>
                    editedEmplacement
                        ? plan.updateEmplacement(editedEmplacement.id, input)
                        : (await plan.createEmplacement(input)) !== null
                }
                onDelete={editedEmplacement && canDelete ? () => plan.removeEmplacement(editedEmplacement.id) : undefined}
            />
        </div>
    )
}
