import type { WidgetSettingValue } from "@/shared/types/widget.types"

/**
 * Encodage d'un réglage `multiselect`.
 *
 * Les valeurs de réglage sont scalaires par contrat (`settingValueSchema`,
 * `features/dashboard/types/layout.types.ts`) : un choix multiple voyage
 * donc comme une liste séparée par des virgules. Ces deux fonctions sont
 * le seul endroit qui connaît cet encodage — nulle part ailleurs on ne
 * fait de `.split(",")` sur un réglage.
 */

/**
 * Lit une liste enregistrée.
 *
 * **Vide = « tout », pas « rien »** : un module qu'on vient de poser n'a
 * aucun réglage enregistré, et doit montrer quelque chose. C'est à
 * l'appelant de traiter le tableau vide comme « aucun filtre » ; la
 * fonction se contente de ne pas inventer d'entrée.
 *
 * Les doublons sont écartés et l'ordre de saisie conservé : c'est l'ordre
 * dans lequel l'utilisateur a coché, donc celui qu'il s'attend à voir.
 */
export function parseList(value: WidgetSettingValue | undefined): string[] {
    if (typeof value !== "string" || value.trim() === "") return []

    const seen = new Set<string>()
    const out: string[] = []

    for (const part of value.split(",")) {
        const key = part.trim()
        if (key === "" || seen.has(key)) continue
        seen.add(key)
        out.push(key)
    }

    return out
}

/** Réécrit une liste pour l'enregistrement. */
export function serializeList(values: string[]): string {
    const seen = new Set<string>()
    const out: string[] = []

    for (const raw of values) {
        const key = raw.trim()
        if (key === "" || seen.has(key)) continue
        seen.add(key)
        out.push(key)
    }

    return out.join(",")
}

/**
 * Applique une sélection à une liste d'éléments.
 *
 * Sélection vide → tout, dans l'ordre d'origine. Sinon l'ordre de la
 * **sélection** l'emporte, et les clés qui ne correspondent à rien sont
 * ignorées en silence : un raccourci vers une page dont la permission a
 * été retirée disparaît de lui-même, sans qu'il faille nettoyer la
 * disposition en base — même principe d'auto-nettoyage que
 * `listAvailableWidgets`.
 */
export function applySelection<T>(
    items: T[],
    selected: string[],
    keyOf: (item: T) => string
): T[] {
    if (selected.length === 0) return items

    const byKey = new Map(items.map((item) => [keyOf(item), item]))

    return selected
        .map((key) => byKey.get(key))
        .filter((item): item is T => item !== undefined)
}
