import type {
    AvancementLigne,
    Carton,
    CartonEtat,
    CommandeBoutique,
} from "@/features/commandes/types/commande.types"

/**
 * Avancement et écarts de la salle de commande — fonctions pures.
 *
 * La base calcule tout (vues `v_cartons`, `v_livraisons_boutique`,
 * `v_commande_avancement`) et reste l'arbitre. Ces miroirs servent à
 * l'affichage d'un état que l'écran tient déjà en main (récapitulatif d'une
 * livraison en préparation, aperçu avant validation d'un carton), sans
 * aller-retour.
 */

/** Tolérance de pesée à la réception (2 %), la même que `receptionner_carton`. */
export const RECEPTION_TOLERANCE = 0.02

/**
 * Kilos en écart d'un carton. Miroir de `v_cartons.ecart_kg` :
 *   écart de poids                            → |prévu − reçu|
 *   manquant / mauvaise catégorie / endommagé → tout le prévu
 *   conforme ou pas encore reçu               → 0
 */
export function ecartKg(carton: Pick<Carton, "etat" | "poids_kg_prevu" | "poids_kg_recu">): number {
    switch (carton.etat) {
        case "ecart_poids":
            return Math.abs(carton.poids_kg_prevu - (carton.poids_kg_recu ?? carton.poids_kg_prevu))
        case "manquant":
        case "mauvaise_categorie":
        case "endommage":
            return carton.poids_kg_prevu
        default:
            return 0
    }
}

/**
 * Verdict que rendra `receptionner_carton` pour cette saisie. Affiché AVANT
 * validation, pour que la boutique voie ce qu'elle s'apprête à déclarer.
 * Sans pesée, le poids prévu fait foi.
 */
export function verdictReception(input: {
    poidsPrevu: number
    poidsRecu: number | null
    endommage: boolean
    mauvaiseCategorie: boolean
}): CartonEtat {
    if (input.endommage) return "endommage"
    if (input.mauvaiseCategorie) return "mauvaise_categorie"
    if (input.poidsRecu !== null && Math.abs(input.poidsRecu - input.poidsPrevu) > input.poidsPrevu * RECEPTION_TOLERANCE) {
        return "ecart_poids"
    }
    return "conforme"
}

export interface Segments {
    /** Part de chaque état dans la barre, en % de son échelle. */
    recu: number
    expedie: number
    prepare: number
    manquant: number
    reste: number
}

/**
 * Barre segmentée d'une ligne de commande : reçu / en transit / préparé /
 * manquant / reste à servir. L'échelle est le demandé, ou la somme des
 * segments si la ligne a été servie au-delà — la barre ne déborde jamais.
 */
export function segmentsAvancement(ligne: Pick<AvancementLigne,
    "kg_demande" | "kg_recu" | "kg_expedie" | "kg_prepare" | "kg_manquant" | "kg_reste">): Segments {
    const parts = {
        recu: ligne.kg_recu,
        expedie: ligne.kg_expedie,
        prepare: ligne.kg_prepare,
        manquant: ligne.kg_manquant,
        reste: ligne.kg_reste,
    }
    const scale = Math.max(ligne.kg_demande, ligne.kg_recu + ligne.kg_expedie + ligne.kg_prepare + ligne.kg_reste)
    if (scale <= 0) return { recu: 0, expedie: 0, prepare: 0, manquant: 0, reste: 0 }
    const pct = (kg: number) => Math.min(100, (Math.max(0, kg) / scale) * 100)
    // Le manquant est déjà compté dans le reste (il est à renvoyer) : il ne
    // prend pas de place à lui, il colore une partie du reste.
    return {
        recu: pct(parts.recu),
        expedie: pct(parts.expedie),
        prepare: pct(parts.prepare),
        manquant: pct(Math.min(parts.manquant, parts.reste)),
        reste: pct(parts.reste - Math.min(parts.manquant, parts.reste)),
    }
}

/** Part reçue d'une commande, en %, plafonnée à 100. */
export function pourcentageRecu(commande: Pick<CommandeBoutique, "kg_demande" | "kg_recu">): number {
    if (commande.kg_demande <= 0) return 0
    return Math.min(100, (commande.kg_recu / commande.kg_demande) * 100)
}

/**
 * Ce qu'il reste à envoyer, catégorie par catégorie : les propositions de
 * la préparation. Une ligne soldée ou déjà entièrement en route n'y figure
 * pas.
 */
export function resteAServir(lignes: readonly AvancementLigne[]): { category_id: string; category_nom: string; kg: number }[] {
    return lignes
        .filter((l) => l.kg_reste > 0)
        .map((l) => ({ category_id: l.category_id, category_nom: l.category_nom, kg: Math.round(l.kg_reste * 100) / 100 }))
}

/**
 * Découpe un poids en cartons d'un poids type : 70 kg en cartons de 25 →
 * 25, 25, 20. Le reliquat devient un carton à part s'il pèse au moins un
 * dixième du poids type, sinon il rejoint le dernier carton (on ne prépare
 * pas un carton de 500 g).
 */
export function decouperEnCartons(kg: number, poidsType: number): number[] {
    if (kg <= 0 || poidsType <= 0) return []
    const pleins = Math.floor(kg / poidsType)
    const reste = Math.round((kg - pleins * poidsType) * 100) / 100
    const cartons = Array.from({ length: pleins }, () => poidsType)
    if (reste <= 0) return cartons
    if (cartons.length > 0 && reste < poidsType / 10) {
        cartons[cartons.length - 1] = Math.round((cartons[cartons.length - 1] + reste) * 100) / 100
    } else {
        cartons.push(reste)
    }
    return cartons
}

/** Récapitulatif d'un ensemble de cartons : kilos, et part de chaque catégorie. */
export function recapCartons(cartons: readonly Pick<Carton, "poids_kg_prevu" | "category_id" | "category_nom">[]) {
    const parCategorie = new Map<string, { nom: string; kg: number; cartons: number }>()
    let kg = 0
    for (const c of cartons) {
        kg += c.poids_kg_prevu
        const p = parCategorie.get(c.category_id) ?? { nom: c.category_nom, kg: 0, cartons: 0 }
        p.kg += c.poids_kg_prevu
        p.cartons += 1
        parCategorie.set(c.category_id, p)
    }
    return {
        cartons: cartons.length,
        kg,
        parCategorie: [...parCategorie.values()].sort((a, b) => b.kg - a.kg),
    }
}

const KG = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 })
/** « 1 250,5 kg ». */
export const formatKg = (value: number) => `${KG.format(value)} kg`
