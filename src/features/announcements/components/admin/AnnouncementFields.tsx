import {
    localInputFromUtcIso,
    utcIsoFromLocalInput,
} from "@/shared/lib/datetimeLocal"
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
import { Switch } from "@/shared/ui/atoms/switch"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    ANNOUNCEMENT_BODY_MAX,
    ANNOUNCEMENT_EXCERPT_MAX,
    ANNOUNCEMENT_TYPE_LABELS,
    ANNOUNCEMENT_TYPES,
} from "../../constants"
import type {
    AnnouncementDraft,
    AnnouncementType,
} from "../../types/announcement.types"
import { AudiencePicker } from "./AudiencePicker"

interface Props {
    draft: AnnouncementDraft
    patch: (updates: Partial<AnnouncementDraft>) => void
    scheduled: boolean
    onScheduledChange: (scheduled: boolean) => void
    uploading: boolean
    saving: boolean
    onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    onSubmit: () => void
    editing: boolean
}

/**
 * Les champs de l'annonce.
 *
 * Extrait du dialogue, qui dépassait le seuil de 400 lignes. Purement
 * présentationnel : tout l'état vit dans `useAnnouncementForm`.
 */
export function AnnouncementFields({
    draft,
    patch,
    scheduled,
    onScheduledChange,
    uploading,
    saving,
    onImageChange,
    onSubmit,
    editing,
}: Props) {
    return (
        <div className="space-y-4 overflow-y-auto py-2 pr-2">
            <div className="space-y-2">
                <Label htmlFor="annonce-titre">Titre</Label>
                <Input
                    id="annonce-titre"
                    value={draft.titre}
                    onChange={(e) => patch({ titre: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-type">Type</Label>
                <Select
                    value={draft.type}
                    onValueChange={(v) =>
                        patch({ type: v as AnnouncementType })
                    }
                >
                    <SelectTrigger id="annonce-type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {ANNOUNCEMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                                {ANNOUNCEMENT_TYPE_LABELS[t]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-image">
                    Image{" "}
                    <span className="text-muted-foreground">
                        (facultatif, 2 Mo max.)
                    </span>
                </Label>
                <Input
                    id="annonce-image"
                    type="file"
                    accept="image/*"
                    disabled={uploading}
                    onChange={onImageChange}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-date">
                    Date affichée{" "}
                    <span className="text-muted-foreground">(facultatif)</span>
                </Label>
                <Input
                    id="annonce-date"
                    type="date"
                    value={draft.event_date ?? ""}
                    onChange={(e) =>
                        patch({ event_date: e.target.value || null })
                    }
                />
                <p className="text-xs text-muted-foreground">
                    La date que lira le destinataire — celle du pot, de
                    l'anniversaire, du déploiement. Sans elle, c'est la date de
                    publication qui s'affiche.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-excerpt">Chapô</Label>
                <Textarea
                    id="annonce-excerpt"
                    rows={2}
                    maxLength={ANNOUNCEMENT_EXCERPT_MAX}
                    value={draft.excerpt ?? ""}
                    placeholder="Une ou deux phrases qui donnent envie de lire la suite."
                    onChange={(e) => patch({ excerpt: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    C'est ce qui s'affiche sous le titre dans le bandeau
                    d'accueil.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-body">Article</Label>
                <Textarea
                    id="annonce-body"
                    rows={10}
                    maxLength={ANNOUNCEMENT_BODY_MAX}
                    value={draft.body_markdown ?? draft.description ?? ""}
                    placeholder={
                        "## Un intertitre\n\nUn paragraphe.\n\n- un point\n- un autre"
                    }
                    onChange={(e) => patch({ body_markdown: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                    Mise en forme acceptée : <code>## intertitre</code>,{" "}
                    <code>**gras**</code>, <code>*italique*</code>,{" "}
                    <code>- liste</code>, <code>[texte](lien)</code>. Le reste
                    s'affiche tel quel.
                </p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="annonce-lien">
                    Lien{" "}
                    <span className="text-muted-foreground">(facultatif)</span>
                </Label>
                <Input
                    id="annonce-lien"
                    value={draft.link ?? ""}
                    placeholder="https://..."
                    onChange={(e) => patch({ link: e.target.value })}
                />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="annonce-pinned">
                    Épingler en tête du carrousel
                </Label>
                <Switch
                    id="annonce-pinned"
                    checked={draft.pinned}
                    onCheckedChange={(v) => patch({ pinned: v })}
                />
            </div>

            <AudiencePicker
                roleIds={draft.target_role_ids}
                serviceIds={draft.target_service_ids}
                onChange={({ roleIds, serviceIds }) =>
                    patch({
                        target_role_ids: roleIds,
                        target_service_ids: serviceIds,
                    })
                }
            />

            <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="annonce-planifier">
                        Planifier la publication
                    </Label>
                    <Switch
                        id="annonce-planifier"
                        checked={scheduled}
                        onCheckedChange={onScheduledChange}
                    />
                </div>

                {scheduled && (
                    <div className="mt-3 space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="annonce-debut">Début</Label>
                            <Input
                                id="annonce-debut"
                                type="datetime-local"
                                value={localInputFromUtcIso(draft.start_date)}
                                onChange={(e) =>
                                    patch({
                                        start_date: utcIsoFromLocalInput(
                                            e.target.value
                                        ),
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="annonce-fin">
                                Fin{" "}
                                <span className="text-muted-foreground">
                                    (facultatif)
                                </span>
                            </Label>
                            <Input
                                id="annonce-fin"
                                type="datetime-local"
                                value={localInputFromUtcIso(draft.end_date)}
                                onChange={(e) =>
                                    patch({
                                        end_date: e.target.value
                                            ? utcIsoFromLocalInput(
                                                  e.target.value
                                              )
                                            : null,
                                    })
                                }
                            />
                        </div>
                    </div>
                )}
            </div>

            <Button
                className="w-full"
                onClick={onSubmit}
                loading={saving}
                disabled={uploading}
            >
                {editing ? "Enregistrer" : "Publier"}
            </Button>
        </div>
    )
}
