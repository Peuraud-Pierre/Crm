import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { PackageSearch, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonTable } from "@/shared/ui/molecules/skeleton-presets"
import { TablePagination } from "@/shared/ui/molecules/table-pagination"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"
import { IMPORTS_PAGE_SIZE, ROUTE_BASE } from "@/features/packing-admin/constants"
import type { PackingImportRow } from "@/features/packing-admin/types"
import { ImportDetailSheet } from "./ImportDetailSheet"
import { ImportsTable } from "./ImportsTable"

interface ImportsTabProps {
    imports: PackingImportRow[]
    loading: boolean
    error: Error | null
    /** Segment `detail` de l'URL : l'id de l'import dont la sheet est ouverte. */
    detail?: string
    onRefresh: () => void | Promise<void>
}

const BASE_URL = `${ROUTE_BASE}/imports`

/**
 * Historique des imports.
 *
 * La sheet de détail est dérivée du segment d'URL par `useDetailDeepLink` — jamais
 * d'un `useState` : l'écran reste partageable, F5 le rouvre au même endroit et le
 * bouton retour le referme. Cette garde est de SECOND niveau et ne remplace pas la
 * canonicalisation d'onglet de `TabbedModuleRoute`.
 */
export function ImportsTab({ imports, loading, error, detail, onRefresh }: ImportsTabProps) {
    const navigate = useNavigate()
    const [query, setQuery] = useState("")
    // Base 0 : c'est la convention de `TablePagination` (son affichage, lui, est
    // en base 1). Les mélanger décale silencieusement d'une page.
    const [page, setPage] = useState(0)

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (!needle) return imports
        return imports.filter(
            (row) =>
                (row.container_label ?? "").toLowerCase().includes(needle) ||
                (row.source_filename ?? "").toLowerCase().includes(needle),
        )
    }, [imports, query])

    const { viewing } = useDetailDeepLink<PackingImportRow>({
        detail,
        baseUrl: BASE_URL,
        canCreate: false,
        canUpdate: false,
        // Lecture seule : l'accès à la page vaut l'accès au détail.
        canView: true,
        loaded: !loading,
        find: (id) => imports.find((row) => row.id === id) ?? null,
    })

    const totalPages = Math.max(1, Math.ceil(filtered.length / IMPORTS_PAGE_SIZE))
    const current = Math.min(page, totalPages - 1)
    const rows = filtered.slice(current * IMPORTS_PAGE_SIZE, (current + 1) * IMPORTS_PAGE_SIZE)

    if (loading && imports.length === 0) return <SkeletonTable />

    if (error) {
        return (
            <EmptyState
                size="sm"
                icon={PackageSearch}
                title="Historique illisible"
                description={error.message}
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setPage(0)
                    }}
                    placeholder="Rechercher un conteneur ou un fichier…"
                    className="h-9 w-full sm:max-w-xs"
                />
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 sm:w-auto"
                    onClick={() => void onRefresh()}
                    loading={loading}
                >
                    <RefreshCw size={13} aria-hidden />
                    Rafraîchir
                </Button>
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={PackageSearch}
                    variant={query ? "search" : "default"}
                    title={query ? "Aucun import ne correspond" : "Aucun import enregistré"}
                    description={
                        query
                            ? "Essayez un autre nom de conteneur ou de fichier."
                            : "Les imports apparaîtront ici dès la première packing list déposée."
                    }
                    className="rounded-xl border border-dashed border-border"
                />
            ) : (
                <>
                    <ImportsTable
                        rows={rows}
                        onOpen={(row) => navigate(`${BASE_URL}/${row.id}`)}
                    />
                    <TablePagination page={current} totalPages={totalPages} onChange={setPage} />
                </>
            )}

            <ImportDetailSheet row={viewing} onClose={() => navigate(BASE_URL)} />
        </div>
    )
}
