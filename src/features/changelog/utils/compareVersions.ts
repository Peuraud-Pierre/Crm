/**
 * Compare deux chaînes de version SemVer (MAJOR.MINOR.PATCH).
 * Supporte le préfixe "v" optionnel (ex: "v2.0.0", "1.9.2").
 * Retourne < 0 si a < b, 0 si a === b, > 0 si a > b.
 */
export function compareVersions(a: string, b: string): number {
    const pa = a.replace(/^v/, "").split(".").map(Number)
    const pb = b.replace(/^v/, "").split(".").map(Number)
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
        const na = pa[i] ?? 0
        const nb = pb[i] ?? 0
        if (na !== nb) return na - nb
    }
    return 0
}

/** Valide qu'une chaîne respecte le format SemVer strict : X.Y.Z (préfixe v optionnel). */
export function isValidSemVer(v: string): boolean {
    return /^v?\d+\.\d+\.\d+$/.test(v.trim())
}

/**
 * Normalise une version SemVer : retire le préfixe "v" et renvoie "X.Y.Z".
 * Retourne null si le format est invalide.
 */
export function normalizeSemVer(v: string): string | null {
    const clean = v.trim().replace(/^v/, "")
    if (!/^\d+\.\d+\.\d+$/.test(clean)) return null
    return clean
}

/**
 * Retourne la version formatée pour l'affichage avec préfixe "v".
 * Ex: "2.1.0" → "v2.1.0" | null si invalide.
 */
export function displayVersion(v: string): string | null {
    const norm = normalizeSemVer(v)
    return norm ? `v${norm}` : null
}

/**
 * Incrémente une version SemVer selon le type de bump.
 * - major : X+1.0.0
 * - minor : X.Y+1.0
 * - patch : X.Y.Z+1
 * Retourne null si la version source est invalide.
 */
export function bumpVersion(
    current: string,
    type: "major" | "minor" | "patch"
): string | null {
    const norm = normalizeSemVer(current)
    if (!norm) return null
    const [major, minor, patch] = norm.split(".").map(Number)
    switch (type) {
        case "major":
            return `${major + 1}.0.0`
        case "minor":
            return `${major}.${minor + 1}.0`
        case "patch":
            return `${major}.${minor}.${patch + 1}`
    }
}

// ─── Mots-clés SemVer par type (FR + EN) ─────────────────────────────────────
// Priorité : major > minor > patch
const SEMVER_KEYWORDS: Record<"major" | "minor" | "patch", string[]> = {
    major: [
        // FR
        "rupture",
        "cassant",
        "incompatible",
        "refonte",
        "migration",
        "suppression",
        "supprimé",
        "breaking",
        "majeur",
        "réécriture",
        // EN
        "breaking",
        "breaking change",
        "removed",
        "dropped",
        "incompatible",
        "rewrite",
        "migration",
        "redesign",
    ],
    minor: [
        // FR
        "fonctionnalité",
        "feature",
        "ajout",
        "ajouté",
        "nouveau",
        "nouvelle",
        "amélioration",
        "améliorer",
        "enhancement",
        "nouvelle fonctionnalité",
        "nouvelle feature",
        "ajout de",
        "nouvelles",
        // EN
        "feature",
        "new",
        "add",
        "added",
        "enhancement",
        "improvement",
        "introduce",
        "support",
    ],
    patch: [
        // FR
        "correctif",
        "correction",
        "corrigé",
        "bug",
        "fix",
        "fixé",
        "patch",
        "hotfix",
        "maintenance",
        "sécurité",
        "stabilité",
        "performance",
        "optimisation",
        "typo",
        "mise à jour mineure",
        // EN
        "fix",
        "bug fix",
        "bugfix",
        "hotfix",
        "patch",
        "security",
        "performance",
        "refactor",
        "typo",
        "stability",
        "minor",
    ],
}

/**
 * Détecte le type de bump SemVer à partir des noms de catégories actives.
 * Une catégorie est « active » si `hasContent(categoryId)` retourne true.
 *
 * Algorithme :
 *   1. Pour chaque catégorie active, on cherche ses mots-clés (major > minor > patch).
 *   2. Le type avec la priorité la plus haute parmi toutes les catégories actives l'emporte.
 *   3. Si aucun mot-clé ne correspond mais qu'il y a du contenu → "minor" par défaut.
 *   4. Aucun contenu → null (pas de suggestion).
 *
 * @param activeCategories  Liste des noms de catégories ayant du contenu.
 * @returns "major" | "minor" | "patch" | null
 */
export function detectBumpType(
    activeCategories: string[]
): "major" | "minor" | "patch" | null {
    if (activeCategories.length === 0) return null

    const PRIORITY: Record<"major" | "minor" | "patch", number> = {
        major: 3,
        minor: 2,
        patch: 1,
    }

    let detected: "major" | "minor" | "patch" | null = null
    let maxPriority = 0

    for (const name of activeCategories) {
        const normalized = name.toLowerCase().trim()

        for (const type of ["major", "minor", "patch"] as const) {
            const matched = SEMVER_KEYWORDS[type].some((kw) =>
                normalized.includes(kw)
            )
            if (matched && PRIORITY[type] > maxPriority) {
                detected = type
                maxPriority = PRIORITY[type]
            }
        }
    }

    // Contenu présent mais aucun mot-clé reconnu → minor par défaut
    return detected ?? "minor"
}
