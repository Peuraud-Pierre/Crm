import { Button } from "@/shared/ui/atoms/button"
import { useProfiles } from "@/shared/context/ProfilesProvider"
import { useSorters } from "@/features/sorters/context/SortersProvider"
import { useHighlightOnChange } from "@/features/sorters/hooks/useHighlightOnChange"
import { Pencil } from "lucide-react"
import { useCallback, useMemo } from "react"

import { type SortingReport } from "./struct"

/*
export interface ArtisticFripeProps {
    genre: string
    setGenre: React.Dispatch<React.SetStateAction<string>>
    handleSend: (appId: number) => Promise<void>
    setOpenDialog: React.Dispatch<React.SetStateAction<number | null>>
    toast: ToastFn
    MiniApp: MiniApp
    htmlResult: string
    selectedFiles: File[]
    setSelectedFiles: React.Dispatch<React.SetStateAction<File[]>>
    fileInputRefs: React.MutableRefObject<Record<number, HTMLInputElement>>
    setCheveux: React.Dispatch<React.SetStateAction<string>>
    cheveux: string
    position: string
    setPosition: React.Dispatch<React.SetStateAction<string>>
    filtre: string
    setFiltre: React.Dispatch<React.SetStateAction<string>>
    effet: string
    setEffet: React.Dispatch<React.SetStateAction<string>>
    decorChoice: string
    handleDecorSelect: (value: string) => void
    artisticSubmitting: boolean
    triggerFilePicker: (appId: number) => void
    removeFile: (index: number) => void
}

export function ArtisticFripeGenerator(props: ArtisticFripeProps) {


*/

function AnimatedCell({
    value,
}: {
    value: string | number | null | undefined
}) {
    const changed = useHighlightOnChange(value)

    return (
        <td
            className={`p-2 ${
                changed ? "highlight-change" : ""
            }`}
        >
            {value ?? "-"}
        </td>
    )
}

export default function Table() {
    const { filteredReports, openEditForm, adminView } = useSorters()
    const { profiles } = useProfiles()

    // Map optimisée id → nom (calculée une fois quand profiles change)
    const profilesMap = useMemo(() => {
        const map: Record<string, string> = {}
        for (const p of profiles) {
            map[p.user_id] = p.full_name ?? ""
        }
        return map
    }, [profiles])

    // Fonction stable (ne change jamais tant que profilesMap ne change pas)
    const getUserName = useCallback(
        (id: string) => profilesMap[id] ?? "Inconnu",
        [profilesMap]
    )

    const formatUpdatedAt = (updatedAt: string) => {
        const date = new Date(updatedAt)

        if (date.toString() === "Invalid Date") {
            return "00/00/0000 00:00:00"
        }

        return date.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        })
    }

    return (
        <table className="min-w-full text-sm border-collapse">
            <thead className="bg-muted">
                <tr className="text-left text-muted-foreground">
                    {adminView && <th className="p-2">Trieur</th>}
                    <th className="p-2">Catégorie</th>
                    <th className="p-2">Quantité</th>
                    <th className="p-2">Qualité</th>
                    <th className="p-2">Mag (Kg)</th>
                    <th className="p-2">Mag (Pièce)</th>
                    <th className="p-2">KS Été (Kg)</th>
                    <th className="p-2">KS Été (Pièce)</th>
                    <th className="p-2">KS Hiver (Kg)</th>
                    <th className="p-2">KS Hiver (Pièce)</th>
                    <th className="p-2">SO3 (Kg)</th>
                    <th className="p-2">SO3 (Pièce)</th>
                    <th className="p-2">Export (Kg)</th>
                    <th className="p-2">Export (Pièce)</th>
                    <th className="p-2">Client (Kg)</th>
                    <th className="p-2">Client (Pièce)</th>
                    <th className="p-2">Commentaires</th>
                    {!adminView && <th className="p-2">Actions</th>}
                    {adminView && (
                        <th className="p-2 text-center">
                            Dernière modification
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                {filteredReports.map((r: SortingReport) => (
                    <tr
                        key={r.id}
                        className={`border-b hover:bg-accent/50 transition-colors ${
                            !adminView
                                ? "cursor-pointer hover:bg-primary/50 hover:text-primary-foreground"
                                : ""
                        }`}
                        onClick={() => {
                            if (!adminView) {
                                openEditForm(r)
                            }
                        }}
                    >
                        {adminView && (
                            <td className="p-2 font-medium">
                                {getUserName(r.user_id)}
                            </td>
                        )}
                        <td className="p-2 font-medium">{r.category}</td>
                        <AnimatedCell value={r.quantity} />
                        <AnimatedCell value={r.quality} />
                        <AnimatedCell value={r.mag_kg} />
                        <AnimatedCell value={r.mag_piece} />
                        <AnimatedCell value={r.kssummer_kg} />
                        <AnimatedCell value={r.kssummer_piece} />
                        <AnimatedCell value={r.kswinter_kg} />
                        <AnimatedCell value={r.kswinter_piece} />
                        <AnimatedCell value={r.so3_kg} />
                        <AnimatedCell value={r.so3_piece} />
                        <AnimatedCell value={r.export_kg} />
                        <AnimatedCell value={r.export_piece} />
                        <AnimatedCell value={r.client_kg} />
                        <AnimatedCell value={r.client_piece} />
                        <AnimatedCell value={r.comments} />

                        {!adminView && (
                            <td className="p-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditForm(r)}
                                >
                                    <Pencil className="w-4 h-4" />
                                </Button>
                            </td>
                        )}
                        {adminView && (
                            <td className="p-2 font-medium text-center">
                                {formatUpdatedAt(r.updated_at)}
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
