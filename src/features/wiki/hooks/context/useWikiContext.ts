import { use } from "react"
import { WikiContext } from "./WikiContext"

export function useWikiContext() {
    const ctx = use(WikiContext)
    if (!ctx) {
        throw new Error("useWikiContext must be used inside WikiProvider")
    }
    return ctx
}
