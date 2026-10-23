import { useState, useEffect, useCallback } from "react"
import { fetchAllReports, fetchVisibleReports } from "../services/veilleReportService"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import type { VeilleItem, VeilleMetadata } from "../types/veille.types"

interface UseVeilleReportsOptions {
    /** Service ID to filter reports by. If provided, overrides user's service_id. */
    userServiceId?: string
    /** If true, fetch all reports (admin-only). If false/undefined, filter by service. */
    fetchAll?: boolean
    /** Date range filter: how far back to fetch reports */
    dateRange?: "1m" | "3m" | "6m" | "1y" | "all"
}

interface UseVeilleReportsResult {
    reports: VeilleItem[]
    loading: boolean
    error: Error | null
    refetch: () => Promise<void>
}

type VeilleReportRow = Omit<VeilleItem, "created_at" | "metadata" | "tags"> & {
    created_at: string | null
    metadata: unknown
    tags: string | string[] | null
}

const isVeilleMetadata = (metadata: unknown): metadata is VeilleMetadata => {
    return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
}

const normalizeTags = (tags: VeilleReportRow["tags"]): string[] | null => {
    if (Array.isArray(tags)) {
        return tags.filter((tag): tag is string => typeof tag === "string")
    }

    if (typeof tags !== "string" || tags.trim() === "") {
        return null
    }

    try {
        const parsed = JSON.parse(tags)
        if (Array.isArray(parsed)) {
            return parsed.filter((tag): tag is string => typeof tag === "string")
        }
    } catch {
        // Some RPC typings expose text[] as string even though Supabase returns arrays.
    }

    return tags
        .replace(/^{|}$/g, "")
        .split(",")
        .map((tag) => tag.trim().replace(/^"|"$/g, ""))
        .filter(Boolean)
}

const toVeilleItem = (report: VeilleReportRow): VeilleItem => ({
    ...report,
    created_at: report.created_at ?? new Date(0).toISOString(),
    metadata: isVeilleMetadata(report.metadata) ? report.metadata : null,
    tags: normalizeTags(report.tags),
})

const toVeilleItems = (reports: VeilleReportRow[] | null): VeilleItem[] => {
    return reports?.map(toVeilleItem) ?? []
}

export const useVeilleReports = (options?: UseVeilleReportsOptions): UseVeilleReportsResult => {
    const [reports, setReports] = useState<VeilleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const { user } = useAuth()

    const getDateRangeStart = useCallback((range?: string): string | null => {
        if (!range || range === "all") return null
        const now = new Date()
        switch (range) {
            case "1m":
                now.setMonth(now.getMonth() - 1)
                break
            case "3m":
                now.setMonth(now.getMonth() - 3)
                break
            case "6m":
                now.setMonth(now.getMonth() - 6)
                break
            case "1y":
                now.setFullYear(now.getFullYear() - 1)
                break
            default:
                return null
        }
        return now.toISOString()
    }, [])

    const fetchReports = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const dateStart = getDateRangeStart(options?.dateRange)

            // If fetchAll is true, fetch all reports without service filtering
            // This is for admin pages only - RLS policies should prevent unauthorized access
            if (options?.fetchAll) {
                const data = await fetchAllReports(dateStart)
                setReports(toVeilleItems(data))
                return
            }

            // For regular users, determine the service ID to use for filtering
            // Priority: explicit option > user's service_id
            const serviceIdToUse = options?.userServiceId || user?.service_id

            // If no service ID is available, we cannot fetch reports securely
            if (!serviceIdToUse) {
                throw new Error(
                    "Impossible de charger les rapports: aucun service associé à cet utilisateur"
                )
            }

            // Call the RPC function to get reports filtered by service at the database level
            // This is the single source of truth for visibility and prevents unauthorized access via DevTools/API
            const data = await fetchVisibleReports(serviceIdToUse)

            setReports(toVeilleItems(data))
        } catch (err) {
            setError(
                err instanceof Error ? err : new Error("Une erreur est survenue")
            )
        } finally {
            setLoading(false)
        }
    }, [options?.userServiceId, options?.fetchAll, options?.dateRange, user?.service_id, getDateRangeStart])

    useEffect(() => {
        fetchReports()
    }, [fetchReports])

    return { reports, loading, error, refetch: fetchReports }
}
