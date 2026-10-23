import { useMemo, useState } from "react"
import { Users, RefreshCw } from "lucide-react"
import { Card } from "@/shared/ui/atoms/card"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { toast } from "sonner"
import { getAccessToken } from "../../services/calendarSessionService"
import { ameliaAvailabilityService } from "../services/AmeliaAvailabilityService"
import { useAmeliaProviders } from "../hooks/useAmeliaProviders"
import { AvailabilityEditor } from "./AvailabilityEditor"

/**
 * Vue manager : choisir un commercial puis éditer SA disponibilité.
 * L'autorisation réelle est appliquée par le bridge (403 si l'appelant n'est
 * pas manager) ; ce composant n'est rendu que dans l'onglet réservé aux managers.
 */
export function ManagerAvailability() {
    const { providers, loading, error } = useAmeliaProviders()
    const [selected, setSelected] = useState<string>("")
    const [resyncing, setResyncing] = useState(false)

    const handleResyncAll = async () => {
        try {
            setResyncing(true)
            const jwt = await getAccessToken()
            if (!jwt) {
                toast.error("Session expirée", { description: "Reconnecte-toi." })
                return
            }
            const res = await ameliaAvailabilityService.resyncAllAvailability(jwt)
            toast.success("Resynchronisation terminée", { description: `${res.pushed} commercial(aux) resynchronisé(s), ${res.skipped} sans dispo, ${res.failed} échec(s).` })
        } catch (err: unknown) {
            toast.error("Échec de la resynchronisation", { description: err instanceof Error ? err.message : "Erreur inconnue." })
        } finally {
            setResyncing(false)
        }
    }

    // Seuls les commerciaux mappés à un user Supabase sont éditables ici.
    const editable = useMemo(
        () => providers.filter((p) => Boolean(p.supabase_user_id)),
        [providers]
    )

    const labelOf = (p: (typeof editable)[number]) =>
        `${p.first_name} ${p.last_name}`.trim() || p.email

    const current = editable.find((p) => p.supabase_user_id === selected)

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap animate-in fade-in slide-in-from-top-1 duration-slow">
                <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-primary" /> Commercial
                </span>
                <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger className="w-full sm:w-[280px] h-9">
                        <SelectValue
                            placeholder={
                                loading
                                    ? "Chargement…"
                                    : "Choisir un commercial"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        {editable.map((p) => (
                            <SelectItem
                                key={p.supabase_user_id}
                                value={p.supabase_user_id as string}
                            >
                                {labelOf(p)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResyncAll}
                    loading={resyncing}
                    className="gap-2 sm:ml-auto"
                    title="Ré-applique la disponibilité individuelle de tous les commerciaux vers Amelia"
                >
                    {!resyncing && <RefreshCw className="h-4 w-4" />}
                    Resynchroniser tout
                </Button>
            </div>

            {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-slow">
                    {error}
                </p>
            )}

            {!loading && editable.length === 0 && (
                <Card className="p-6 text-sm text-muted-foreground italic animate-in fade-in duration-slow">
                    Aucun commercial mappé à un compte. Vérifiez la
                    synchronisation des providers Amelia.
                </Card>
            )}

            {selected && current ? (
                <AvailabilityEditor
                    key={selected}
                    userId={selected}
                    title={`Disponibilité de ${labelOf(current)}`}
                />
            ) : (
                editable.length > 0 && (
                    <Card className="p-6 text-sm text-muted-foreground italic animate-in fade-in duration-slow">
                        Sélectionnez un commercial pour gérer sa disponibilité.
                    </Card>
                )
            )}
        </div>
    )
}
