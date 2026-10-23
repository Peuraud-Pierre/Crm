// SortersContext.tsx
import {
    fetchSortingReports,
    updateSortingReport,
    subscribeSortingReports,
} from "@/features/sorters/services/sortersService"
import {
    createContext,
    createElement,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    use,
    useEffect,
    useState,
} from "react"

import type { SortingReport } from "../components/struct"

interface SortersContextType {
    adminView: boolean
    reports: SortingReport[]
    filteredReports: SortingReport[]
    loading: boolean
    filter: string
    setFilter: Dispatch<SetStateAction<string>>
    search: string
    setSearch: Dispatch<SetStateAction<string>>
    openForm: boolean
    setOpenForm: Dispatch<SetStateAction<boolean>>
    openNewForm: () => void
    editing: SortingReport | null
    setEditing: Dispatch<SetStateAction<SortingReport | null>>
    form: SortingReport | null
    setForm: Dispatch<SetStateAction<SortingReport | null>>
    saving: boolean
    setSaving: Dispatch<SetStateAction<boolean>>
    fetchReports: (adminView: boolean, userId: string) => Promise<void>
    handleSave: (id: string) => Promise<void>
    openEditForm: (report: SortingReport) => void
}

const SortersContext = createContext<SortersContextType>(
    {} as SortersContextType
)

/**
 * Provider component for managing sorting reports state and operations.
 *
 * @param {Object} props - Component props
 * @param {string} props.userId - The ID of the current user
 * @param {boolean} props.adminView - Whether the user is viewing in admin mode
 * @param {React.ReactNode} props.children - Child components to be wrapped by the provider
 *
 * @returns {React.ReactElement} A context provider wrapping the children with sorting reports functionality
 *
 * @description
 * Manages the complete lifecycle of sorting reports including:
 * - Fetching reports from Supabase with optional admin filtering
 * - Real-time synchronization of report changes (INSERT, UPDATE, DELETE)
 * - Filtering and searching reports by category and comments
 * - Creating new reports and editing existing ones
 * - Validating and sanitizing payload data before persistence
 * - Form state management for create/edit operations
 *
 * @example
 * ```tsx
 * <SortersProvider userId="user-123" adminView={false}>
 *   <YourComponent />
 * </SortersProvider>
 * ```
 */
export function SortersProvider({
    userId,
    adminView,
    children,
}: {
    userId: string
    adminView: boolean
    children: ReactNode
}) {
    const [reports, setReports] = useState<SortingReport[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState("all")
    const [search, setSearch] = useState("")
    const [openForm, setOpenForm] = useState(false)
    const [editing, setEditing] = useState<SortingReport | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<SortingReport | null>(null)

    useEffect(() => {
        fetchReports(adminView, userId)
    }, [userId, adminView])

    useEffect(() => {
        const unsubscribe = subscribeSortingReports(
            ({ eventType, new: newRow, old: oldRow }) => {
                setReports((prev) => {
                    switch (eventType) {
                        case "INSERT":
                            return prev.some((r) => r.id === newRow.id)
                                ? prev
                                : [newRow, ...prev]

                        case "UPDATE":
                            return prev.map((r) =>
                                r.id === newRow.id ? newRow : r
                            )

                        case "DELETE":
                            return prev.filter((r) => r.id !== oldRow.id)

                        default:
                            return prev
                    }
                })
            }
        )

        return unsubscribe
    }, [])

    const filteredReports = reports.filter((r) => {
        const matchesCategory = filter === "all" || r.category === filter
        const matchesSearch =
            r.comments?.toLowerCase().includes(search.toLowerCase()) ||
            r.category.toLowerCase().includes(search.toLowerCase())
        return matchesCategory && matchesSearch
    })

    const openNewForm = () => {
        setEditing(null)
        setForm({
            id: "",
            category: "",
            fournisseur_uid: "",
            uid_balle: "",
            mag_piece: 0,
            kssummer_piece: 0,
            kswinter_piece: 0,
            so3_piece: 0,
            export_piece: 0,
            client_piece: 0,
            mag_kg: 0,
            kssummer_kg: 0,
            kswinter_kg: 0,
            so3_kg: 0,
            export_kg: 0,
            client_kg: 0,
            quantity: 0,
            quality: 1,
            comments: "",
            time: "00:00:00",
            user_id: "",
            updated_at: "00:00:00 - 00/00/0000",
        })
        setOpenForm(true)
    }

    const openEditForm = (report: SortingReport) => {
        setEditing(report)
        setForm({
            id: report.id,
            category: report.category,
            fournisseur_uid: report.fournisseur_uid,
            uid_balle: report.uid_balle,
            mag_piece: report.mag_piece,
            kssummer_piece: report.kssummer_piece,
            kswinter_piece: report.kswinter_piece,
            so3_piece: report.so3_piece,
            export_piece: report.export_piece,
            client_piece: report.client_piece,
            mag_kg: report.mag_kg,
            kssummer_kg: report.kssummer_kg,
            kswinter_kg: report.kswinter_kg,
            so3_kg: report.so3_kg,
            export_kg: report.export_kg,
            client_kg: report.client_kg,
            quantity: report.quantity,
            quality: report.quality ?? 1,
            comments: report.comments ?? "",
            time: report.time,
            user_id: report.user_id,
            updated_at: report.updated_at,
        })
        setOpenForm(true)
    }

    const fetchReports = async (adminView: boolean, userId: string) => {
        setLoading(true)
        const data = await fetchSortingReports(adminView, userId)
        setReports(data)
        setLoading(false)
    }

    const validColumns = [
        "uid_balle",
        "mag_piece",
        "kssummer_piece",
        "kswinter_piece",
        "so3_piece",
        "export_piece",
        "client_piece",
        "mag_kg",
        "kssummer_kg",
        "kswinter_kg",
        "so3_kg",
        "export_kg",
        "client_kg",
        "quantity",
        "quality",
        "comments",
        "time",
    ]

    const sanitizePayload = (form: SortingReport) => {
        const clean = {} as Record<string, string | number>

        for (const [key, value] of Object.entries(form || {})) {
            if (!validColumns.includes(key)) continue

            if (value === undefined) continue
            if (value === "") {
                clean[key] = ""
                continue
            }
            if (typeof value === "number" && isNaN(value)) continue

            clean[key] = value
        }

        return clean
    }

    const handleSave = async (id: string) => {
        setSaving(true)

        const payload = sanitizePayload(form as SortingReport)

        if (editing) {
            await updateSortingReport(id, payload)
        }

        setSaving(false)
        setOpenForm(false)
        // Awaité : sans ça le refetch continuait après le retour de handleSave
        // (promesse flottante — logs et setState hors du cycle de l'appelant).
        await fetchReports(adminView, userId)
    }

    return createElement(
        SortersContext,
        {
            value: {
                adminView,
                reports,
                filteredReports,
                loading,
                filter,
                setFilter,
                search,
                setSearch,
                openForm,
                setOpenForm,
                openNewForm,
                editing,
                setEditing,
                form,
                setForm,
                saving,
                setSaving,
                fetchReports,
                handleSave,
                openEditForm,
            },
        },
        children
    )
}

export const useSorters = () => use(SortersContext)
