import {
    COMMANDE_VUES,
    ESPACE_DE_VUE,
    type CommandeEspace,
    type CommandeVue,
} from "@/features/commandes/types/commande.types"

/**
 * Espaces et vues de la page — fonctions pures.
 *
 * La vue est portée par l'URL (`?vue=`) et l'espace s'en déduit. Une vue
 * inconnue, ou d'un espace auquel on n'a pas accès, retombe sur la vue par
 * défaut du premier espace accessible — sans redirection : l'URL est lue,
 * jamais corrigée (voir docs/ROUTING.md).
 */

export const VUE_PAR_DEFAUT: Record<CommandeEspace, CommandeVue> = {
    entrepot: "a-faire",
    boutique: "accueil",
}

const isVue = (v: string | null): v is CommandeVue => COMMANDE_VUES.some((x) => x === v)

/**
 * Espaces ouverts à l'utilisateur, le principal d'abord.
 *   `manage`             → entrepôt ;
 *   `boutique`           → boutique ;
 *   ni l'un ni l'autre   → entrepôt en lecture seule (supervision).
 */
export function espacesAccessibles(manage: boolean, boutique: boolean): CommandeEspace[] {
    const espaces: CommandeEspace[] = []
    if (manage || !boutique) espaces.push("entrepot")
    if (boutique) espaces.push("boutique")
    return espaces
}

export function resolveVue(param: string | null, espaces: readonly CommandeEspace[]): CommandeVue {
    if (isVue(param) && espaces.includes(ESPACE_DE_VUE[param])) return param
    return VUE_PAR_DEFAUT[espaces[0] ?? "entrepot"]
}
