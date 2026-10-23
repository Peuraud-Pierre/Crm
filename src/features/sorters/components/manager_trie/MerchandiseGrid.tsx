import { type Profile } from "@/shared/context/ProfilesProvider"
import { type Balle } from "@/features/sorters/types/type_gestion"
import { memo, useCallback, useState } from "react"

import { AssignDialog } from "./AssignDialog"
import { MerchandiseCard } from "./MerchandiseCard"
import Modal from "./Modal"

interface MerchandiseGridProps {
    merchandises: Balle[]
    people: Profile[]
    onAssign: (balle: Balle, personId: string) => void
}

export const MerchandiseGrid = memo(
    ({ merchandises, people, onAssign }: MerchandiseGridProps) => {
        const [dialogOpen, setDialogOpen] = useState(false)
        const [selectedMerchandise, setSelectedMerchandise] = useState<Balle>()
        const [viewReportOpen, setViewReportOpen] = useState(false)

        // 🚀 Callback stable
        const handleAssignClick = useCallback((merchandise: Balle) => {
            setSelectedMerchandise(merchandise)
            setDialogOpen(true)
        }, [])

        if (merchandises.length === 0) {
            return (
                <div className="text-center py-12 text-muted-foreground">
                    <p className="text-lg">Aucune marchandise trouvée</p>
                </div>
            )
        }

        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {merchandises.map((merchandise, index) => {
                        return (
                            <div
                                key={merchandise.id}
                                style={{
                                    animationDelay: `${index * 0.03}s`,
                                }}
                            >
                                <MerchandiseCard
                                    merchandise={merchandise}
                                    assignedPersonName={
                                        merchandise.assigned_to?.full_name ??
                                        undefined
                                    }
                                    onAssignClick={handleAssignClick}
                                    onViewReportClick={() => {
                                        setSelectedMerchandise(merchandise)
                                        setViewReportOpen(true)
                                    }}
                                />
                            </div>
                        )
                    })}
                </div>

                {selectedMerchandise && (
                    <AssignDialog
                        open={dialogOpen}
                        onOpenChange={setDialogOpen}
                        merchandiseName={selectedMerchandise}
                        people={people}
                        onAssign={onAssign}
                    />
                )}
                <Modal
                    open={viewReportOpen}
                    balle={selectedMerchandise ?? null}
                    onOpenChange={setViewReportOpen}
                />
            </>
        )
    }
)

// 🔥 Empêche le re-render si merchandises et people n’ont pas changé
MerchandiseGrid.displayName = "MerchandiseGrid"
