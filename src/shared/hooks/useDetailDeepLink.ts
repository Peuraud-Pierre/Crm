import { useEffect } from "react"
import { useNavigate } from "react-router"

/**
 * Garde des liens profonds vers une sheet de détail.
 *
 * L'URL est la source de vérité (`docs/ROUTING.md`) : le segment `detail` vaut
 * `new` ou l'identifiant d'une ressource, et la sheet s'en déduit — jamais d'un
 * `useState`, pour que l'écran reste partageable et que le bouton retour la
 * referme.
 *
 * Trois conséquences, écrites trois fois à l'identique dans les deux modules de
 * stock avant d'atterrir ici :
 *
 *  1. **La permission se vérifie sur la SHEET, pas sur le bouton qui y mène.**
 *     Masquer l'entrée sans garder la destination ne protège rien : le tableau
 *     cachait bien son crayon, mais `/stock/flux/{id}` ouvrait quand même le
 *     formulaire d'édition à tout détenteur du droit de lecture. La RLS
 *     refusait l'écriture — ce qu'on proposait, c'était un formulaire voué à
 *     échouer.
 *  2. **Un identifiant introuvable une fois les données chargées** est un lien
 *     mort : on nettoie plutôt que d'afficher une sheet vide.
 *  3. **Le nettoyage est en `replace`**, pour ne pas empiler une entrée
 *     d'historique morte sur laquelle le bouton retour ramènerait aussitôt.
 *
 * Limite connue : `find` ne cherche que dans ce que l'appelant a chargé. Un
 * module paginé par paliers nettoie donc comme lien mort un identifiant réel
 * mais plus ancien que le palier courant. Le correctif est un fetch unitaire
 * côté appelant, pas ici.
 *
 * Cette garde est de SECOND niveau : elle ne remplace pas la canonicalisation
 * d'onglet de `TabbedModuleRoute`, qui vit dans la route. Les deux doivent
 * rester distinctes — c'est un onglet qui se redirigeait lui-même qui avait
 * provoqué l'oscillation d'août 2026.
 */

interface DetailDeepLinkOptions<T> {
    /** Segment `detail` de l'URL. */
    detail: string | undefined
    /** URL de repli, sans segment de détail (`/stock/flux`). */
    baseUrl: string
    canCreate: boolean
    canUpdate: boolean
    /**
     * Droit de CONSULTATION, quand la ressource a une fiche en lecture seule
     * distincte de son formulaire. Absent, le détail reste gaté sur
     * `canUpdate` : les appelants qui n'ouvrent qu'un formulaire ne changent
     * pas de comportement.
     */
    canView?: boolean
    /**
     * Les données sont chargées. Tant que c'est faux, un identifiant absent
     * n'est pas concluant : rediriger ici ferait échouer tout lien profond
     * ouvert à froid.
     */
    loaded: boolean
    find: (id: string) => T | null | undefined
}

export interface DetailDeepLink<T> {
    creationOpen: boolean
    /** Ressource ciblée ET modifiable — de quoi ouvrir un formulaire. */
    editing: T | null
    /**
     * Ressource ciblée et consultable. Vaut `editing` tant que `canView` n'est
     * pas fourni. Un module à fiche de lecture ouvre sur `viewing` et se sert
     * d'`editing` pour décider d'afficher son bouton « Modifier ».
     */
    viewing: T | null
}

export function useDetailDeepLink<T>({
    detail,
    baseUrl,
    canCreate,
    canUpdate,
    canView,
    loaded,
    find,
}: DetailDeepLinkOptions<T>): DetailDeepLink<T> {
    const navigate = useNavigate()

    const isCreation = detail === "new"
    const canOpen = canView ?? canUpdate
    const allowed = isCreation ? canCreate : canOpen

    const creationOpen = isCreation && canCreate
    const targeted = detail && !isCreation && canOpen ? find(detail) ?? null : null
    const editing = canUpdate ? targeted : null

    useEffect(() => {
        if (!detail) return

        // Droit manquant : la décision ne dépend pas des données, on n'attend
        // pas leur chargement.
        if (!allowed) {
            navigate(baseUrl, { replace: true })
            return
        }

        if (!isCreation && loaded && !targeted) {
            navigate(baseUrl, { replace: true })
        }
    }, [detail, isCreation, allowed, loaded, targeted, baseUrl, navigate])

    return { creationOpen, editing, viewing: targeted }
}
