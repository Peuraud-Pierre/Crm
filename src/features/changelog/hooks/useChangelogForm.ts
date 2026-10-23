import { useCallback, useEffect, useMemo, useState } from "react"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { toast } from "sonner"
import { DEPLOY_TZ } from "../constants"
import { useChangelogContext } from "./context/ChangelogProvider"
import { detectBumpType, isValidSemVer } from "../utils/compareVersions"
import {
    groupsToItems,
    hasContent,
    itemsToGroups,
    type TitleGroup,
} from "../utils/formGroups"
import { selectLatestPublished } from "../utils/selectVersions"
import type {
    ChangelogItemInput,
    ChangelogVersionStatus,
    ChangelogVersionWithItems,
} from "../types/changelog.types"

interface Options {
    mode: "create" | "edit"
    version?: ChangelogVersionWithItems
    onDone: () => void
}

/**
 * État et logique du formulaire de changelog.
 *
 * Extrait de `changelogForm.tsx` (881 lignes), qui mêlait dans un seul
 * composant : l'état du formulaire, les onze opérations de manipulation
 * des groupes, la suggestion SemVer, l'import/export JSON et 460 lignes de
 * JSX.
 */
export function useChangelogForm({ mode, version, onDone }: Options) {
    const { categories, versions, createVersion, editVersion } =
        useChangelogContext()

    const isEdit = mode === "edit"

    const [formVersion, setFormVersion] = useState("")
    const [date, setDate] = useState("")
    const [status, setStatus] = useState<ChangelogVersionStatus>("draft")
    const [summary, setSummary] = useState("")
    const [saving, setSaving] = useState(false)
    const [groupsByCategory, setGroupsByCategory] = useState<
        Map<string, TitleGroup[]>
    >(() => new Map())

    /** Dernière version publiée — référence des boutons d'incrémentation. */
    const latestPublished = useMemo(
        () => selectLatestPublished(versions)?.version ?? null,
        [versions]
    )

    /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- initialisation d'un formulaire contrôlé depuis la version éditée */
    useEffect(() => {
        if (isEdit && version) {
            setFormVersion(version.version)
            setStatus(version.status)
            setSummary(version.summary ?? "")

            if (version.deployment_date) {
                setDate(
                    formatInTimeZone(
                        version.deployment_date,
                        DEPLOY_TZ,
                        "yyyy-MM-dd'T'HH:mm"
                    )
                )
            }

            const existing: ChangelogItemInput[] = version.items.map(
                (item, i) => ({
                    id: item.id,
                    category_id: item.category_id,
                    title: item.title,
                    description: item.description ?? "",
                    position: i,
                })
            )

            setGroupsByCategory(
                new Map(
                    categories.map((c) => [c.id, itemsToGroups(existing, c.id)])
                )
            )
        } else if (categories.length > 0) {
            setGroupsByCategory((prev) =>
                prev.size === 0
                    ? new Map(categories.map((c) => [c.id, []]))
                    : prev
            )
        }
    }, [isEdit, version, categories])
    /* eslint-enable @eslint-react/hooks-extra/no-direct-set-state-in-use-effect */

    const getGroups = useCallback(
        (categoryId: string): TitleGroup[] =>
            groupsByCategory.get(categoryId) ?? [],
        [groupsByCategory]
    )

    /**
     * Applique une transformation aux groupes d'une catégorie.
     * Les onze mutations du formulaire passent par là plutôt que de
     * répéter chacune le clonage du tableau.
     */
    const editGroups = useCallback(
        (categoryId: string, fn: (groups: TitleGroup[]) => TitleGroup[]) => {
            setGroupsByCategory((prev) => {
                const next = new Map(prev)
                next.set(categoryId, fn([...(prev.get(categoryId) ?? [])]))
                return next
            })
        },
        []
    )

    const addGroup = useCallback(
        (categoryId: string) =>
            editGroups(categoryId, (groups) => [
                ...groups,
                { categoryId, title: "", descriptions: [""] },
            ]),
        [editGroups]
    )

    const removeGroup = useCallback(
        (categoryId: string, groupIndex: number) =>
            editGroups(categoryId, (groups) =>
                groups.filter((_, i) => i !== groupIndex)
            ),
        [editGroups]
    )

    const setGroupTitle = useCallback(
        (categoryId: string, groupIndex: number, title: string) =>
            editGroups(categoryId, (groups) =>
                groups.map((g, i) => (i === groupIndex ? { ...g, title } : g))
            ),
        [editGroups]
    )

    const addDescription = useCallback(
        (categoryId: string, groupIndex: number) =>
            editGroups(categoryId, (groups) =>
                groups.map((g, i) =>
                    i === groupIndex
                        ? { ...g, descriptions: [...g.descriptions, ""] }
                        : g
                )
            ),
        [editGroups]
    )

    const setDescription = useCallback(
        (
            categoryId: string,
            groupIndex: number,
            descriptionIndex: number,
            value: string
        ) =>
            editGroups(categoryId, (groups) =>
                groups.map((g, i) =>
                    i === groupIndex
                        ? {
                              ...g,
                              descriptions: g.descriptions.map((d, j) =>
                                  j === descriptionIndex ? value : d
                              ),
                          }
                        : g
                )
            ),
        [editGroups]
    )

    const removeDescription = useCallback(
        (categoryId: string, groupIndex: number, descriptionIndex: number) =>
            editGroups(categoryId, (groups) =>
                groups.flatMap((g, i) => {
                    if (i !== groupIndex) return [g]

                    const descriptions = g.descriptions.filter(
                        (_, j) => j !== descriptionIndex
                    )
                    // Retirer la dernière ligne retire le groupe : un titre
                    // sans description ne produirait aucun élément.
                    return descriptions.length === 0
                        ? []
                        : [{ ...g, descriptions }]
                })
            ),
        [editGroups]
    )

    /** Type d'incrémentation suggéré d'après les catégories renseignées. */
    const suggestedBump = useMemo(
        () =>
            detectBumpType(
                categories
                    .filter((c) => hasContent(groupsByCategory.get(c.id) ?? []))
                    .map((c) => c.name)
            ),
        [categories, groupsByCategory]
    )

    const submit = useCallback(async () => {
        if (!isValidSemVer(formVersion)) {
            toast.error(
                "Numéro de version invalide — format attendu : X.Y.Z (ex. 2.1.0)"
            )
            return
        }

        if (!date.includes("T")) {
            toast.error("Renseignez une date de déploiement valide")
            return
        }

        const deployDate = fromZonedTime(date, DEPLOY_TZ)
        if (Number.isNaN(deployDate.getTime())) {
            toast.error("Date de déploiement invalide")
            return
        }

        const allGroups = categories.flatMap((c) => getGroups(c.id))

        const input = {
            // Stocké sans préfixe « v », comme le reste de la base.
            version: formVersion.trim().replace(/^v/, ""),
            deployment_date: deployDate.toISOString(),
            status,
            summary: summary.trim() || undefined,
            items: groupsToItems(allGroups),
        }

        setSaving(true)
        const ok =
            isEdit && version
                ? await editVersion(version.id, input)
                : await createVersion(input)
        setSaving(false)

        if (ok) onDone()
    }, [
        formVersion,
        date,
        status,
        summary,
        categories,
        getGroups,
        isEdit,
        version,
        editVersion,
        createVersion,
        onDone,
    ])

    return {
        isEdit,
        categories,
        latestPublished,
        suggestedBump,
        saving,

        formVersion,
        setFormVersion,
        date,
        setDate,
        status,
        setStatus,
        summary,
        setSummary,

        groupsByCategory,
        setGroupsByCategory,
        getGroups,
        addGroup,
        removeGroup,
        setGroupTitle,
        addDescription,
        setDescription,
        removeDescription,

        submit,
    }
}
