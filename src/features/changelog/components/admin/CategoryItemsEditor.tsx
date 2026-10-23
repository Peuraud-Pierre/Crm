import { AnimatePresence, motion } from "framer-motion"
import { ListPlus, Minus, Plus, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import type { ChangelogCategory } from "../../types/changelog.types"
import type { TitleGroup } from "../../utils/formGroups"

interface Props {
    category: ChangelogCategory
    groups: TitleGroup[]
    isEdit: boolean
    onAddGroup: () => void
    onRemoveGroup: (groupIndex: number) => void
    onTitleChange: (groupIndex: number, title: string) => void
    onAddDescription: (groupIndex: number) => void
    onDescriptionChange: (
        groupIndex: number,
        descriptionIndex: number,
        value: string
    ) => void
    onRemoveDescription: (groupIndex: number, descriptionIndex: number) => void
}

/**
 * Saisie du contenu d'une catégorie : des titres, et sous chacun des
 * lignes de description.
 *
 * Les couleurs viennent de la base (`changelog_categories.color`) — cas de
 * couleur de donnée du design system (§12.4), d'où les styles en ligne.
 */
export function CategoryItemsEditor({
    category,
    groups,
    isEdit,
    onAddGroup,
    onRemoveGroup,
    onTitleChange,
    onAddDescription,
    onDescriptionChange,
    onRemoveDescription,
}: Props) {
    return (
        <div className="rounded-2xl border border-border/60 bg-background/95 p-4 shadow-xs backdrop-blur sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                    />
                    <h3 className="text-lg font-semibold">{category.name}</h3>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center sm:w-auto"
                    onClick={onAddGroup}
                >
                    <Plus className="size-4" />
                    Nouveau titre
                </Button>
            </div>

            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                {groups.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={ListPlus}
                        title="Aucun élément"
                        description={
                            isEdit
                                ? "Cette catégorie est vide."
                                : "Rien n'a encore été ajouté pour cette catégorie."
                        }
                    />
                ) : (
                    <AnimatePresence initial={false}>
                        {groups.map((group, groupIndex) => (
                            <motion.div
                                // eslint-disable-next-line react-x/no-array-index-key -- les groupes en cours de saisie n'ont pas d'identifiant ; l'indice EST leur identité
                                key={`${category.id}-g-${groupIndex}`}
                                layout
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                transition={{ duration: 0.18, ease: "easeOut" }}
                                className="overflow-hidden rounded-xl border"
                                style={{
                                    borderLeftWidth: 3,
                                    borderLeftColor: category.color,
                                }}
                            >
                                <div
                                    className="flex items-center gap-2 p-3"
                                    style={{
                                        backgroundColor: `${category.color}0a`,
                                    }}
                                >
                                    <Input
                                        placeholder="Titre (ex. CRM, Messagerie…)"
                                        value={group.title}
                                        onChange={(e) =>
                                            onTitleChange(
                                                groupIndex,
                                                e.target.value
                                            )
                                        }
                                        aria-label="Titre de l'entrée"
                                        className="flex-1 border-0 bg-transparent px-1 text-base font-semibold shadow-none focus-visible:ring-0"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                        aria-label="Supprimer ce titre"
                                        onClick={() =>
                                            onRemoveGroup(groupIndex)
                                        }
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>

                                <div className="space-y-2 p-3">
                                    {group.descriptions.map(
                                        (description, descriptionIndex) => (
                                            <div
                                                // eslint-disable-next-line react-x/no-array-index-key -- idem : l'indice est l'identité de la ligne en cours de saisie
                                                key={`${category.id}-g${groupIndex}-d${descriptionIndex}`}
                                                className="flex items-start gap-2"
                                            >
                                                <span className="mt-2.5 shrink-0 text-sm text-muted-foreground">
                                                    •
                                                </span>
                                                <Textarea
                                                    placeholder="Description..."
                                                    value={description}
                                                    onChange={(e) =>
                                                        onDescriptionChange(
                                                            groupIndex,
                                                            descriptionIndex,
                                                            e.target.value
                                                        )
                                                    }
                                                    rows={2}
                                                    aria-label="Description"
                                                    className="flex-1 resize-none text-sm"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="mt-1 size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                                    aria-label="Supprimer cette ligne"
                                                    onClick={() =>
                                                        onRemoveDescription(
                                                            groupIndex,
                                                            descriptionIndex
                                                        )
                                                    }
                                                >
                                                    <Minus className="size-3.5" />
                                                </Button>
                                            </div>
                                        )
                                    )}

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="mt-1 w-full justify-start text-xs text-muted-foreground"
                                        onClick={() =>
                                            onAddDescription(groupIndex)
                                        }
                                    >
                                        <Plus className="size-3" />
                                        Ajouter une ligne
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    )
}
