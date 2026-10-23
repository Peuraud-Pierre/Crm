// ── utils.test.tsx ────────────────────────────────────────────────────────────
// Tests unitaires des fonctions pures de utils.tsx.
// Ces fonctions n'ont ni état, ni effet de bord, ni dépendance externe :
// elles sont testables directement, sans mock ni setup particulier.
//
// Extension .tsx requise car highlight() retourne du JSX (<mark>).
// On utilise render() de React Testing Library pour vérifier le DOM produit.

import { describe, expect, test } from "@rstest/core"
import { render } from "@testing-library/react"
import { highlight, tLabel, tQuestion, tReponse, tFormat, slugify } from "./utils"
import type { Thematique, QR, FormatMap } from "./types"

// ── Factories ─────────────────────────────────────────────────────────────────
// Fonctions qui produisent des données de test avec des valeurs par défaut
// surchargeables. Évite la répétition de fixtures dans chaque test.

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1",
    label: "Livraison",
    labelEn: "Delivery",
    imageUrl: "",
    iconUrl: "",
    ...overrides,
})

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1",
    thematiqueId: "t1",
    question: "Quel est le délai ?",
    questionEn: "What is the delay?",
    briefQr: "Réponse courte",
    briefQrEn: "Short answer",
    ...overrides,
})

const mkFormat = (overrides: Partial<FormatMap> = {}): FormatMap => ({
    email: "Bonjour,",
    emailEn: "Hello,",
    instagram: "Salut !",
    instagramEn: "Hey!",
    whatsapp: "Bonsoir,",
    whatsappEn: "Good evening,",
    ...overrides,
})

// ── highlight() ───────────────────────────────────────────────────────────────
// Surligne les occurrences d'une query dans un texte en les enveloppant
// dans une balise <mark>. On teste via le DOM rendu (pas l'AST React)
// car la structure interne du ReactNode (tableau de strings/éléments) est
// un détail d'implémentation qui peut changer.

describe("highlight", () => {
    // Cas limites : query vide — aucune marque ne doit être insérée
    test("retourne le texte brut si query est vide", () => {
        expect(highlight("livraison rapide", "")).toBe("livraison rapide")
    })

    test("retourne le texte brut si query est whitespace uniquement", () => {
        expect(highlight("test", "   ")).toBe("test")
    })

    // Cas nominal : une seule occurrence
    test("enveloppe le match dans une balise <mark>", () => {
        const { container } = render(<span>{highlight("livraison rapide", "rap")}</span>)
        const marks = container.querySelectorAll("mark")
        expect(marks).toHaveLength(1)
        expect(marks[0].textContent).toBe("rap")
    })

    // Le texte total (avant + match + après) doit être intact
    test("préserve le texte complet autour du match", () => {
        const { container } = render(<span>{highlight("livraison rapide", "rap")}</span>)
        expect(container.textContent).toBe("livraison rapide")
    })

    // La casse de la query ne doit pas bloquer la détection
    test("est case-insensitive", () => {
        const { container } = render(<span>{highlight("Livraison Rapide", "RAP")}</span>)
        const marks = container.querySelectorAll("mark")
        expect(marks).toHaveLength(1)
        // Le <mark> contient la version originale (conserve la casse du texte)
        expect(marks[0].textContent).toBe("Rap")
    })

    // Plusieurs occurrences → plusieurs <mark>
    test("gère plusieurs occurrences du même terme", () => {
        const { container } = render(<span>{highlight("test test test", "test")}</span>)
        expect(container.querySelectorAll("mark")).toHaveLength(3)
    })

    // La fonction doit échapper les caractères spéciaux regex avant de les
    // compiler. "(" non escapé produirait une SyntaxError au runtime.
    test("échappe les caractères regex spéciaux — parenthèse ouvrante", () => {
        const { container } = render(<span>{highlight("(test)", "(")}</span>)
        // Doit trouver exactement le caractère "(", pas exploser
        expect(container.querySelectorAll("mark")).toHaveLength(1)
        expect(container.textContent).toBe("(test)")
    })

    test("échappe le point — doit matcher le caractère '.', pas tous les caractères", () => {
        const { container } = render(<span>{highlight("v1.2.3", ".")}</span>)
        // Deux occurrences de "." dans la chaîne
        expect(container.querySelectorAll("mark")).toHaveLength(2)
    })
})

// ── tLabel() ──────────────────────────────────────────────────────────────────
// Retourne le nom de la thématique dans la langue demandée.

describe("tLabel", () => {
    test("retourne label (fr) quand lang=fr", () => {
        expect(tLabel(mkThematique(), "fr")).toBe("Livraison")
    })

    test("retourne labelEn quand lang=en", () => {
        expect(tLabel(mkThematique(), "en")).toBe("Delivery")
    })
})

// ── tQuestion() ───────────────────────────────────────────────────────────────
// Retourne le texte de la question dans la langue demandée.

describe("tQuestion", () => {
    test("retourne question (fr) quand lang=fr", () => {
        expect(tQuestion(mkQR(), "fr")).toBe("Quel est le délai ?")
    })

    test("retourne questionEn quand lang=en", () => {
        expect(tQuestion(mkQR(), "en")).toBe("What is the delay?")
    })
})

// ── tReponse() ────────────────────────────────────────────────────────────────
// Retourne le texte de la réponse dans la langue demandée.

describe("tReponse", () => {
    test("retourne briefQr (fr) quand lang=fr", () => {
        expect(tReponse(mkQR(), "fr")).toBe("Réponse courte")
    })

    test("retourne briefQrEn quand lang=en", () => {
        expect(tReponse(mkQR(), "en")).toBe("Short answer")
    })
})

// ── tFormat() ─────────────────────────────────────────────────────────────────
// Retourne le contenu d'un canal de diffusion (email, instagram, whatsapp)
// dans la langue demandée. Couvre les 3 canaux × 2 langues = 6 combinaisons.

describe("tFormat", () => {
    test("retourne email en fr", () => {
        expect(tFormat(mkFormat(), "email", "fr")).toBe("Bonjour,")
    })

    test("retourne emailEn en en", () => {
        expect(tFormat(mkFormat(), "email", "en")).toBe("Hello,")
    })

    test("retourne instagram en fr", () => {
        expect(tFormat(mkFormat(), "instagram", "fr")).toBe("Salut !")
    })

    test("retourne instagramEn en en", () => {
        expect(tFormat(mkFormat(), "instagram", "en")).toBe("Hey!")
    })

    test("retourne whatsapp en fr", () => {
        expect(tFormat(mkFormat(), "whatsapp", "fr")).toBe("Bonsoir,")
    })

    test("retourne whatsappEn en en", () => {
        expect(tFormat(mkFormat(), "whatsapp", "en")).toBe("Good evening,")
    })
})

// ── slugify() ─────────────────────────────────────────────────────────────────
// Normalise un texte libre en identifiant de fichier : minuscules, sans accents
// ni caractères spéciaux. Utilisé pour nommer les médias de thématique dans
// Supabase Storage à partir de leur nom (FR).

describe("slugify", () => {
    test("met en minuscules", () => {
        expect(slugify("LIVRAISON")).toBe("livraison")
    })

    test("remplace les espaces par des tirets", () => {
        expect(slugify("Délais de livraison")).toBe("delais-de-livraison")
    })

    test("retire les accents", () => {
        expect(slugify("Éléphant à crêpes")).toBe("elephant-a-crepes")
    })

    test("remplace la ponctuation et les caractères spéciaux par des tirets", () => {
        expect(slugify("Cas spéciaux : / \\ !")).toBe("cas-speciaux")
    })

    test("compresse les tirets consécutifs en un seul", () => {
        expect(slugify("a   b -- c")).toBe("a-b-c")
    })

    test("retire les tirets en début et fin de chaîne", () => {
        expect(slugify("  Livraison !  ")).toBe("livraison")
    })
})
