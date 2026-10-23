import { useCallback, useState } from "react"

type AuthState = {
    email?: string
    session?: string
}

type UsePakeAuthResult = {
    initiatePakeAuth: (email: string, password: string) => Promise<AuthState>
    completePakeAuth: () => Promise<boolean>
    clearAuth: () => void
} & AuthState

const isValidEmail = (value: string | null | undefined) =>
    typeof value === "string" && value.includes("@") && value.includes(".")

const isValidPassword = (value: string | null | undefined) =>
    typeof value === "string" && value.length >= 6

export function usePakeAuth(): UsePakeAuthResult {
    const [state, setState] = useState<AuthState>({})

    const initiatePakeAuth = useCallback(
        async (email: string, password: string) => {
            if (!isValidEmail(email)) {
                throw new Error("Invalid email")
            }
            if (!isValidPassword(password)) {
                throw new Error("Invalid password")
            }

            const nextState: AuthState = {
                email,
                session: `pake-session-${Date.now()}`,
            }
            setState(nextState)
            return nextState
        },
        []
    )

    const completePakeAuth = useCallback(async () => true, [])

    const clearAuth = useCallback(() => {
        setState({})
    }, [])

    return {
        ...state,
        initiatePakeAuth,
        completePakeAuth,
        clearAuth,
    }
}
