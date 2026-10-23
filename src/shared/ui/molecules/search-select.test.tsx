import { useState } from "react"
import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SearchSelect, type SearchSelectOption } from "./search-select"

/**
 * Premier filet de ce composant, et il arrive tard : `SearchSelect` est le point
 * de passage de TOUT choix dans un référentiel (25 écrans, les deux modules de
 * stock), et il n'avait aucun test. Ce fichier fige d'abord le parcours au
 * clavier, parce que c'est ce que le composant ne savait pas faire — une liste
 * cherchable qui exigeait la souris pour choisir.
 *
 * La règle qui demande le plus d'attention est le partage de la touche Entrée :
 * elle choisit l'option surlignée, et à défaut crée l'entrée absente. Les deux
 * règles ne peuvent pas se croiser, puisqu'une liste vide n'a rien à surligner —
 * mais c'est exactement le genre d'invariant qu'une refonte casse sans bruit.
 */

const OPTIONS: SearchSelectOption[] = [
    { value: "blouson", label: "Blouson jean" },
    { value: "polo", label: "Polo Ralph Lauren" },
    { value: "tshirt", label: "T-shirt uni" },
]

interface HarnessProps {
    onPick?: (value: string, label: string) => void
    onCreate?: (query: string) => void
    restoreFocusOnClose?: boolean
}

/** La valeur est tenue par l'appelant, comme sur tous les écrans réels. */
function Harness({ onPick, onCreate, restoreFocusOnClose }: HarnessProps) {
    const [value, setValue] = useState("")
    return (
        <SearchSelect
            options={OPTIONS}
            value={value}
            onChange={(next, label) => {
                setValue(next)
                onPick?.(next, label)
            }}
            placeholder="Choisir la catégorie…"
            searchable
            onCreate={onCreate}
            createLabel="Nouvelle catégorie"
            restoreFocusOnClose={restoreFocusOnClose}
        />
    )
}

/**
 * Ouvre la liste et rend la barre de recherche, sur laquelle le focus est posé.
 *
 * Aucun rattrapage de focus ici : c'est le composant qui doit le poser, et la
 * moindre régression doit faire tomber les tests qui tapent juste après.
 */
async function openList(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /Choisir la catégorie/ }))
    const search = await screen.findByPlaceholderText("Rechercher...")
    expect(document.activeElement).toBe(search)
    return search
}

test("le focus est posé sur la barre de recherche à l'ouverture de la liste", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    // On tape sans avoir cliqué le champ : c'est ce que fait quelqu'un qui
    // enchaîne des classements, et ce qui manquait.
    await openList(user)
    await user.keyboard("polo")

    expect(screen.getByPlaceholderText("Rechercher...")).toHaveValue("polo")
    expect(screen.queryByRole("button", { name: "Blouson jean" })).not.toBeInTheDocument()
})

test("↓ surligne la première option et Entrée la choisit", async () => {
    const user = userEvent.setup()
    const picked: string[] = []
    render(<Harness onPick={(value, label) => picked.push(`${value}:${label}`)} />)

    const search = await openList(user)
    // Rien n'est surligné à l'ouverture : surligner d'office la première entrée
    // d'un référentiel se lirait comme une présélection.
    expect(search.getAttribute("aria-activedescendant")).toBeNull()

    await user.keyboard("{ArrowDown}")
    const first = screen.getByRole("button", { name: "Blouson jean" })
    expect(search.getAttribute("aria-activedescendant")).toBe(first.id)

    await user.keyboard("{Enter}")
    expect(picked).toEqual(["blouson:Blouson jean"])
})

test("↑ depuis le haut de la liste boucle sur la dernière option", async () => {
    const user = userEvent.setup()
    const picked: string[] = []
    render(<Harness onPick={(value) => picked.push(value)} />)

    const search = await openList(user)
    await user.keyboard("{ArrowDown}{ArrowUp}")
    expect(search.getAttribute("aria-activedescendant")).toBe(
        screen.getByRole("button", { name: "T-shirt uni" }).id,
    )

    await user.keyboard("{Enter}")
    expect(picked).toEqual(["tshirt"])
})

test("taper réduit la liste, et Entrée choisit la première option restante", async () => {
    // Le piège : l'index surligné survit à la frappe alors que la liste
    // rétrécit sous lui. Sans borne, Entrée choisirait une option qui n'est plus
    // affichée — aucune erreur, juste la mauvaise catégorie.
    const user = userEvent.setup()
    const picked: string[] = []
    render(<Harness onPick={(value) => picked.push(value)} />)

    await openList(user)
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}")
    await user.keyboard("polo")
    await user.keyboard("{Enter}")

    expect(picked).toEqual(["polo"])
})

test("Échap referme la liste sans rien choisir", async () => {
    const user = userEvent.setup()
    const picked: string[] = []
    render(<Harness onPick={(value) => picked.push(value)} />)

    await openList(user)
    await user.keyboard("{ArrowDown}{Escape}")

    expect(screen.queryByPlaceholderText("Rechercher...")).toBeNull()
    expect(picked).toEqual([])
})

test("Entrée crée toujours l'entrée absente quand la recherche ne renvoie rien", async () => {
    // Non-régression : cette règle existait avant la navigation clavier, et les
    // deux se partagent la touche Entrée.
    const user = userEvent.setup()
    const created: string[] = []
    render(<Harness onCreate={(query) => created.push(query)} />)

    await openList(user)
    await user.keyboard("short hawaii")
    await user.keyboard("{Enter}")

    expect(created).toEqual(["short hawaii"])
})

test("restoreFocusOnClose={false} laisse le focus à l'écran hôte", async () => {
    // Le déclencheur peut disparaître juste après le choix (une carte qui quitte
    // sa strate) : lui rendre le focus le poserait sur un nœud en cours de
    // démontage, et l'enchaînement au clavier s'arrêterait sans rien à l'écran
    // pour l'expliquer.
    const user = userEvent.setup()
    render(<Harness restoreFocusOnClose={false} />)

    const trigger = screen.getByRole("button", { name: /Choisir la catégorie/ })
    await openList(user)
    await user.keyboard("{ArrowDown}{Enter}")

    expect(document.activeElement).not.toBe(trigger)
})

test("par défaut, le focus revient au déclencheur après un choix", async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole("button", { name: /Choisir la catégorie/ })
    await openList(user)
    await user.keyboard("{ArrowDown}{Enter}")

    expect(document.activeElement).toBe(trigger)
})
