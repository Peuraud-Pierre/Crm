// ── ThematiqueItem.test.tsx ───────────────────────────────────────────────────
// Tests unitaires du composant ThematiqueItem.
//
// ThematiqueItem est un composant pur : toutes ses données viennent via props,
// sans aucun accès au contexte ni à Supabase. C'est le plus simple à tester
// dans la feature — aucun mock requis.
//
// Comportements testés :
//   1. Rendu du contenu (label, compteur, icône)
//   2. État actif/inactif (aria-current pour les lecteurs d'écran)
//   3. Déclenchement des callbacks au clic (onClick, onRename, onDelete)
//   4. Accessibilité clavier : les boutons d'action sont toujours dans le DOM
//      (opacity-0 ≠ display:none), rendant la navigation clavier possible même
//      sans survol de la souris.

import { describe, expect, test, rstest } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { ThematiqueItem } from "./ThematiqueItem"

// ── Helper ─────────────────────────────────────────────────────────────────────
// Rend le composant avec des props par défaut sensées. Les surcharges permettent
// de cibler précisément ce qu'on veut tester sans réécrire toute la prop list.
// De nouveaux mocks rstest.fn() sont créés à chaque appel pour que les tests
// restent indépendants les uns des autres.

function renderItem(overrides: Partial<ComponentProps<typeof ThematiqueItem>> = {}) {
    const onClick  = rstest.fn()
    const onRename = rstest.fn()
    const onDelete = rstest.fn()

    // container est retourné pour les tests qui cherchent des éléments sans rôle ARIA
    // (ex : <img alt=""> a le rôle "presentation", pas "img" → non trouvable via getByRole)
    const { container } = render(
        <ThematiqueItem
            id="t1"
            label="Livraison"
            count={5}
            active={false}
            onClick={onClick}
            onRename={onRename}
            onDelete={onDelete}
            renameLabel="Renommer la thématique"
            deleteLabel="Supprimer la thématique"
            {...overrides}
        />
    )

    return { onClick, onRename, onDelete, container }
}

// ── Rendu du contenu ───────────────────────────────────────────────────────────

describe("ThematiqueItem — rendu du contenu", () => {
    test("affiche le label passé en prop", () => {
        renderItem({ label: "Retours clients" })
        expect(screen.getByText("Retours clients")).toBeInTheDocument()
    })

    test("affiche le compteur de Q&R", () => {
        renderItem({ count: 12 })
        // Le compteur est un élément texte dans le bouton principal
        expect(screen.getByText("12")).toBeInTheDocument()
    })

    test("affiche l'icône quand iconUrl est fourni", () => {
        // L'icône n'est plus un <img> mais un <span> coloré via CSS mask (voir
        // MaskIcon.tsx) — on cherche l'élément dont le mask pointe vers l'URL fournie.
        const { container } = renderItem({ iconUrl: "/icons/truck.svg" })
        const icon = container.querySelector('span[style*="/icons/truck.svg"]')
        expect(icon).toBeInTheDocument()
    })

    test("n'affiche pas d'icône quand iconUrl est null", () => {
        const { container } = renderItem({ iconUrl: null })
        expect(container.querySelector('span[style*="mask"]')).not.toBeInTheDocument()
    })

    test("n'affiche pas d'icône quand iconUrl est undefined", () => {
        const { container } = renderItem({ iconUrl: undefined })
        expect(container.querySelector('span[style*="mask"]')).not.toBeInTheDocument()
    })
})

// ── État actif / inactif ──────────────────────────────────────────────────────
// L'attribut aria-current indique aux lecteurs d'écran l'item de navigation
// actuellement sélectionné.

describe("ThematiqueItem — état actif/inactif", () => {
    test("le bouton principal a aria-current quand active=true", () => {
        renderItem({ active: true })
        // Le bouton principal est identifiable par le texte du label + compteur
        // (les deux autres boutons ont des aria-label explicites)
        const mainButton = screen.getByRole("button", { name: /livraison/i })
        expect(mainButton).toHaveAttribute("aria-current")
    })

    test("le bouton principal n'a pas aria-current quand active=false", () => {
        renderItem({ active: false })
        const mainButton = screen.getByRole("button", { name: /livraison/i })
        expect(mainButton).not.toHaveAttribute("aria-current")
    })
})

// ── Callbacks ─────────────────────────────────────────────────────────────────
// Vérifie que chaque bouton appelle bien son handler, et uniquement lui.
// userEvent.setup() simule des interactions réalistes (pointeur + clavier)
// contrairement à fireEvent qui ne déclenche qu'un événement DOM brut.

describe("ThematiqueItem — callbacks au clic", () => {
    test("onClick appelé quand on clique sur le bouton principal", async () => {
        const user = userEvent.setup()
        const { onClick, onRename, onDelete } = renderItem()
        await user.click(screen.getByRole("button", { name: /livraison/i }))
        expect(onClick).toHaveBeenCalledWith("t1")
        // Vérifie qu'aucun autre callback n'a été déclenché par erreur
        expect(onRename).not.toHaveBeenCalled()
        expect(onDelete).not.toHaveBeenCalled()
    })

    test("onRename appelé avec l'id quand on clique sur le bouton Renommer", async () => {
        const user = userEvent.setup()
        const { onClick, onRename, onDelete } = renderItem()
        // Le bouton Renommer est identifié par son aria-label (même caché visuellement)
        await user.click(screen.getByRole("button", { name: "Renommer la thématique" }))
        expect(onRename).toHaveBeenCalledWith("t1")
        expect(onClick).not.toHaveBeenCalled()
        expect(onDelete).not.toHaveBeenCalled()
    })

    test("onDelete appelé avec l'id quand on clique sur le bouton Supprimer", async () => {
        const user = userEvent.setup()
        const { onClick, onRename, onDelete } = renderItem()
        await user.click(screen.getByRole("button", { name: "Supprimer la thématique" }))
        expect(onDelete).toHaveBeenCalledWith("t1")
        expect(onClick).not.toHaveBeenCalled()
        expect(onRename).not.toHaveBeenCalled()
    })
})

// ── Accessibilité clavier ─────────────────────────────────────────────────────
// Les boutons Renommer/Supprimer sont visuellement masqués au repos (opacity-0)
// MAIS ils restent dans le DOM (pas de display:none ni hidden). Cela signifie
// qu'un utilisateur naviguant au clavier peut les atteindre par Tab sans avoir
// à survoler la souris au préalable.
//
// Ce comportement a été introduit lors de l'audit 1 pour remplacer l'ancienne
// approche `hidden group-hover:flex` qui excluait les boutons du DOM.

describe("ThematiqueItem — accessibilité clavier", () => {
    test("le bouton Renommer est dans le DOM même sans survol", () => {
        renderItem()
        // getByRole explore le DOM complet, y compris les éléments visuellement masqués
        expect(screen.getByRole("button", { name: "Renommer la thématique" })).toBeInTheDocument()
    })

    test("le bouton Supprimer est dans le DOM même sans survol", () => {
        renderItem()
        expect(screen.getByRole("button", { name: "Supprimer la thématique" })).toBeInTheDocument()
    })

    test("les aria-labels des boutons d'action reflètent les props passées", () => {
        // Vérifie que les labels sont bien des props et non des strings hardcodées
        renderItem({
            renameLabel: "Modifier le nom de la thématique",
            deleteLabel: "Effacer cette thématique",
        })
        expect(screen.getByRole("button", { name: "Modifier le nom de la thématique" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Effacer cette thématique" })).toBeInTheDocument()
    })

    test("navigation Tab : le bouton Renommer est focusable", async () => {
        const user = userEvent.setup()
        renderItem()
        // Tab depuis le body → premier bouton focusable dans le composant
        // Tab encore → bouton Renommer (dans le div d'actions, toujours dans le tab-order)
        await user.tab()
        await user.tab()
        // Le bouton Renommer doit recevoir le focus
        expect(screen.getByRole("button", { name: "Renommer la thématique" })).toHaveFocus()
    })
})
