import { useUserPreferencesContext } from "../context/UserPreferencesProvider"

/**
 * Accès aux préférences de l'utilisateur courant.
 *
 * L'état vit dans `UserPreferencesProvider` (monté une fois dans
 * `AppProviders`) et non dans ce hook : le thème a deux points de commande
 * — le bouton de la barre supérieure et l'écran Paramètres — qui doivent
 * partager le même état, sinon l'un affiche une valeur périmée.
 */
export function useUserPreferences() {
    return useUserPreferencesContext()
}
