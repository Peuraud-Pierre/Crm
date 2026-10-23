import { useState } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useArrivageManuelContext } from "@/features/stock/hooks/context/StockProvider"
import { COLUMN_DEFS } from "@/features/stock/utils/arrivageExportColumns"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import PrintArrivageDialog from "./PrintArrivageDialog"

export default function PrintArrivageButton() {
    const { rows } = useArrivageManuelContext()
    const { hasPermission } = useAuth()
    const [open, setOpen] = useState(false)

    // Même garde que l'export : ce sont les mêmes données qui sortent de l'app.
    if (!hasPermission(STOCK_PERMISSIONS.arrivageExport)) return null

    const allowedCols = COLUMN_DEFS.filter(col =>
        hasPermission(`stock.arrivage.newsletter.${col.permKey}`)
    )

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setOpen(true)}
                disabled={!rows?.length}
                title="Imprimer le tableau"
            >
                <Printer size={13} aria-hidden />
                Imprimer
            </Button>

            {open && (
                <PrintArrivageDialog
                    open={open}
                    onOpenChange={setOpen}
                    rows={rows ?? []}
                    cols={allowedCols}
                />
            )}
        </>
    )
}
