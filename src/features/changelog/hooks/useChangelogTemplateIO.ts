import { useCallback } from "react"
import { toast } from "sonner"
import type { ChangelogCategory } from "../types/changelog.types"
import type { TitleGroup } from "../utils/formGroups"

/** Forme du fichier échangé — pensée pour être lisible par un humain ou un LLM. */
interface TemplateFile {
    version?: string
    summary?: string
    categories?: Record<string, { titre?: string; contenu?: string }[]>
}

interface Options {
    categories: ChangelogCategory[]
    groupsByCategory: Map<string, TitleGroup[]>
    version: string
    summary: string
    onImport: (data: {
        version?: string
        summary?: string
        groupsByCategory?: Map<string, TitleGroup[]>
    }) => void
}

/**
 * Import / export du changelog au format JSON.
 *
 * L'usage visé (documenté dans l'écran) : exporter la structure vide,
 * la faire remplir par un LLM, réimporter le résultat.
 *
 * Extrait du formulaire, où ces deux fonctions occupaient une centaine de
 * lignes au milieu de la logique de saisie et signalaient leurs erreurs
 * par `alert()`.
 */
export function useChangelogTemplateIO({
    categories,
    groupsByCategory,
    version,
    summary,
    onImport,
}: Options) {
    const exportTemplate = useCallback(() => {
        const template: TemplateFile["categories"] = {}

        for (const category of categories) {
            template[category.name] = (
                groupsByCategory.get(category.id) ?? []
            ).flatMap((group) =>
                group.descriptions.map((contenu) => ({
                    titre: group.title,
                    contenu: contenu || "",
                }))
            )
        }

        const payload: TemplateFile = {
            version: version || "vX.X.X",
            summary,
            categories: template,
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `changelog-template${version ? `-${version}` : ""}.json`
        link.click()
        URL.revokeObjectURL(url)
    }, [categories, groupsByCategory, version, summary])

    const importTemplate = useCallback(() => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = ".json"

        input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) return

            try {
                const data = JSON.parse(await file.text()) as TemplateFile

                let nextGroups: Map<string, TitleGroup[]> | undefined
                if (data.categories && typeof data.categories === "object") {
                    nextGroups = new Map()

                    for (const category of categories) {
                        // Correspondance par nom, insensible à la casse : le
                        // fichier ne connaît pas les identifiants.
                        const key = Object.keys(data.categories).find(
                            (k) =>
                                k.toLowerCase() === category.name.toLowerCase()
                        )
                        const entries =
                            key && Array.isArray(data.categories[key])
                                ? data.categories[key]
                                : []

                        const byTitle = new Map<string, string[]>()
                        const order: string[] = []

                        for (const entry of entries) {
                            const title = entry.titre ?? ""
                            let descriptions = byTitle.get(title)
                            if (!descriptions) {
                                descriptions = []
                                byTitle.set(title, descriptions)
                                order.push(title)
                            }
                            descriptions.push(entry.contenu ?? "")
                        }

                        nextGroups.set(
                            category.id,
                            order.map((title) => ({
                                categoryId: category.id,
                                title,
                                descriptions: byTitle.get(title)!,
                            }))
                        )
                    }
                }

                onImport({
                    version: data.version,
                    summary: data.summary,
                    groupsByCategory: nextGroups,
                })
                toast.success("Changelog importé")
            } catch (err) {
                console.error("[useChangelogTemplateIO] import:", err)
                toast.error("Fichier JSON invalide")
            }
        }

        input.click()
    }, [categories, onImport])

    return { exportTemplate, importTemplate }
}
