import type { MenuItem } from "@/shared/components/layout/menuItems"

/**
 * « L'utilisateur a-t-il le droit d'ouvrir cette URL ? »
 *
 * Un module de dashboard propose des liens (le bouton « voir tout » de
 * `WidgetCard`, ses lignes) vers des pages dont il ne détient pas
 * forcément la permission : sa propre permission et celle de sa page
 * cible sont deux codes distincts. `stock.arrivage.view` laisse voir le
 * module Arrivages, mais c'est `stock.view` qui ouvre `/stock` — un
 * profil peut avoir le premier sans le second et se retrouver devant un
 * NotFound en cliquant.
 *
 * La source de vérité utilisée ici est `allowedRoutes` (`useAuth()`),
 * calculé une fois par `fetchPermissions` (`shared/components/misc/
 * Permission.tsx`) comme le croisement de `menuItems` et des permissions
 * de l'utilisateur — avec la même règle « au moins un des codes » que le
 * garde de route `AuthGuardLayout`. Les `permissionCode` de `menuItems`
 * et les `handle.permissionCode` de `router.tsx` coïncident sur toutes
 * les racines visées par un module, donc `allowedRoutes` est un reflet
 * fidèle de ce que le garde laissera passer.
 *
 * **Fonctions pures, et non un hook, délibérément** : ces contrôles sont
 * appelés dans le `.map()` des lignes d'un module. Un hook qui s'abonne à
 * une ressource globale, appelé par ligne, produit un abonnement par
 * ligne — le précédent est mesuré et documenté (`docs/DESIGN_SYSTEM.md`
 * §13.5, ~100 abonnements media-query sur une page). L'appelant lit
 * `allowedRoutes` une seule fois et passe le tableau.
 *
 * Hors périmètre : `requireMfa` (porté par `/crm`). Le garde n'y rend pas
 * un NotFound mais l'écran d'enrôlement `MfaRequiredGuard`, qui est
 * actionnable — ce n'est pas une page « sans accès ».
 */

/**
 * L'entrée de menu qui gouverne cette URL.
 *
 * Rapprochement sur **frontière de segment**, et non par simple préfixe :
 * `"/crm-admin".startsWith("/crm")` est vrai, et une page d'admin n'est
 * pas gouvernée par l'entrée du CRM. C'est la **plus longue** entrée qui
 * l'emporte, pour qu'une future entrée plus spécifique prime sur sa
 * racine.
 *
 * La query et le fragment sont ignorés : ils ne participent jamais au
 * routage des permissions.
 */
export function routeEntryFor(
    href: string,
    entries: MenuItem[]
): MenuItem | undefined {
    const path = normalize(href)
    if (path === "") return undefined

    let best: MenuItem | undefined

    for (const entry of entries) {
        const base = normalize(entry.href)
        if (base === "") continue

        const matches = path === base || path.startsWith(base + "/")
        if (!matches) continue

        if (!best || base.length > normalize(best.href).length) {
            best = entry
        }
    }

    return best
}

/**
 * Cette URL est-elle ouverte à cet utilisateur ?
 *
 * `allowedRoutes` ne contient que les entrées déjà autorisées : y trouver
 * l'entrée gouvernante suffit. Une URL qu'aucune entrée ne gouverne est
 * refusée — on ne propose pas un lien dont on ne sait rien.
 */
export function isRouteAllowed(
    href: string,
    allowedRoutes: MenuItem[]
): boolean {
    return routeEntryFor(href, allowedRoutes) !== undefined
}

/** Chemin seul, sans query ni fragment, sans barre oblique finale. */
function normalize(href: string): string {
    const path = href.split(/[?#]/, 1)[0] ?? ""
    return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path
}
