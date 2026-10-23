"use client"

import { useEffect, useState } from "react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    localInputFromUtcIso,
    utcIsoFromLocalInput,
} from "@/shared/lib/datetimeLocal"
import type {
    MaintenanceDraft,
    MaintenanceWindow,
} from "../../types/maintenance.types"
import { listMaintainableFeatures } from "./maintenanceFeatures"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Fenêtre à modifier ; absente = création. */
    editing?: MaintenanceWindow | null
    /** Clés de feature déjà couvertes — la base n'en accepte qu'une par feature. */
    takenFeatureKeys: string[]
    /** Une fenêtre globale existe-t-elle déjà ? */
    hasGlobal: boolean
    onSubmit: (draft: MaintenanceDraft) => Promise<boolean>
}

/**
 * Création / modification d'une fenêtre de maintenance.
 *
 * Les dates transitent en heure locale dans les `datetime-local` et sont
 * converties en ISO UTC à l'enregistrement (`utcIsoFromLocalInput`), sans
 * décalage codé en dur.
 */
export function MaintenanceFormDialog({
    open,
    onOpenChange,
    editing,
    takenFeatureKeys,
    hasGlobal,
    onSubmit,
}: Props) {
    const isEditing = !!editing

    const [scope, setScope] = useState<"global" | "feature">("global")
    const [featureKey, setFeatureKey] = useState("")
    const [startsAt, setStartsAt] = useState("")
    const [endsAt, setEndsAt] = useState("")
    const [message, setMessage] = useState("")
    const [saving, setSaving] = useState(false)

    // Resynchronise le formulaire à chaque ouverture : en création on
    // repart d'un état vierge, en édition on charge la fenêtre visée.
    useEffect(() => {
        /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- réinitialisation d'un formulaire contrôlé à l'ouverture du dialogue */
        if (!open) return

        if (editing) {
            setScope(editing.scope)
            setFeatureKey(editing.feature_key ?? "")
            setStartsAt(localInputFromUtcIso(editing.starts_at))
            setEndsAt(localInputFromUtcIso(editing.ends_at))
            setMessage(editing.message ?? "")
        } else {
            // Si une fenêtre globale existe déjà, seule la portée « module »
            // reste ouverte (index unique en base).
            setScope(hasGlobal ? "feature" : "global")
            setFeatureKey("")
            setStartsAt("")
            setEndsAt("")
            setMessage("")
        }
        /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */
    }, [open, editing, hasGlobal])

    // En édition, on ne change pas la portée d'une fenêtre : ce serait une
    // autre maintenance. Les options listées excluent les features déjà
    // couvertes, sauf celle qu'on est en train d'éditer.
    const featureOptions = listMaintainableFeatures().filter(
        (f) =>
            !takenFeatureKeys.includes(f.key) || f.key === editing?.feature_key
    )

    const invalidWindow =
        !!startsAt && !!endsAt && new Date(endsAt) <= new Date(startsAt)

    const canSubmit =
        !!startsAt &&
        !invalidWindow &&
        (scope === "global" || !!featureKey) &&
        !saving

    async function handleSubmit() {
        if (!canSubmit) return
        setSaving(true)

        const base = {
            starts_at: utcIsoFromLocalInput(startsAt),
            ends_at: endsAt ? utcIsoFromLocalInput(endsAt) : null,
            message: message.trim() || null,
        }

        const draft: MaintenanceDraft =
            scope === "feature"
                ? { ...base, scope: "feature", feature_key: featureKey }
                : { ...base, scope: "global" }

        const ok = await onSubmit(draft)
        setSaving(false)
        if (ok) onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing
                            ? "Modifier la maintenance"
                            : "Programmer une maintenance"}
                    </DialogTitle>
                    <DialogDescription>
                        Une maintenance globale coupe toute l'application. Une
                        maintenance ciblée ne coupe qu'un module ; le reste
                        reste accessible.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!isEditing && (
                        <div className="space-y-2">
                            <Label htmlFor="maintenance-scope">Portée</Label>
                            <Select
                                value={scope}
                                onValueChange={(v) =>
                                    setScope(v as "global" | "feature")
                                }
                            >
                                <SelectTrigger id="maintenance-scope">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        value="global"
                                        disabled={hasGlobal}
                                    >
                                        Application entière
                                    </SelectItem>
                                    <SelectItem value="feature">
                                        Un module
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            {hasGlobal && (
                                <p className="text-xs text-muted-foreground">
                                    Une maintenance globale est déjà programmée
                                    : modifiez-la plutôt que d'en créer une
                                    seconde.
                                </p>
                            )}
                        </div>
                    )}

                    {scope === "feature" && (
                        <div className="space-y-2">
                            <Label htmlFor="maintenance-feature">Module</Label>
                            <Select
                                value={featureKey}
                                onValueChange={setFeatureKey}
                                disabled={isEditing}
                            >
                                <SelectTrigger id="maintenance-feature">
                                    <SelectValue placeholder="Choisir un module" />
                                </SelectTrigger>
                                <SelectContent>
                                    {featureOptions.map((f) => (
                                        <SelectItem key={f.key} value={f.key}>
                                            {f.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="maintenance-start">Début</Label>
                        <Input
                            id="maintenance-start"
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => setStartsAt(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maintenance-end">
                            Fin prévue{" "}
                            <span className="text-muted-foreground">
                                (facultatif)
                            </span>
                        </Label>
                        <Input
                            id="maintenance-end"
                            type="datetime-local"
                            value={endsAt}
                            onChange={(e) => setEndsAt(e.target.value)}
                        />
                        {invalidWindow && (
                            <p className="text-xs text-destructive">
                                La fin doit être postérieure au début.
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Information communiquée aux utilisateurs. La
                            maintenance ne se lève pas d'elle-même : elle se
                            désactive explicitement.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="maintenance-message">
                            Message affiché
                        </Label>
                        <Textarea
                            id="maintenance-message"
                            rows={4}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Ex. : migration de la base de données, retour prévu vers 14h."
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        loading={saving}
                    >
                        {isEditing ? "Enregistrer" : "Programmer"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
