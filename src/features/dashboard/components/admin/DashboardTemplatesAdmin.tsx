"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LayoutGrid, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    deleteTemplate,
    fetchAllTemplates,
    saveTemplate,
    type LayoutTemplate,
} from "../../services/dashboardLayoutService"
import { readStoredLayout } from "../../layout/migrateV1"
import { useDashboardLayout } from "../../hooks/data/useDashboardLayout"
import { getWidget } from "../../widgets/registry"
import {
    fetchAudienceOptions,
    type AudienceOption,
} from "@/shared/services/audienceService"

/**
 * Gabarits de dashboard par rôle et par service — onglet de `/manager`.
 *
 * Le gabarit se compose en agençant SON PROPRE dashboard, puis en le
 * publiant ici pour un rôle ou un service. C'est délibéré : un second
 * éditeur de grille, réservé aux administrateurs, dupliquerait tout le
 * moteur pour un usage rare, et surtout il ne montrerait pas ce que les
 * utilisateurs verront vraiment. Ici, l'administrateur voit exactement ce
 * qu'il distribue.
 *
 * Un gabarit ne s'impose pas : il ne s'applique qu'aux utilisateurs qui
 * n'ont pas encore de disposition personnelle, et à ceux qui cliquent
 * « Réinitialiser ».
 */
export function DashboardTemplatesAdmin() {
    const { user } = useAuth()
    const { layout } = useDashboardLayout()

    const [templates, setTemplates] = useState<LayoutTemplate[]>([])
    const [options, setOptions] = useState<{
        roles: AudienceOption[]
        services: AudienceOption[]
    }>({ roles: [], services: [] })
    const [target, setTarget] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<LayoutTemplate | null>(
        null
    )

    const requestIdRef = useRef(0)

    const load = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const [rows, audience] = await Promise.all([
                fetchAllTemplates(),
                fetchAudienceOptions(),
            ])
            if (requestIdRef.current !== requestId) return
            setTemplates(rows)
            setOptions(audience)
        } catch (err) {
            console.error("[DashboardTemplatesAdmin] load:", err)
            toast.error("Erreur lors du chargement des gabarits")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    function labelFor(template: LayoutTemplate): string {
        if (template.role_id) {
            return (
                options.roles.find((r) => r.id === template.role_id)?.nom ??
                "Rôle inconnu"
            )
        }
        return (
            options.services.find((s) => s.id === template.service_id)?.nom ??
            "Service inconnu"
        )
    }

    /** Nombre de modules d'un gabarit, sans faire confiance au JSON stocké. */
    function widgetCount(template: LayoutTemplate): number {
        return readStoredLayout(template.layout)?.items.length ?? 0
    }

    async function handleSave() {
        if (!target) return

        const [kind, id] = target.split(":")
        setSaving(true)
        try {
            await saveTemplate(
                kind === "role" ? { roleId: id } : { serviceId: id },
                layout,
                user?.user_id ?? null
            )
            await load()
            toast.success("Gabarit enregistré")
        } catch (err) {
            console.error("[DashboardTemplatesAdmin] save:", err)
            toast.error("Erreur lors de l'enregistrement du gabarit")
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(template: LayoutTemplate) {
        try {
            await deleteTemplate(template.id)
            await load()
            toast.success("Gabarit supprimé")
        } catch (err) {
            console.error("[DashboardTemplatesAdmin] delete:", err)
            toast.error("Erreur lors de la suppression du gabarit")
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <LayoutGrid className="size-5" />
                    Tableaux de bord par défaut
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Composez votre propre tableau de bord depuis la page
                    d'accueil, puis publiez-le comme disposition par défaut d'un
                    rôle ou d'un service.
                </p>
            </div>

            <Card>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <Label htmlFor="template-target">
                            Publier ma disposition actuelle pour
                        </Label>
                        <Select value={target} onValueChange={setTarget}>
                            <SelectTrigger id="template-target">
                                <SelectValue placeholder="Choisir un rôle ou un service" />
                            </SelectTrigger>
                            <SelectContent>
                                {options.roles.map((role) => (
                                    <SelectItem
                                        key={role.id}
                                        value={`role:${role.id}`}
                                    >
                                        Rôle — {role.nom}
                                    </SelectItem>
                                ))}
                                {options.services.map((service) => (
                                    <SelectItem
                                        key={service.id}
                                        value={`service:${service.id}`}
                                    >
                                        Service — {service.nom}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <p className="text-xs text-muted-foreground">
                        {layout.items.length} module
                        {layout.items.length > 1 ? "s" : ""} seront publiés :{" "}
                        {layout.items
                            .map(
                                (i) =>
                                    getWidget(i.widgetId)?.title ?? i.widgetId
                            )
                            .join(", ")}
                        . Les utilisateurs ayant déjà personnalisé leur tableau
                        de bord ne sont pas affectés.
                    </p>

                    <Button
                        onClick={handleSave}
                        disabled={!target}
                        loading={saving}
                    >
                        <Save className="size-4" />
                        Publier comme gabarit
                    </Button>
                </CardContent>
            </Card>

            <section className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Gabarits existants
                </h3>

                {loading ? (
                    <SkeletonList rows={2} label="Chargement des gabarits" />
                ) : templates.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={LayoutGrid}
                        title="Aucun gabarit"
                        description="Chaque utilisateur voit le tableau de bord par défaut tant qu'aucun gabarit n'est publié pour son rôle."
                    />
                ) : (
                    <div className="space-y-2">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="flex items-center justify-between gap-3 rounded-lg border p-3"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-medium">
                                        {labelFor(template)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {widgetCount(template)} module
                                        {widgetCount(template) > 1 ? "s" : ""}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <Badge variant="secondary">
                                        {template.role_id ? "Rôle" : "Service"}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label={`Supprimer le gabarit ${labelFor(template)}`}
                                        onClick={() =>
                                            setPendingDelete(template)
                                        }
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer ce gabarit ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Les utilisateurs concernés qui n'ont pas de
                            disposition personnelle retrouveront le tableau de
                            bord par défaut. Aucune disposition personnelle
                            n'est touchée.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pendingDelete) {
                                    void handleDelete(pendingDelete)
                                }
                                setPendingDelete(null)
                            }}
                        >
                            Supprimer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
