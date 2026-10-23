import { Lock, ScanLine, Warehouse } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { COMMANDES_PERMISSIONS } from "@/features/commandes/constants"
import type { CommandeEspace } from "@/features/commandes/types/commande.types"

const ESPACES = [
    { id: "entrepot", label: "Entrepôt", detail: "préparer, expédier", icon: Warehouse },
    { id: "boutique", label: "Boutique", detail: "réceptionner au scan", icon: ScanLine },
] as const

interface EspaceSwitchProps {
    value: CommandeEspace
    /** Espaces ouverts à l'utilisateur ; les autres restent visibles, verrouillés. */
    accessibles: readonly CommandeEspace[]
    onChange: (espace: CommandeEspace) => void
}

/**
 * Bascule entre les deux espaces de la page. Les DEUX restent affichés,
 * même sans droit sur l'un : un espace verrouillé dit où se trouve la
 * fonction (le scan des cartons, côté boutique) et quel droit l'ouvre,
 * plutôt que de disparaître sans laisser de trace.
 */
export function EspaceSwitch({ value, accessibles, onChange }: EspaceSwitchProps) {
    return (
        <div className="flex w-full rounded-xl border border-border bg-muted/50 p-1 sm:w-auto" role="radiogroup" aria-label="Espace">
            {ESPACES.map(({ id, label, detail, icon: Icon }) => {
                const ouvert = accessibles.includes(id)
                const actif = value === id
                return (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={actif}
                        aria-disabled={!ouvert}
                        title={ouvert ? undefined : `Nécessite la permission ${COMMANDES_PERMISSIONS.boutique}`}
                        onClick={() => {
                            if (ouvert) onChange(id)
                            else toast.info("Espace boutique verrouillé", {
                                description: `Le scan des cartons à la réception se fait ici. Demandez la permission « ${COMMANDES_PERMISSIONS.boutique} » dans Administration.`,
                            })
                        }}
                        className={cn(
                            "flex min-h-11 flex-1 items-center gap-2 rounded-lg px-3 text-left transition-colors sm:flex-none",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            actif ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                            !ouvert && "opacity-60",
                        )}
                    >
                        {ouvert ? <Icon size={16} className={cn(actif && "text-primary")} /> : <Lock size={14} />}
                        <span className="flex flex-col leading-tight">
                            <span className="text-sm font-semibold">{label}</span>
                            <span className="text-xs font-normal">{detail}</span>
                        </span>
                    </button>
                )
            })}
        </div>
    )
}
