import type { ReactNode } from "react"

/**
 * Cadre des écrans de verrouillage (création de code, déverrouillage).
 *
 * Reprend exactement la coquille de la messagerie pour que le passage à la
 * conversation ne fasse pas sauter la mise en page. Extrait de `ChatView`,
 * qui dépassait le seuil de 400 lignes de CLAUDE.md — la coquille y était
 * recopiée trois fois à l'identique.
 */
export function ChatLockScreen({ children }: { children: ReactNode }) {
    return (
        <div className="relative flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-surface">
            {children}
        </div>
    )
}
