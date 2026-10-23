import { useCallback, useState } from "react"
import type { Boutique } from "@/features/commandes/types/commande.types"

/**
 * Boutique choisie dans ce navigateur. Préférence par poste : un stockage
 * indisponible (navigation privée) fait simplement redemander la boutique.
 */
export const BOUTIQUE_COURANTE_KEY = "commandes.boutique"

function read(): string | null {
    try {
        return localStorage.getItem(BOUTIQUE_COURANTE_KEY)
    } catch {
        return null
    }
}

function write(id: string) {
    try {
        localStorage.setItem(BOUTIQUE_COURANTE_KEY, id)
    } catch {
        // Préférence non retenue : sans conséquence.
    }
}

/**
 * L'identité « je suis la boutique X » de l'espace boutique, SIMULÉE en V1 :
 * un sélecteur, retenu dans ce navigateur. En V2, la boutique viendra du
 * compte (console retail) et ce hook disparaîtra.
 *
 *   - `imposee` : la boutique d'un lien profond (notification « livraison
 *     expédiée » → réception) l'emporte, et devient le choix retenu ;
 *   - une boutique retenue mais supprimée ou désactivée est ignorée ;
 *   - une seule boutique active : elle est prise d'office.
 */
export function useBoutiqueCourante(boutiques: readonly Boutique[], imposee: string | null) {
    const [stored, setStored] = useState<string | null>(read)

    // Lien profond : adopté PENDANT LE RENDU (pas d'effet), pour que l'écran
    // s'affiche directement sur la bonne boutique.
    if (imposee && imposee !== stored) {
        setStored(imposee)
        write(imposee)
    }

    const actives = boutiques.filter((b) => b.actif)
    const retenue = boutiques.find((b) => b.id === stored && b.actif) ?? null
    const boutique = retenue ?? (actives.length === 1 ? actives[0] : null)

    const choisir = useCallback((id: string) => {
        setStored(id)
        write(id)
    }, [])

    return { boutique, choisir, actives }
}
