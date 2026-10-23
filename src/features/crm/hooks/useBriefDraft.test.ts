import { afterEach, expect, test } from "@rstest/core"

import { clearDraft, draftKey, readDraft, writeDraft } from "./useBriefDraft"
import type { FicheAppro } from "@/features/crm/hooks/CRM_hook/use_client"

const fiche = { Note: "brief en cours" } as FicheAppro

afterEach(() => localStorage.clear())

test("un brouillon écrit est relisible", () => {
    const key = draftKey("client-1")
    writeDraft(key, fiche)

    const draft = readDraft(key)
    expect(draft?.fiche).toEqual(fiche)
    expect(typeof draft?.savedAt).toBe("number")
})

test("écrire purge les brouillons des autres clients", () => {
    writeDraft(draftKey("client-1"), fiche)
    writeDraft(draftKey("client-2"), fiche)

    // Le quota est limité : un seul brouillon vivant à la fois.
    expect(readDraft(draftKey("client-1"))).toBeNull()
    expect(readDraft(draftKey("client-2"))).not.toBeNull()
})

// Régression : le brouillon était écrit en fiche brute, sans date. Sans elle,
// impossible de savoir s'il devance le serveur — on ne le propose donc pas.
test("un brouillon au format antérieur est ignoré", () => {
    const key = draftKey("client-1")
    localStorage.setItem(key, JSON.stringify(fiche))
    expect(readDraft(key)).toBeNull()
})

test("un brouillon périmé est ignoré", () => {
    const key = draftKey("client-1")
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000
    localStorage.setItem(key, JSON.stringify({ savedAt: twoDaysAgo, fiche }))
    expect(readDraft(key)).toBeNull()
})

test("du contenu illisible ne fait pas planter la lecture", () => {
    const key = draftKey("client-1")
    localStorage.setItem(key, "{pas du json")
    expect(readDraft(key)).toBeNull()
})

test("clearDraft supprime le brouillon", () => {
    const key = draftKey("client-1")
    writeDraft(key, fiche)
    clearDraft(key)
    expect(readDraft(key)).toBeNull()
})
