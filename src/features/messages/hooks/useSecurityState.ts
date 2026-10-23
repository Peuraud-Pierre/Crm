import { createContext, createElement, use, type ReactNode } from "react"
import { usePinManager } from "./usePinManager"

type SecurityStateValue = ReturnType<typeof usePinManager>

const SecurityStateContext = createContext<SecurityStateValue | null>(null)

export function SecurityStateProvider({ children }: { children: ReactNode }) {
    const value = usePinManager()
    return createElement(SecurityStateContext.Provider, { value }, children)
}

export function useSecurityState() {
    const context = use(SecurityStateContext)
    if (!context) {
        throw new Error(
            "useSecurityState must be used within SecurityStateProvider"
        )
    }
    return context
}
