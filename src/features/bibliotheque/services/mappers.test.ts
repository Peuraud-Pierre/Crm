// ── mappers.test.ts ───────────────────────────────────────────────────────────
// Tests unitaires des fonctions de mapping services/mappers.ts.
//
// Ces fonctions convertissent les lignes brutes retournées par Supabase
// (snake_case, types nullable) en objets métier (camelCase, strings garanties).
// Ce sont des fonctions pures — aucun mock nécessaire.
//
// Note : ThematiqueRow/QRRow/FormatRow/BriefRow sont des alias `type`-only
// (dérivés des types Supabase générés) dans mappers.ts, donc le client
// Supabase n'est jamais instancié lors de ces tests.

import { describe, expect, test } from "@rstest/core"
import {
    mapThematique, mapQR, mapFormatRow, mapBriefRow,
    type ThematiqueRow, type QRRow, type FormatRow, type BriefRow,
} from "./mappers"

// ── Factories ─────────────────────────────────────────────────────────────────
// Chaque factory produit une ligne complète avec des valeurs réalistes.
// Les surcharges permettent de tester les cas limites (null, valeurs manquantes)
// sans avoir à réécrire toute la ligne à chaque fois.

const mkThematiqueRow = (overrides: Partial<ThematiqueRow> = {}): ThematiqueRow => ({
    id: "t1",
    label: "Livraison",
    label_en: "Delivery",
    image_url: "/images/livraison.jpg",
    icon_url: "/icons/truck.svg",
    position: 0,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

const mkQRRow = (overrides: Partial<QRRow> = {}): QRRow => ({
    id: "qr1",
    thematique_id: "t1",
    question: "Quel est le délai ?",
    question_en: "What is the delay?",
    brief_qr: "Réponse courte",
    brief_qr_en: "Short answer",
    position: 0,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

const mkFormatRow = (overrides: Partial<FormatRow> = {}): FormatRow => ({
    id: "fmt1",
    quest_rep_id: "qr1",
    email: "Bonjour,",
    email_en: "Hello,",
    instagram: "Salut !",
    instagram_en: "Hey!",
    whatsapp: "Bonsoir,",
    whatsapp_en: "Good evening,",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

const mkBriefRow = (overrides: Partial<BriefRow> = {}): BriefRow => ({
    id: 1,
    brief: "Le brief FR",
    brief_en: "The EN brief",
    chiffres: "Les chiffres FR",
    chiffres_en: "The EN figures",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

// ── mapThematique() ───────────────────────────────────────────────────────────
// Vérifie la conversion snake_case → camelCase et le fallback '' sur null.

describe("mapThematique", () => {
    test("convertit tous les champs snake_case en camelCase", () => {
        const result = mapThematique(mkThematiqueRow())
        expect(result).toEqual({
            id: "t1",
            label: "Livraison",
            labelEn: "Delivery",
            imageUrl: "/images/livraison.jpg",
            iconUrl: "/icons/truck.svg",
        })
    })

    // Les colonnes optionnelles peuvent retourner null depuis Supabase
    // (colonne nullable ou valeur non renseignée). Le mapper doit substituer ''.

    test("remplace null par '' pour label_en", () => {
        const row = mkThematiqueRow({ label_en: null as unknown as string })
        expect(mapThematique(row).labelEn).toBe("")
    })

    test("remplace null par '' pour image_url", () => {
        const row = mkThematiqueRow({ image_url: null as unknown as string })
        expect(mapThematique(row).imageUrl).toBe("")
    })

    test("remplace null par '' pour icon_url", () => {
        const row = mkThematiqueRow({ icon_url: null as unknown as string })
        expect(mapThematique(row).iconUrl).toBe("")
    })

    // Vérifie que les champs gérés automatiquement (position, dates, created_by)
    // ne sont PAS exposés dans l'objet métier — ils resteraient des détails d'infra.
    test("n'expose pas les champs infra (position, dates, created_by)", () => {
        const result = mapThematique(mkThematiqueRow())
        expect(result).not.toHaveProperty("position")
        expect(result).not.toHaveProperty("created_at")
        expect(result).not.toHaveProperty("created_by")
    })
})

// ── mapQR() ───────────────────────────────────────────────────────────────────
// Vérifie la conversion et le fallback '' sur les champs EN optionnels.

describe("mapQR", () => {
    test("convertit tous les champs snake_case en camelCase", () => {
        const result = mapQR(mkQRRow())
        expect(result).toEqual({
            id: "qr1",
            thematiqueId: "t1",
            question: "Quel est le délai ?",
            questionEn: "What is the delay?",
            briefQr: "Réponse courte",
            briefQrEn: "Short answer",
        })
    })

    test("remplace null par '' pour question_en", () => {
        const row = mkQRRow({ question_en: null as unknown as string })
        expect(mapQR(row).questionEn).toBe("")
    })

    test("remplace null par '' pour brief_qr_en", () => {
        const row = mkQRRow({ brief_qr_en: null as unknown as string })
        expect(mapQR(row).briefQrEn).toBe("")
    })

    test("n'expose pas les champs infra (position, dates, created_by)", () => {
        const result = mapQR(mkQRRow())
        expect(result).not.toHaveProperty("position")
        expect(result).not.toHaveProperty("created_at")
        expect(result).not.toHaveProperty("created_by")
    })
})

// ── mapFormatRow() ────────────────────────────────────────────────────────────
// Retourne un tuple [qrId, FormatMap] pour faciliter la construction du
// dictionnaire `formatReponses` dans useBibli.

describe("mapFormatRow", () => {
    test("retourne [quest_rep_id, FormatMap] complet", () => {
        const [qrId, fmt] = mapFormatRow(mkFormatRow())
        expect(qrId).toBe("qr1")
        expect(fmt).toEqual({
            email: "Bonjour,",
            emailEn: "Hello,",
            instagram: "Salut !",
            instagramEn: "Hey!",
            whatsapp: "Bonsoir,",
            whatsappEn: "Good evening,",
        })
    })

    // Les champs peuvent être null si la rédaction n'est pas terminée
    test("remplace null par '' pour les champs manquants", () => {
        const row = mkFormatRow({
            email: null as unknown as string,
            instagram_en: null as unknown as string,
            whatsapp: null as unknown as string,
        })
        const [, fmt] = mapFormatRow(row)
        expect(fmt.email).toBe("")
        expect(fmt.instagramEn).toBe("")
        expect(fmt.whatsapp).toBe("")
    })

    // Le premier élément du tuple doit toujours être l'id de la Q&R parente
    test("utilise quest_rep_id (pas id) comme clé du tuple", () => {
        const row = mkFormatRow({ id: "fmt-999", quest_rep_id: "qr-parent" })
        const [qrId] = mapFormatRow(row)
        expect(qrId).toBe("qr-parent")
    })
})

// ── mapBriefRow() ─────────────────────────────────────────────────────────────
// Convertit la ligne singleton de la table bibliotheque_brief en Brief.

describe("mapBriefRow", () => {
    test("convertit les champs en Brief", () => {
        const result = mapBriefRow(mkBriefRow())
        expect(result).toEqual({
            brief: "Le brief FR",
            briefEn: "The EN brief",
            chiffres: "Les chiffres FR",
            chiffresEn: "The EN figures",
        })
    })

    // En base, tous les champs sont potentiellement null (row vide ou partiellement remplie)
    test("remplace null par '' pour tous les champs texte", () => {
        const row = mkBriefRow({
            brief: null as unknown as string,
            brief_en: null as unknown as string,
            chiffres: null as unknown as string,
            chiffres_en: null as unknown as string,
        })
        const result = mapBriefRow(row)
        expect(result.brief).toBe("")
        expect(result.briefEn).toBe("")
        expect(result.chiffres).toBe("")
        expect(result.chiffresEn).toBe("")
    })

    test("n'expose pas l'id numérique ni updated_at", () => {
        const result = mapBriefRow(mkBriefRow())
        expect(result).not.toHaveProperty("id")
        expect(result).not.toHaveProperty("updated_at")
    })
})
