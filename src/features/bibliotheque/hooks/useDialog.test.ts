// ── useDialog.test.ts ─────────────────────────────────────────────────────────
// Tests unitaires de la machine à états des dialogs (useDialog.ts).
//
// Ce hook est le plus simple à tester : il n'a aucune dépendance externe
// (pas de Supabase, pas de contexte). Il gère uniquement un état `dialog`
// de type discriminé (DialogState) avec 10 modes possibles.
//
// Pattern utilisé :
//   renderHook()  — monte le hook dans un composant React minimal
//   act()         — enveloppe les appels qui modifient l'état React
//                   pour que les mises à jour soient flushées synchroniquement

import { describe, expect, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { useDialog } from "./useDialog"
import type { QR, Thematique } from "../types"

// ── Factories ─────────────────────────────────────────────────────────────────

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1",
    thematiqueId: "t1",
    question: "Quel est le délai ?",
    questionEn: "What is the delay?",
    briefQr: "Réponse courte",
    briefQrEn: "Short answer",
    ...overrides,
})

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1",
    label: "Livraison",
    labelEn: "Delivery",
    imageUrl: "",
    iconUrl: "",
    ...overrides,
})

// ── État initial ───────────────────────────────────────────────────────────────

describe("useDialog — état initial", () => {
    test("dialog est null : aucun dialog ouvert au démarrage", () => {
        const { result } = renderHook(() => useDialog())
        expect(result.current.dialog).toBeNull()
    })
})

// ── Ouvertures de dialogs — modes sans payload ─────────────────────────────────
// Ces modes n'ont pas de données associées (pas de QR ni de thématique).

describe("useDialog — modes sans payload", () => {
    test("openCreateQR → mode 'create-qr'", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openCreateQR())
        expect(result.current.dialog).toEqual({ mode: "create-qr" })
    })

    test("openCreateThematique → mode 'create-thematique'", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openCreateThematique())
        expect(result.current.dialog).toEqual({ mode: "create-thematique" })
    })

    test("openEditBrief → mode 'edit-brief'", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openEditBrief())
        expect(result.current.dialog).toEqual({ mode: "edit-brief" })
    })

    test("openEditChiffres → mode 'edit-chiffres'", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openEditChiffres())
        expect(result.current.dialog).toEqual({ mode: "edit-chiffres" })
    })
})

// ── Ouvertures de dialogs — modes avec payload QR ─────────────────────────────
// Ces modes reçoivent une QR en argument et l'exposent dans dialog.qr.
// On vérifie que l'objet passé est bien celui qu'on récupère.

describe("useDialog — modes avec payload QR", () => {
    test("openEditQR → mode 'edit-qr' avec la bonne QR", () => {
        const { result } = renderHook(() => useDialog())
        const qr = mkQR({ id: "qr-edit" })
        act(() => result.current.openEditQR(qr))
        expect(result.current.dialog).toEqual({ mode: "edit-qr", qr })
    })

    test("openDeleteQR → mode 'delete-qr' avec la bonne QR", () => {
        const { result } = renderHook(() => useDialog())
        const qr = mkQR({ id: "qr-delete" })
        act(() => result.current.openDeleteQR(qr))
        expect(result.current.dialog).toEqual({ mode: "delete-qr", qr })
    })

    test("openEditFormat → mode 'edit-format' avec la bonne QR", () => {
        const { result } = renderHook(() => useDialog())
        const qr = mkQR({ id: "qr-format" })
        act(() => result.current.openEditFormat(qr))
        expect(result.current.dialog).toEqual({ mode: "edit-format", qr })
    })
})

// ── Ouvertures de dialogs — modes avec payload Thematique ─────────────────────

describe("useDialog — modes avec payload Thematique", () => {
    test("openRenameThematique → mode 'rename-thematique' avec la bonne thématique", () => {
        const { result } = renderHook(() => useDialog())
        const t = mkThematique({ id: "t-rename" })
        act(() => result.current.openRenameThematique(t))
        expect(result.current.dialog).toEqual({ mode: "rename-thematique", thematique: t })
    })

    test("openDeleteThematique → mode 'delete-thematique' avec la bonne thématique", () => {
        const { result } = renderHook(() => useDialog())
        const t = mkThematique({ id: "t-delete" })
        act(() => result.current.openDeleteThematique(t))
        expect(result.current.dialog).toEqual({ mode: "delete-thematique", thematique: t })
    })
})

// ── Fermeture ─────────────────────────────────────────────────────────────────

describe("useDialog — closeDialog", () => {
    test("closeDialog remet dialog à null depuis n'importe quel mode", () => {
        const { result } = renderHook(() => useDialog())
        // Ouvre un dialog d'abord
        act(() => result.current.openEditBrief())
        expect(result.current.dialog).not.toBeNull()
        // Ferme
        act(() => result.current.closeDialog())
        expect(result.current.dialog).toBeNull()
    })
})

// ── Transitions ───────────────────────────────────────────────────────────────
// Vérifie que passer d'un dialog à un autre fonctionne sans closeDialog intermédiaire.

describe("useDialog — transitions entre modes", () => {
    test("ouvrir un dialog depuis un autre remplace le précédent", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openCreateQR())
        act(() => result.current.openEditBrief())
        // Le premier dialog doit avoir été remplacé
        expect(result.current.dialog).toEqual({ mode: "edit-brief" })
    })

    test("enchaîner close → open → close fonctionne", () => {
        const { result } = renderHook(() => useDialog())
        act(() => result.current.openCreateQR())
        act(() => result.current.closeDialog())
        act(() => result.current.openEditChiffres())
        expect(result.current.dialog).toEqual({ mode: "edit-chiffres" })
        act(() => result.current.closeDialog())
        expect(result.current.dialog).toBeNull()
    })
})
