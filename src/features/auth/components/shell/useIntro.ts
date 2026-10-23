import { useEffect, useState } from "react"

/*
 * L'intro des écrans d'auth (le logo se trace à sa place, puis la page
 * apparaît en fondu autour) ne se joue qu'une fois par chargement de l'app :
 * chaque écran monte son propre AuthShell, et la rejouer à chaque passage
 * connexion → mot de passe oublié → retour deviendrait pénible.
 * État de module et non de contexte : il n'a de sens que pour la durée de
 * vie de l'onglet, exactement comme le module lui-même.
 */
let played = false

/**
 * `true` si ce montage doit jouer l'intro. Lu une seule fois : une intro en
 * cours ne s'interrompt pas quand un voisin monte. `enabled = false` (écran
 * d'attente) ne consomme pas l'intro, qui reste due à l'écran suivant.
 */
export function useIntro(enabled: boolean): boolean {
    const [plays] = useState(() => enabled && !played)

    useEffect(() => {
        if (plays) played = true
    }, [plays])

    return plays
}
