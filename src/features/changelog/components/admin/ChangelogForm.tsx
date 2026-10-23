"use client"

import { Save } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useChangelogForm } from "../../hooks/useChangelogForm"
import { useChangelogTemplateIO } from "../../hooks/useChangelogTemplateIO"
import type { ChangelogVersionWithItems } from "../../types/changelog.types"
import { CategoryItemsEditor } from "./CategoryItemsEditor"
import { VersionMetaFields } from "./VersionMetaFields"

interface Props {
    mode: "create" | "edit"
    version?: ChangelogVersionWithItems
    setOpen: (open: boolean) => void
}

/**
 * Création / modification d'une version de changelog.
 *
 * Remplace `manager/components/Changelog/changelogForm.tsx` (881 lignes),
 * qui portait dans un seul composant l'état du formulaire, les onze
 * opérations de manipulation des groupes, la suggestion SemVer,
 * l'import/export JSON et l'intégralité du rendu. Ce fichier ne fait plus
 * que l'assemblage ; chaque partie a sa propre unité.
 */
export function ChangelogForm({ mode, version, setOpen }: Props) {
    const form = useChangelogForm({
        mode,
        version,
        onDone: () => setOpen(false),
    })

    const { exportTemplate, importTemplate } = useChangelogTemplateIO({
        categories: form.categories,
        groupsByCategory: form.groupsByCategory,
        version: form.formVersion,
        summary: form.summary,
        onImport: ({ version: v, summary, groupsByCategory }) => {
            if (v) form.setFormVersion(v)
            if (summary) form.setSummary(summary)
            if (groupsByCategory) form.setGroupsByCategory(groupsByCategory)
        },
    })

    return (
        <div className="flex w-full justify-center">
            <div className="w-full max-w-(--breakpoint-xl) px-3 sm:px-4 lg:px-6">
                <form
                    className="mt-4 flex flex-col gap-6 sm:mt-6 lg:grid lg:grid-cols-[360px_1fr] lg:gap-10"
                    onSubmit={(e) => {
                        e.preventDefault()
                        void form.submit()
                    }}
                >
                    <VersionMetaFields
                        isEdit={form.isEdit}
                        version={form.formVersion}
                        onVersionChange={form.setFormVersion}
                        date={form.date}
                        onDateChange={form.setDate}
                        status={form.status}
                        onStatusChange={form.setStatus}
                        summary={form.summary}
                        onSummaryChange={form.setSummary}
                        latestPublished={form.latestPublished}
                        suggestedBump={form.suggestedBump}
                        onImport={importTemplate}
                        onExport={exportTemplate}
                    />

                    <section className="space-y-8 rounded-2xl bg-background p-4 shadow-xs sm:p-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <h2 className="text-xl font-semibold">
                                {form.isEdit
                                    ? "Édition du changelog"
                                    : "Détails du changelog"}
                            </h2>
                            <Button
                                type="submit"
                                size="sm"
                                loading={form.saving}
                                className="hidden sm:flex"
                            >
                                <Save className="size-4" />
                                {form.isEdit ? "Mettre à jour" : "Enregistrer"}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:gap-8">
                            {form.categories.map((category) => (
                                <CategoryItemsEditor
                                    key={category.id}
                                    category={category}
                                    groups={form.getGroups(category.id)}
                                    isEdit={form.isEdit}
                                    onAddGroup={() =>
                                        form.addGroup(category.id)
                                    }
                                    onRemoveGroup={(i) =>
                                        form.removeGroup(category.id, i)
                                    }
                                    onTitleChange={(i, title) =>
                                        form.setGroupTitle(
                                            category.id,
                                            i,
                                            title
                                        )
                                    }
                                    onAddDescription={(i) =>
                                        form.addDescription(category.id, i)
                                    }
                                    onDescriptionChange={(i, j, value) =>
                                        form.setDescription(
                                            category.id,
                                            i,
                                            j,
                                            value
                                        )
                                    }
                                    onRemoveDescription={(i, j) =>
                                        form.removeDescription(
                                            category.id,
                                            i,
                                            j
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </section>

                    {/* Sur mobile, la colonne de gauche n'est plus collée : le
                        bouton d'enregistrement a besoin de son propre ancrage. */}
                    <div className="sticky bottom-0 mt-4 border-t bg-background p-3 shadow-xs sm:p-4 lg:hidden">
                        <Button
                            type="submit"
                            size="lg"
                            loading={form.saving}
                            className="w-full"
                        >
                            <Save className="size-5" />
                            {form.isEdit
                                ? "Mettre à jour le changelog"
                                : "Enregistrer le changelog"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
