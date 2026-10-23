import type { AvancementLigne, CommandeBoutique } from "@/features/commandes/types/commande.types"

/**
 * Suggestions du formulaire de commande — fonctions pures.
 *
 * Une boutique recommande presque toujours les mêmes catégories : plutôt que
 * de faire défiler tout le référentiel, on propose d'abord ses habituelles
 * (avec leur quantité ordinaire), et la recherche pour le reste.
 */

export interface Habituelle {
    category_id: string
    nom: string
    /** Nombre de commandes où elle figure. */
    fois: number
    /** Quantité habituelle, arrondie à 5 kg : pré-remplie à l'ajout. */
    kgHabituel: number
}

const arrondi5 = (kg: number) => Math.max(5, Math.round(kg / 5) * 5)

/** Catégories les plus commandées, la plus fréquente d'abord. */
export function categoriesHabituelles(lignes: readonly AvancementLigne[], limite = 8): Habituelle[] {
    const parCategorie = new Map<string, { nom: string; fois: number; kg: number }>()
    for (const l of lignes) {
        const c = parCategorie.get(l.category_id) ?? { nom: l.category_nom, fois: 0, kg: 0 }
        c.fois += 1
        c.kg += l.kg_demande
        parCategorie.set(l.category_id, c)
    }
    return [...parCategorie.entries()]
        .map(([category_id, c]) => ({ category_id, nom: c.nom, fois: c.fois, kgHabituel: arrondi5(c.kg / c.fois) }))
        .sort((a, b) => b.fois - a.fois || a.nom.localeCompare(b.nom, "fr"))
        .slice(0, limite)
}

/** La dernière commande passée (hors `exclure`) et ses lignes, pour la reprendre telle quelle. */
export function derniereCommande(
    commandes: readonly CommandeBoutique[],
    lignes: readonly AvancementLigne[],
    exclure?: string,
): { commande: CommandeBoutique; lignes: { category_id: string; kg: number }[] } | null {
    for (const commande of commandes) {
        if (commande.id === exclure) continue
        const siennes = lignes.filter((l) => l.commande_id === commande.id)
        if (siennes.length > 0) return { commande, lignes: siennes.map((l) => ({ category_id: l.category_id, kg: l.kg_demande })) }
    }
    return null
}

/** Minuscules, sans accents : « Écharpes » se trouve en tapant « echa ». */
export const normaliser = (texte: string) => texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()

/**
 * Catégories qui répondent à une recherche, sans celles déjà prises : celles
 * qui COMMENCENT par le texte d'abord, puis celles qui le contiennent.
 */
export function chercherCategories<C extends { id: string; name: string }>(
    categories: readonly C[],
    query: string,
    exclure: ReadonlySet<string>,
    limite = 6,
): C[] {
    const q = normaliser(query)
    if (!q) return []
    return categories
        .filter((c) => !exclure.has(c.id))
        .map((c) => ({ c, n: normaliser(c.name) }))
        .filter(({ n }) => n.includes(q))
        .sort((a, b) => Number(!a.n.startsWith(q)) - Number(!b.n.startsWith(q)) || a.n.localeCompare(b.n, "fr"))
        .slice(0, limite)
        .map(({ c }) => c)
}
