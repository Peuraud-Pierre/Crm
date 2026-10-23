/**
 * Conversions entre la valeur d'un `<input type="datetime-local">` (heure
 * locale du navigateur, sans fuseau) et l'ISO UTC stocké en base.
 *
 * Partagé plutôt que dupliqué : `maintenance` et `announcements` saisissent
 * tous deux des créneaux dans ce format (réutilisation prouvée dans deux
 * features, règle de promotion du design system §4).
 *
 * `new Date(localValue)` interprète une chaîne `YYYY-MM-DDTHH:mm` dans le
 * fuseau du navigateur, et `toISOString()` la ramène en UTC : la conversion
 * est donc correcte sans décalage codé en dur, et symétrique.
 *
 * C'est précisément ce que l'ancien utilitaire des annonces
 * (`manager/components/Annonce/utils/date.ts`) ne faisait pas : il
 * soustrayait `1` à l'heure en dur, figeant un UTC+1 qui se décale d'une
 * heure de plus en période d'heure d'été. Éditer une annonce déplaçait ses
 * dates à chaque passage. Voir les tests d'aller-retour ci-contre.
 *
 * À ne PAS utiliser pour un créneau exprimé dans un fuseau fixe
 * indépendant de l'utilisateur : le changelog, lui, a besoin de
 * `date-fns-tz` et de sa constante `DEPLOY_TZ`.
 */
export function utcIsoFromLocalInput(localValue: string): string {
    if (!localValue) return ""
    return new Date(localValue).toISOString()
}

export function localInputFromUtcIso(utcIso?: string | null): string {
    if (!utcIso) return ""

    const d = new Date(utcIso)
    const pad = (n: number) => String(n).padStart(2, "0")

    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    )
}
