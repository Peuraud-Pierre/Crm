// Public API de la feature dashboard — seuls ces exports peuvent être
// utilisés hors de dashboard/ (docs/Architecture_Feature.pdf §4).
//
// Le dashboard consomme les widgets des autres features par leurs
// barrels ; l'inverse n'existe pas. Seule la console Manager importe
// d'ici, pour l'onglet d'administration des gabarits.

export { DASHBOARD_PERMISSIONS } from "./constants"
export { DashboardTemplatesAdmin } from "./components/admin/DashboardTemplatesAdmin"
