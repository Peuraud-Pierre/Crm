import {
    deleteJournalEntryById,
    fetchJournalEntries,
    insertJournalEntry,
    updateJournalEntryById,
} from "@/features/journal/services/journalEntryService"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

export interface JournalEntry {
    id: string
    sell_at: string
    service: string
    commercial: string
    sales: string
    created_at: string
    created_by: string
}

export function useJournalEntry() {
    const { user } = useAuth()
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [loading, setLoading] = useState(false)

    const fetchEntries = useCallback(async () => {
        if (!user?.user_id) return

        setLoading(true)
        try {
            const { data, error } = await fetchJournalEntries()

            if (!data || error) throw error

            setEntries(data as JournalEntry[])
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Erreur lors de la récupération des entrées du journal."
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [user?.user_id])

    const createEntry = useCallback(
        async (
            sell_at: string,
            service: string,
            commercial: string,
            sales: string
        ) => {
            try {
                const { data, error } = await insertJournalEntry({
                    sell_at,
                    service,
                    commercial,
                    sales,
                    created_by: user?.full_name || "Inconnu",
                })

                if (error) throw error
                if (data) {
                    setEntries((prev) => [data as JournalEntry, ...prev])
                }
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Erreur lors de la création de l'entrée du journal."
                toast.error(message)
                console.log(err)
            }
        },
        [setEntries, user?.user_id]
    )

    const updateEntry = useCallback(
        async (
            entryId: string,
            date: string,
            service: string,
            commercial: string,
            sale: string
        ) => {
            try {
                const { data, error } = await updateJournalEntryById(entryId, {
                    sell_at: date,
                    service: service,
                    commercial: commercial,
                    sales: sale,
                })

                if (error) throw error
                if (data) {
                    setEntries((prev) =>
                        prev.map((entry) =>
                            entry.id === entryId
                                ? (data as JournalEntry)
                                : entry
                        )
                    )
                }
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Erreur lors de la mise à jour de l'entrée du journal."
                toast.error(message)
                console.log(err)
            }
        },
        [setEntries]
    )

    const deleteEntry = useCallback(async (entryId: string) => {
        try {
            const { error } = await deleteJournalEntryById(entryId)

            if (error) throw error
            setEntries((prev) => prev.filter((entry) => entry.id !== entryId))
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Erreur lors de la suppression de l'entrée du journal."
            toast.error(message)
            console.log(err)
        }
    }, [setEntries])

    return {
        entries,
        loading,
        setEntries,
        fetchEntries,
        createEntry,
        updateEntry,
        deleteEntry,
        refetch: fetchEntries,
    }
}
