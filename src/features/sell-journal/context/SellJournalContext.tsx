import {
    type JournalEntry,
    useJournalEntry,
} from "@/features/journal/hooks/Journal_hook/useJournalEntry"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { subscribeToJournalEntries } from "@/features/sell-journal/services/journalEntryService"
import {
    createContext,
    createElement,
    use,
    useEffect,
    useMemo,
    useState,
} from "react"

interface SellJournalContextType {
    activeTabJSell: string
    setActiveTabJSell: (tab: string) => void

    // ============================ ENTRIES CONTEXT ============================
    entries: JournalEntry[]
    fetchEntries?: () => Promise<void>
    createEntry: (
        sell_at: string,
        service: string,
        commercial: string,
        amount: string
    ) => Promise<void>
    updateEntry: (
        id: string,
        sell_at: string,
        service: string,
        commercial: string,
        amount: string
    ) => Promise<void>
    deleteEntry: (id: string) => Promise<void>
}

const SellJournalContext = createContext<SellJournalContextType | undefined>(
    undefined
)

export function SellJournalProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const { user } = useAuth()

    const [activeTabJSell, setActiveTabJSell] = useState<string>(
        () => localStorage.getItem("activeTabJSell") || "today-entry"
    )

    const {
        entries,
        setEntries,
        createEntry,
        updateEntry,
        deleteEntry,
        fetchEntries,
    } = useJournalEntry()

    const value = useMemo(
        () => ({
            activeTabJSell,
            setActiveTabJSell,
            entries,
            createEntry,
            updateEntry,
            deleteEntry,
            fetchEntries,
        }),
        [
            activeTabJSell,
            setActiveTabJSell,
            entries,
            createEntry,
            updateEntry,
            deleteEntry,
            fetchEntries,
        ]
    )

    useEffect(() => {
        if (!user?.user_id) return

        // initial fetch
        fetchEntries()

        // live updates channel for journal_entry table
        const unsubscribe = subscribeToJournalEntries(
            user.user_id,
            (payload) => {
                if (payload.eventType === "INSERT" && payload.new) {
                    setEntries((prev) => {
                        const next = payload.new as JournalEntry
                        if (prev.some((entry) => entry.id === next.id)) {
                            return prev
                        }
                        return [next, ...prev]
                    })
                }

                // === Update ===
                if (payload.eventType === "UPDATE" && payload.new) {
                    setEntries((prev) =>
                        prev.map((c) =>
                            c.id === payload.new.id
                                ? (payload.new as JournalEntry)
                                : c
                        )
                    )
                }

                // === Delete ===
                if (payload.eventType === "DELETE" && payload.old) {
                    setEntries((prev) =>
                        prev.filter((c) => c.id !== payload.old.id)
                    )
                }
            }
        )

        return () => {
            unsubscribe()
        }
    }, [user?.user_id, fetchEntries, setEntries])

    return createElement(SellJournalContext, { value }, children)
}

export function useSellJournalContext() {
    const context = use(SellJournalContext)
    if (!context)
        throw new Error(
            "useSellJournalContext must be used within a SellJournalProvider"
        )
    return context
}
