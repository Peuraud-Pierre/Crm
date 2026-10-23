import { UserCheck } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Textarea } from "@/shared/ui/atoms/textarea"
import type { Search } from "@/features/crm/types/user"
import { withStartDate, type RdvState } from "@/features/crm/utils/eventForm"
import { EVENT_TYPES } from "@/features/crm/utils/eventTypes"

interface RdvFieldsProps {
    rdv: RdvState
    onChange: (next: RdvState) => void
    users: Search[] | undefined
    currentUserId: string | undefined
}

/**
 * Champs d'un RDV de la modale « Nouvelle interaction » : type, commercial,
 * début, fin, notes. Rendu une fois par RDV planifié (jusqu'à deux).
 */
export function RdvFields({ rdv, onChange, users, currentUserId }: RdvFieldsProps) {
    const set = (patch: Partial<RdvState>) => onChange({ ...rdv, ...patch })

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={rdv.type} onValueChange={(type) => set({ type })}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir..." />
                    </SelectTrigger>
                    <SelectContent>
                        {EVENT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                                {t.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Attribuer à
                </Label>
                <Select value={rdv.owner} onValueChange={(owner) => set({ owner })}>
                    <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Sélectionner un commercial" />
                    </SelectTrigger>
                    <SelectContent>
                        {users?.map((u) => (
                            <SelectItem key={u.user_id} value={u.user_id}>
                                {u.name}
                                {u.user_id === currentUserId && " (moi)"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-xs">Début</Label>
                    <Input
                        type="date"
                        className="h-8 text-xs"
                        value={rdv.startDate}
                        onChange={(e) => onChange(withStartDate(rdv, e.target.value))}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Heure</Label>
                    <Input
                        type="time"
                        className="h-8 text-xs"
                        value={rdv.startTime}
                        onChange={(e) => set({ startTime: e.target.value })}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label className="text-xs">Fin</Label>
                    <Input
                        type="date"
                        className="h-8 text-xs"
                        value={rdv.endDate}
                        onChange={(e) => set({ endDate: e.target.value })}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">Heure</Label>
                    <Input
                        type="time"
                        className="h-8 text-xs"
                        value={rdv.endTime}
                        onChange={(e) => set({ endTime: e.target.value })}
                    />
                </div>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Notes RDV</Label>
                <Textarea
                    value={rdv.description}
                    onChange={(e) => set({ description: e.target.value })}
                    className="h-24 bg-background"
                    placeholder="Sujet, lieu..."
                />
            </div>
        </div>
    )
}
