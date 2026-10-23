// context/ShareProvider.tsx
import { useShare } from "@/features/drive/hooks/useShare"
import {
    createContext,
    createElement,
    type ReactNode,
    use,
} from "react"

type ShareCtx = ReturnType<typeof useShare>

const ShareContext = createContext<ShareCtx | null>(null)

/**
 * Provides a context for sharing functionality throughout the application.
 *
 * @param props - The provider component props
 * @param props.baseUrl - The base URL used for share operations
 * @param props.children - The child components to be wrapped by the context provider
 * @returns A context provider component that supplies share functionality to descendant components
 */
export function ShareProvider({
    baseUrl,
    children,
}: {
    baseUrl: string
    children: ReactNode
}) {
    const value = useShare({ baseUrl })
    return createElement(ShareContext, { value }, children)
}

/**
 * Hook to access the Share context.
 *
 * @returns {ShareCtx} The Share context object
 * @throws {Error} If used outside of a ShareProvider component
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const shareCtx = useShareCtx();
 *   // use shareCtx...
 * }
 * ```
 */
export function useShareCtx(): ShareCtx {
    const ctx = use(ShareContext)
    if (!ctx) {
        throw new Error("useShareCtx must be used under <ShareProvider>")
    }
    return ctx
}
