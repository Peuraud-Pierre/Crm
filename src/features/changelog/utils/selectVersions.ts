import { compareVersions } from "./compareVersions"
import type { ChangelogVersion } from "../types/changelog.types"

/**
 * Versions publiées, de la plus récente à la plus ancienne.
 *
 * Ce couple filtre + tri était réécrit à la main dans quatre fichiers
 * (`Changelog.tsx`, `Home.tsx`, `Sidebar.tsx`, `changelogForm.tsx`), avec
 * à chaque fois le risque d'inverser les opérandes de `compareVersions` et
 * d'obtenir un ordre à l'envers. Il vit désormais ici, seul.
 */
export function selectPublished<T extends ChangelogVersion>(
    versions: T[]
): T[] {
    return versions
        .filter((v) => v.status === "published")
        .sort((a, b) => compareVersions(b.version, a.version))
}

/** Dernière version publiée, ou null si aucune ne l'est. */
export function selectLatestPublished<T extends ChangelogVersion>(
    versions: T[]
): T | null {
    return selectPublished(versions)[0] ?? null
}
