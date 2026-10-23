// Public API de la feature tickets — seuls ces exports peuvent être
// utilisés hors de tickets/ (docs/Architecture_Feature.pdf §4).
//
// Le barrel est créé ici pour exposer les widgets de dashboard sans
// ouvrir l'accès aux internes de la feature.

/** Modules posables sur le dashboard (contrat shared/types/widget.types). */
export { ticketWidgets } from "./widgets"
