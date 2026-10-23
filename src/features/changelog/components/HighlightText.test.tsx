import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { HighlightText } from "./HighlightText"

test("surligne TOUTES les occurrences, pas une sur deux", () => {
    // Test de non-régression du défaut central de l'ancienne version :
    // elle appelait `regex.test(part)` sur une expression régulière
    // portant le drapeau `g`. `test()` est alors avec état — il avance
    // `lastIndex` — donc une occurrence sur deux retombait dans la
    // branche « pas une correspondance » et n'était pas surlignée.
    render(<HighlightText text="bug bug bug bug" search="bug" />)

    const marks = document.querySelectorAll("mark")
    expect(marks).toHaveLength(4)
})

test("la recherche est insensible à la casse", () => {
    render(<HighlightText text="Correctif CRM majeur" search="crm" />)

    const marks = document.querySelectorAll("mark")
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe("CRM")
})

test("un terme vide laisse le texte intact", () => {
    render(<HighlightText text="Rien à surligner" search="   " />)

    expect(document.querySelectorAll("mark")).toHaveLength(0)
    expect(screen.getByText("Rien à surligner")).toBeInTheDocument()
})

test("les caractères spéciaux de regex sont traités littéralement", () => {
    // Sans échappement, « (v1.0) » construirait un groupe capturant et
    // ferait planter la construction de l'expression.
    render(<HighlightText text="Version (v1.0) livrée" search="(v1.0)" />)

    const marks = document.querySelectorAll("mark")
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe("(v1.0)")
})

test("un terme absent ne surligne rien", () => {
    render(<HighlightText text="Aucune correspondance" search="zzz" />)

    expect(document.querySelectorAll("mark")).toHaveLength(0)
})
