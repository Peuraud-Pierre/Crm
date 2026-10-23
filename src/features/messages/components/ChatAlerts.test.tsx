import React from "react"
import { describe, it, expect } from "@rstest/core"
import { render, screen, act } from "@testing-library/react"
import { ChatAlerts } from "./ChatAlerts"

void React

/**
 * Ce fichier testait auparavant un composant `ChatAlerts` **fictif**, défini
 * dans le fichier lui-même avec une API (`alerts[]`, `onDismiss`) que le vrai
 * composant n'a jamais eue. 320 lignes qui ne protégeaient rien : le vrai
 * `ChatAlerts` pouvait être cassé sans qu'un seul test échoue.
 */
describe("ChatAlerts", () => {
    describe("Bandeau d'erreur", () => {
        it("affiche l'erreur dans une conversation ouverte", () => {
            render(
                <ChatAlerts
                    hasActiveConversation
                    error="Cles membres introuvables"
                    showAutoUnlock={false}
                />
            )
            expect(screen.getByText("Cles membres introuvables")).toBeDefined()
        })

        it("tait l'erreur hors conversation", () => {
            // Une erreur de conversation n'a pas de sens sur l'écran d'accueil,
            // où aucun fil n'est sélectionné.
            render(
                <ChatAlerts
                    hasActiveConversation={false}
                    error="Cles membres introuvables"
                    showAutoUnlock={false}
                />
            )
            expect(screen.queryByText("Cles membres introuvables")).toBeNull()
        })

        it("n'affiche rien sans erreur ni déverrouillage", () => {
            const { container } = render(
                <ChatAlerts
                    hasActiveConversation
                    error={null}
                    showAutoUnlock={false}
                />
            )
            expect(container.textContent).toBe("")
        })
    })

    describe("Bandeau de déverrouillage automatique", () => {
        it("apparaît quand la session est déverrouillée seule", () => {
            render(
                <ChatAlerts
                    hasActiveConversation
                    error={null}
                    showAutoUnlock
                />
            )
            expect(
                screen.getByText("Session deverrouillee automatiquement")
            ).toBeDefined()
        })

        it("reste monté le temps de son animation de sortie", async () => {
            const { rerender } = render(
                <ChatAlerts
                    hasActiveConversation
                    error={null}
                    showAutoUnlock
                />
            )
            rerender(
                <ChatAlerts
                    hasActiveConversation
                    error={null}
                    showAutoUnlock={false}
                />
            )

            // Démonter immédiatement ferait disparaître le bandeau d'un coup :
            // il survit à la prop pour laisser jouer le fondu (220 ms).
            expect(
                screen.queryByText("Session deverrouillee automatiquement")
            ).not.toBeNull()

            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 300))
            })

            expect(
                screen.queryByText("Session deverrouillee automatiquement")
            ).toBeNull()
        })

        it("affiche les deux bandeaux quand les deux conditions sont réunies", () => {
            render(
                <ChatAlerts
                    hasActiveConversation
                    error="Erreur chargement messages"
                    showAutoUnlock
                />
            )
            expect(screen.getByText("Erreur chargement messages")).toBeDefined()
            expect(
                screen.getByText("Session deverrouillee automatiquement")
            ).toBeDefined()
        })
    })
})
