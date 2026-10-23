"use client"

import { createContext, use, type ReactNode } from "react"
import { useChangelog } from "../data/useChangelog"

/**
 * `ReturnType<typeof useChangelog>` plutôt qu'une interface réécrite : le
 * provider précédent redéclarait à la main les douze signatures du hook,
 * qui avaient fini par diverger (types de retour `Promise<void>` là où le
 * hook renvoie désormais un booléen de succès).
 */
type ChangelogContextValue = ReturnType<typeof useChangelog>

const ChangelogContext = createContext<ChangelogContextValue | undefined>(
    undefined
)

export function ChangelogProvider({ children }: { children: ReactNode }) {
    const changelog = useChangelog()

    return <ChangelogContext value={changelog}>{children}</ChangelogContext>
}

export function useChangelogContext(): ChangelogContextValue {
    const ctx = use(ChangelogContext)
    if (!ctx) {
        throw new Error(
            "useChangelogContext must be used inside <ChangelogProvider>"
        )
    }
    return ctx
}
