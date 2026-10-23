/**
 * Barrel file — re-exporte tous les types de la feature stock.
 *
 * Les imports existants `from "./stock.types"` continuent de fonctionner
 * sans modification. Pour les nouveaux fichiers, préférer l'import direct
 * depuis le fichier de domaine concerné :
 *
 *   import type { Balle } from "./balle.types"          ✅ préféré
 *   import type { Balle } from "./stock.types"           ✅ toléré (backward compat)
 */

export * from "./ui.types"
export * from "./referential.types"
export * from "./balle.types"
export * from "./livraison.types"
export * from "./shipment.types"
export * from "./history.types"
