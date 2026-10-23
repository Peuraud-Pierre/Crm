// Public API de la feature maintenance — seuls ces exports peuvent être
// utilisés hors de maintenance/ (docs/Architecture_Feature.pdf §4).
//
// La feature est consommée par l'app-shell (AuthGuardLayout, Header) et
// par la console Manager. C'est la raison d'être de ce découpage : avant,
// l'app-shell importait en profondeur dans `features/manager`, une feature
// d'administration — une inversion de dépendance.

export { MAINTENANCE_PERMISSIONS } from "./constants"

export type {
    MaintenanceScope,
    MaintenanceWindow,
    MaintenanceDraft,
    MaintenanceUpdate,
    MaintenanceState,
} from "./types/maintenance.types"

export {
    MaintenanceProvider,
    useMaintenanceContext,
} from "./hooks/context/MaintenanceProvider"

export { MaintenanceBanner } from "./components/MaintenanceBanner"
export { MaintenanceAdmin } from "./components/admin/MaintenanceAdmin"
export { MaintenanceScreen } from "./components/MaintenanceScreen"

export { getTimeDiffInfo } from "./utils/timeRules"
