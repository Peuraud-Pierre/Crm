"use client"

import { useState } from "react"
import { Plus, Wrench } from "lucide-react"
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
import { Button } from "@/shared/ui/atoms/button"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { useMaintenanceContext } from "../../hooks/context/MaintenanceProvider"
import type { MaintenanceWindow } from "../../types/maintenance.types"
import { MaintenanceFormDialog } from "./MaintenanceFormDialog"
import { MaintenanceWindowCard } from "./MaintenanceWindowCard"
import { featureLabel } from "./maintenanceFeatures"

/** Action destructrice en attente de confirmation. */
type PendingAction = {
    kind: "activate" | "deactivate" | "delete"
    window: MaintenanceWindow
} | null

/**
 * Console de maintenance — onglet de `/manager`.
 *
 * Remplace l'ancienne machine à états « create / awaiting / manage » qui
 * ne savait décrire qu'UNE ligne : le modèle est désormais une
 * collection (une fenêtre globale au plus, plus une par module).
 */
export function MaintenanceAdmin() {
    const { windows, state, loading, createWindow, editWindow, removeWindow } =
        useMaintenanceContext()

    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<MaintenanceWindow | null>(null)
    const [pending, setPending] = useState<PendingAction>(null)

    const featureWindows = windows.filter((w) => w.scope === "feature")
    const takenFeatureKeys = featureWindows
        .map((w) => w.feature_key)
        .filter((k): k is string => !!k)

    function openCreate() {
        setEditing(null)
        setFormOpen(true)
    }

    function openEdit(w: MaintenanceWindow) {
        setEditing(w)
        setFormOpen(true)
    }

    async function confirmPending() {
        if (!pending) return
        const { kind, window: w } = pending
        setPending(null)

        if (kind === "delete") {
            await removeWindow(w.id)
        } else {
            await editWindow(w.id, { active: kind === "activate" })
        }
    }

    if (loading) {
        return <SkeletonList rows={3} label="Chargement des maintenances" />
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold">
                        <Wrench className="size-5" />
                        Maintenance
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Coupez l'application entière, ou un seul module le temps
                        d'une intervention.
                    </p>
                </div>

                <Button onClick={openCreate}>
                    <Plus className="size-4" />
                    Programmer
                </Button>
            </div>

            {windows.length === 0 ? (
                <EmptyState
                    icon={Wrench}
                    title="Aucune maintenance programmée"
                    description="L'application est pleinement accessible."
                />
            ) : (
                <div className="space-y-6">
                    <section className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Application entière
                        </h3>
                        {state.global ? (
                            <MaintenanceWindowCard
                                window={state.global}
                                onToggleActive={(next) =>
                                    setPending({
                                        kind: next ? "activate" : "deactivate",
                                        window: state.global!,
                                    })
                                }
                                onEdit={() => openEdit(state.global!)}
                                onDelete={() =>
                                    setPending({
                                        kind: "delete",
                                        window: state.global!,
                                    })
                                }
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Aucune maintenance globale programmée.
                            </p>
                        )}
                    </section>

                    <section className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            Par module
                        </h3>
                        {featureWindows.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                Aucun module en maintenance.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {featureWindows.map((w) => (
                                    <MaintenanceWindowCard
                                        key={w.id}
                                        window={w}
                                        onToggleActive={(next) =>
                                            setPending({
                                                kind: next
                                                    ? "activate"
                                                    : "deactivate",
                                                window: w,
                                            })
                                        }
                                        onEdit={() => openEdit(w)}
                                        onDelete={() =>
                                            setPending({
                                                kind: "delete",
                                                window: w,
                                            })
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <MaintenanceFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                editing={editing}
                takenFeatureKeys={takenFeatureKeys}
                hasGlobal={!!state.global}
                onSubmit={async (draft) => {
                    if (editing) {
                        return editWindow(editing.id, {
                            starts_at: draft.starts_at,
                            ends_at: draft.ends_at,
                            message: draft.message,
                        })
                    }
                    return createWindow(draft)
                }}
            />

            <AlertDialog
                open={!!pending}
                onOpenChange={(open) => !open && setPending(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pending?.kind === "delete"
                                ? "Supprimer cette maintenance ?"
                                : pending?.kind === "activate"
                                  ? "Activer la maintenance ?"
                                  : "Lever la maintenance ?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pending && describePending(pending)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmPending}>
                            Confirmer
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

/**
 * Le texte de confirmation nomme précisément ce qui va être coupé :
 * confondre une coupure globale avec la coupure d'un module est
 * exactement l'erreur qu'on veut rendre impossible.
 */
function describePending(pending: NonNullable<PendingAction>): string {
    const target =
        pending.window.scope === "global"
            ? "toute l'application"
            : `le module « ${featureLabel(pending.window.feature_key)} »`

    switch (pending.kind) {
        case "activate":
            return `Les utilisateurs perdront immédiatement l'accès à ${target}, sauf ceux qui disposent du contournement de maintenance.`
        case "deactivate":
            return `L'accès à ${target} sera immédiatement rétabli pour tous les utilisateurs.`
        case "delete":
            return `Le créneau programmé sur ${target} sera supprimé. Cette action est définitive.`
    }
}
