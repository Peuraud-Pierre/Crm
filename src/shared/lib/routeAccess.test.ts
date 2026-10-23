import { expect, test } from "@rstest/core"
import type { MenuItem } from "@/shared/components/layout/menuItems"
import { isRouteAllowed, routeEntryFor } from "./routeAccess"

function entry(href: string, title = href): MenuItem {
    return {
        title,
        displayName: title,
        icon: () => null,
        href,
        permissionCode: `${title}.view`,
        category: null,
    }
}

const CRM = entry("/crm", "crm")
const CRM_ADMIN = entry("/crm-admin", "crm_admin")
const STOCK = entry("/stock", "stock")

test("l'URL exacte d'une entrée est gouvernée par elle", () => {
    expect(routeEntryFor("/stock", [STOCK])).toBe(STOCK)
})

test("une sous-page est gouvernée par la racine de sa feature", () => {
    expect(routeEntryFor("/stock/arrivage/abc-123", [STOCK])).toBe(STOCK)
})

test("le rapprochement se fait sur frontière de segment", () => {
    // Piège : "/crm-admin".startsWith("/crm") est vrai. L'admin CRM ne
    // doit pas être ouverte par la seule entrée du CRM.
    expect(routeEntryFor("/crm-admin", [CRM])).toBeUndefined()
    expect(routeEntryFor("/crm/clients", [CRM_ADMIN])).toBeUndefined()
})

test("la plus longue entrée gouvernante l'emporte", () => {
    const arrivage = entry("/stock/arrivage", "arrivage")
    expect(routeEntryFor("/stock/arrivage/1", [STOCK, arrivage])).toBe(arrivage)
    expect(routeEntryFor("/stock/arrivage/1", [arrivage, STOCK])).toBe(arrivage)
})

test("query et fragment ne participent pas au rapprochement", () => {
    expect(routeEntryFor("/projects/a/kanban/b?sprint=s1", [entry("/projects")]))
        .toBeDefined()
    expect(routeEntryFor("/stock#bas", [STOCK])).toBe(STOCK)
})

test("une barre oblique finale ne change rien", () => {
    expect(routeEntryFor("/stock/", [STOCK])).toBe(STOCK)
})

test("une URL qu'aucune entrée ne gouverne est refusée", () => {
    expect(isRouteAllowed("/inconnu", [CRM, STOCK])).toBe(false)
    expect(isRouteAllowed("/crm/clients", [])).toBe(false)
})

test("isRouteAllowed suit la liste autorisée qu'on lui passe", () => {
    // `allowedRoutes` ne contient QUE les entrées déjà autorisées : le
    // contrôle se réduit à y trouver l'entrée gouvernante.
    expect(isRouteAllowed("/crm/clients", [CRM, STOCK])).toBe(true)
    expect(isRouteAllowed("/crm/clients", [STOCK])).toBe(false)
})
