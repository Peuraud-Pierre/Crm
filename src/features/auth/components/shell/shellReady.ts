import { createContext, use } from "react"

/**
 * `false` tant que l'intro des écrans d'auth se joue et que le formulaire
 * est verrouillé (AuthShell). Les composants lourds du formulaire attendent
 * ce signal pour se charger : le captcha Turnstile, par exemple, télécharge
 * et exécute un script Cloudflare puis crée une iframe, ce qui faisait
 * saccader l'intro sur une connexion lente.
 *
 * Vrai par défaut : hors d'un AuthShell (tests, autre écran), rien n'attend.
 */
export const ShellReadyContext = createContext(true)

export function useShellReady(): boolean {
    return use(ShellReadyContext)
}
