export function normalizeBudget(raw: string | null): string {
    const value = (raw ?? "").toString().trim()
    if (!value) return "Inconnu"

    // If a phone number or unexpected numeric blob ended up here, avoid polluting budget buckets.
    if (/^\d{8,}$/.test(value.replace(/\s+/g, ""))) {
        return "Inconnu"
    }

    const lower = value
        .toLowerCase()
        // normalize non-breaking spaces
        .replace(/\u00a0/g, " ")
        .trim()

    const labels = {
        b0: "Budget entre 500 et 1 000 €",
        b1: "Budget entre 1 000 et 3 000 €",
        b2: "Budget entre 3 000 et 5 000 €",
        b3: "Budget entre 5 000 et 10 000 €",
        b4: "Budget supérieur à 10 000 €",
    }

    // 1) Textual shortcuts (handle concatenated option strings).
    if (
        lower.includes("entre 500") ||
        lower.includes("between €500") ||
        lower.includes("between 500")
    ) {
        return labels.b0
    }
    if (
        lower.includes("entre 1") ||
        lower.includes("between €1") ||
        lower.includes("between 1")
    ) {
        return labels.b1
    }
    if (
        lower.includes("entre 3") ||
        lower.includes("between €3") ||
        lower.includes("between 3")
    ) {
        return labels.b2
    }
    if (
        lower.includes("entre 5") ||
        lower.includes("between €5") ||
        lower.includes("between 5")
    ) {
        return labels.b3
    }
    if (
        lower.includes("supérieur") ||
        lower.includes("over €10") ||
        lower.includes("over 10") ||
        lower.includes("plus de")
    ) {
        return labels.b4
    }

    // 2) Robust numeric extraction.
    // Handles: "€1,000", "1 000", "1000", "2000€", etc.
    const numbers = (lower.match(/\d[\d\s.,]*/g) ?? [])
        .map((chunk) => Number(chunk.replace(/\D/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0)

    if (numbers.length > 0) {
        const min = Math.min(...numbers)
        const max = Math.max(...numbers)

        // If it's clearly an "over"/"above" style entry with 10k+, force the top bucket.
        if (
            (lower.includes("over") ||
                lower.includes("sup") ||
                lower.includes("plus de") ||
                lower.includes(">")) &&
            max >= 10000
        ) {
            return labels.b4
        }

        // Range-style entries (between X and Y).
        if (numbers.length >= 2) {
            if (min >= 400 && max <= 1100) return labels.b0
            if (min >= 900 && max <= 3100) return labels.b1
            if (min >= 2900 && max <= 5100) return labels.b2
            if (min >= 4900 && max <= 10100) return labels.b3
            if (max > 10100) return labels.b4
        }

        // Single-amount entries.
        const amount = numbers[0]
        if (amount >= 500 && amount < 1000) return labels.b0
        if (amount >= 1000 && amount < 3000) return labels.b1
        if (amount >= 3000 && amount < 5000) return labels.b2
        if (amount >= 5000 && amount <= 10000) return labels.b3
        if (amount > 10000) return labels.b4
    }

    return value
}

export function normalizeActivity(raw: string): string {
    const value = (raw ?? "").toString().trim()
    if (!value) return "Inconnu"

    // If a phone number or unexpected numeric blob ended up here, avoid polluting activity buckets.
    if (/^\d{8,}$/.test(value.replace(/\s+/g, ""))) {
        return "Inconnu"
    }

    const lower = value.toLowerCase()
    const compact = lower.replace(/\s+/g, "")
    const compactAlnum = lower.replace(/[^a-z0-9]+/g, "")

    // Accept variants like "E-shop", "e shop", and concatenated strings.
    if (
        compactAlnum.includes("eshop") ||
        compact.includes("e-shop") ||
        compactAlnum.includes("iameshop")
    ) {
        return "E-shop"
    }
    if (compact.includes("grossiste") || compact.includes("wholesaler")) {
        return "Grossiste"
    }
    if (compact.includes("boutique") || compact.includes("iamashop")) {
        return "Boutique"
    }
    if (compact.includes("friperie")) {
        return "Friperie"
    }
    if (compact.includes("depop")) {
        return "Depop"
    }
    if (compact.includes("Pop-up / Corner store")) {
        return "Pop-up / Corner store"
    }
    if (
        compact.includes("ephemere") ||
        compact.includes("éphémère") ||
        compact.includes("marche") ||
        compact.includes("marché") ||
        compact.includes("commerce")
    ) {
        return "Commerce éphémère"
    }
    if (
        compact.includes("mobile") ||
        compact.includes("pop-up") ||
        compact.includes("popup") ||
        compact.includes("retailer")
    ) {
        return "Pop-up / Mobile"
    }

    return value
}

/**
 * Ordre d'affichage du niveau d'urgence, du plus pressé au moins pressé.
 *
 * Vit à côté de `normalizeUrgency` : les libellés produits par la
 * normalisation et l'ordre qui les classe doivent rester dans le même fichier,
 * sinon ils divergent au premier renommage.
 */
export const URGENCY_ORDER = [
    "Besoin immédiat",
    "D'ici 1 semaine",
    "D'ici la fin du mois",
    "Sans urgence",
    "Inconnu",
]

/**
 * Le formulaire du site existe en français et en anglais : le même niveau
 * d'urgence arrive donc sous deux libellés ("Sans urgence" / "No urgency"),
 * qui comptaient jusqu'ici pour deux barres distinctes dans les statistiques.
 *
 * Détection par mots-clés plutôt que par correspondance exacte, comme pour
 * l'activité : la casse, les accents et les variantes de ponctuation d'un
 * champ de formulaire ne sont pas garantis dans le temps.
 */
export function normalizeUrgency(raw: string | null): string {
    const value = (raw ?? "").toString().trim()
    if (!value) return "Inconnu"

    const lower = value
        .toLowerCase()
        // normalise les espaces insécables
        .replace(/\u00a0/g, " ")

    // "immediat" couvre aussi l'anglais "immediate".
    if (lower.includes("immédiat") || lower.includes("immediat")) {
        return "Besoin immédiat"
    }
    if (lower.includes("semaine") || lower.includes("week")) {
        return "D'ici 1 semaine"
    }
    if (lower.includes("mois") || lower.includes("month")) {
        return "D'ici la fin du mois"
    }
    if (lower.includes("sans urgence") || lower.includes("no urgency")) {
        return "Sans urgence"
    }

    return value
}
