import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Card } from "@/shared/ui/atoms/card"
import { type Balle } from "@/features/sorters/types/type_gestion"
import { Package2, UserPlus } from "lucide-react"
import { memo, useCallback } from "react"

interface MerchandiseCardProps {
    merchandise: Balle
    assignedPersonName?: string
    onAssignClick: (merchandise: Balle) => void
    onViewReportClick: (merchandise: Balle) => void
}

function MerchandiseCardBase({
    merchandise,
    onAssignClick,
}: MerchandiseCardProps) {
    // 👇 IMPORTANT : handler stable
    const handleClick = useCallback(() => {
        onAssignClick(merchandise)
    }, [onAssignClick, merchandise])

    return (
        <Card
            variant="elevated"
            className="p-6 border-border bg-card animate-in fade-in duration-slow ease-out flex justify-between flex-col gap-8"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary">
                        <Package2 className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-foreground">
                                {merchandise.category}
                            </h3>
                            <Badge variant="secondary" className="mt-1">
                                {merchandise.receiption_date}
                            </Badge>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                            {merchandise.fournisseur?.name}
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-primary">
                        {merchandise.unit === "kilo"
                            ? merchandise.weight
                            : merchandise.piece}
                    </span>

                    <Badge variant="outline" className="text-sm">
                        {merchandise.unit}
                    </Badge>
                </div>

                <Button size="sm" onClick={handleClick} className="bg-primary">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assigner
                </Button>
            </div>
        </Card>
    )
}

export const MerchandiseCard = memo(MerchandiseCardBase)

// Important : pour Debug et DevTools
MerchandiseCard.displayName = "MerchandiseCard"
