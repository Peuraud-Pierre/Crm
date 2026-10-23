/**
 * Codes lisibles de la salle de commande.
 *
 *   commande  CMD-0017
 *   livraison LIV-0042
 *   palette   LIV-0042-P2
 *   carton    LIV-0042-C07   ← le contenu du QR de l'étiquette logistique
 *
 * Miroir de `code_livraison` / `code_commande` et de la vue `v_cartons`
 * (migration `20261001110000_stock_commandes.sql`).
 *
 * Le QR porte le code LISIBLE, pas une URL de nokk_project : la même étiquette
 * doit pouvoir être lue demain par la console retail, et le code imprimé en
 * clair sous le QR sert de saisie de secours.
 *
 * Le code d'un carton ne contient PAS sa palette : un carton déplacé d'une
 * palette à l'autre garderait sinon un code faux.
 */

const pad = (n: number, width: number) => String(n).padStart(width, "0")

export const formatCommandeCode = (numero: number) => `CMD-${pad(numero, 4)}`
export const formatLivraisonCode = (numero: number) => `LIV-${pad(numero, 4)}`
export const formatPaletteCode = (livraison: number, palette: number) =>
    `${formatLivraisonCode(livraison)}-P${palette}`
export const formatCartonCode = (livraison: number, carton: number) =>
    `${formatLivraisonCode(livraison)}-C${pad(carton, 2)}`

export interface CartonRef {
    livraisonNumero: number
    cartonNumero: number
}

/**
 * Lit un code de carton tel qu'un humain ou un lecteur le rend : casse,
 * espaces, tirets manquants et zéros de tête sont tolérés
 * (« liv 42 c7 », « LIV0042C07 »). `null` si ce n'est pas un carton.
 */
export function parseCartonCode(raw: string): CartonRef | null {
    const compact = raw.toUpperCase().replace(/[\s_-]/g, "")
    const match = /^LIV(\d{1,9})C(\d{1,4})$/.exec(compact)
    if (!match) return null
    const livraisonNumero = Number(match[1])
    const cartonNumero = Number(match[2])
    if (livraisonNumero < 1 || cartonNumero < 1) return null
    return { livraisonNumero, cartonNumero }
}

/** Forme canonique d'un code de carton lu, ou `null`. Sert de `parse` au scanner. */
export function canonicalCartonCode(raw: string): string | null {
    const ref = parseCartonCode(raw)
    return ref ? formatCartonCode(ref.livraisonNumero, ref.cartonNumero) : null
}
