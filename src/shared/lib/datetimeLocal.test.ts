import { expect, test } from "@rstest/core"
import { localInputFromUtcIso, utcIsoFromLocalInput } from "./datetimeLocal"

/**
 * Ces tests verrouillent la propriété que l'équivalent côté annonces
 * (`manager/components/Annonce/utils/date.ts`) n'avait pas : l'aller-retour
 * heure locale ↔ ISO UTC doit être neutre, quel que soit le fuseau de la
 * machine et quelle que soit la période de l'année.
 *
 * Ce fichier-là soustrayait `1` à l'heure en dur (`Date.UTC(y, m, d, hour - 1, min)`),
 * figeant un UTC+1 : rouvrir une annonce pour l'éditer décalait ses dates
 * d'une heure à chaque passage, et de deux en heure d'été.
 */

test("l'aller-retour local → UTC → local est neutre en heure d'hiver", () => {
    const local = "2026-01-15T14:30"
    expect(localInputFromUtcIso(utcIsoFromLocalInput(local))).toBe(local)
})

test("l'aller-retour local → UTC → local est neutre en heure d'été", () => {
    // Mi-juillet : la plupart des fuseaux européens sont alors en DST.
    // Un décalage codé en dur casse ici, pas en janvier.
    const local = "2026-07-15T14:30"
    expect(localInputFromUtcIso(utcIsoFromLocalInput(local))).toBe(local)
})

test("utcIsoFromLocalInput produit un instant ISO valide", () => {
    const iso = utcIsoFromLocalInput("2026-07-15T14:30")
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false)
})

test("les valeurs vides ou nulles ne produisent pas de date invalide", () => {
    expect(utcIsoFromLocalInput("")).toBe("")
    expect(localInputFromUtcIso("")).toBe("")
    expect(localInputFromUtcIso(null)).toBe("")
    expect(localInputFromUtcIso(undefined)).toBe("")
})
