// Public API de la feature changelog — seuls ces exports peuvent être
// utilisés hors de changelog/ (docs/Architecture_Feature.pdf §4).

export { CHANGELOG_PERMISSIONS, DEPLOY_TZ } from "./constants"

export type {
    ChangelogCategory,
    ChangelogItemWithCategory,
    ChangelogVersion,
    ChangelogVersionStatus,
    ChangelogVersionWithItems,
} from "./types/changelog.types"

export {
    ChangelogProvider,
    useChangelogContext,
} from "./hooks/context/ChangelogProvider"

/** Numéro de version de l'application, pour la sidebar. */
export { useAppVersion } from "./hooks/data/useAppVersion"

/** Zone fixe en pied du dashboard — voir features/dashboard. */
export { ChangelogRail } from "./components/rail/ChangelogRail"

export { ChangelogAdmin } from "./components/admin/ChangelogAdmin"

export {
    compareVersions,
    displayVersion,
    isValidSemVer,
} from "./utils/compareVersions"
export { selectLatestPublished } from "./utils/selectVersions"
