import { MapPin, User, UserCheck, AlertCircle } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Separator } from "@/shared/ui/atoms/separator"
import { cn } from "@/shared/lib/utils"
import type { Client, Search } from "@/features/crm/hooks/CRM_hook/use_client"
import type {
    CreateEventLogic,
    EventTypeDef,
} from "@/features/crm/types/calendar"

interface EventFormPanelProps {
    logic: CreateEventLogic
    EVENT_TYPES: EventTypeDef[]
    TIME_SLOTS: string[]
}

export function EventFormPanel({
    logic,
    EVENT_TYPES,
    TIME_SLOTS,
}: EventFormPanelProps) {
    return (
        <div className="flex-1 min-h-0 p-6 space-y-5 overflow-y-auto border-b lg:border-b-0 lg:border-r border-border custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                        Nature
                    </Label>
                    <Select
                        value={logic.formData.nom}
                        onValueChange={(v) =>
                            logic.setFormData((p) => ({
                                ...p,
                                nom: v,
                            }))
                        }
                    >
                        <SelectTrigger className="h-10 bg-muted border-none shadow-inner text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {EVENT_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={cn(
                                                "w-2.5 h-2.5 rounded-full",
                                                t.color
                                            )}
                                        />
                                        {t.label}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                        Commercial
                    </Label>
                    <Select
                        value={logic.formData.owner}
                        onValueChange={(v) =>
                            logic.setFormData((p) => ({
                                ...p,
                                owner: v,
                            }))
                        }
                    >
                        <SelectTrigger className="h-10 bg-muted border-none shadow-inner text-sm">
                            <div className="flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-primary" />
                                <SelectValue placeholder="Sélectionner" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {logic.search?.map((u: Search) => (
                                <SelectItem key={u.user_id} value={u.user_id}>
                                    {u.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                    Date & Heure
                </Label>
                <div
                    className={cn(
                        "flex items-center gap-3 p-2.5 rounded-2xl bg-muted border-2 border-transparent",
                        logic.ferieError
                            ? "border-destructive bg-destructive/10"
                            : logic.isBusy && "border-warning bg-warning/10"
                    )}
                >
                    <Input
                        type="date"
                        className="border-none bg-transparent text-sm w-36"
                        value={logic.formData.dateOnly}
                        onChange={(e) =>
                            logic.setFormData((p) => ({
                                ...p,
                                dateOnly: e.target.value,
                            }))
                        }
                    />
                    <Separator orientation="vertical" className="h-6" />
                    <div className="flex items-center gap-1.5 flex-1 justify-center">
                        <Select
                            value={logic.formData.timeStart}
                            onValueChange={(v) =>
                                logic.setFormData((p) => ({
                                    ...p,
                                    timeStart: v,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-24 border-none font-bold text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="h-56">
                                {TIME_SLOTS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">→</span>
                        <Select
                            value={logic.formData.timeEnd}
                            onValueChange={(v) =>
                                logic.setFormData((p) => ({
                                    ...p,
                                    timeEnd: v,
                                }))
                            }
                        >
                            <SelectTrigger className="h-9 w-24 border-none font-bold text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="h-56">
                                {TIME_SLOTS.map((t) => (
                                    <SelectItem key={t} value={t}>
                                        {t}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {logic.isBusy && (
                        // Avertissement seulement : deux RDV peuvent se
                        // chevaucher, l'enregistrement reste possible.
                        <div
                            className="flex items-center gap-1.5 text-warning font-bold text-sm"
                            title={logic.busyConflictLabel ?? undefined}
                        >
                            <AlertCircle className="w-4 h-4" /> Déjà un RDV sur ce créneau
                            {logic.busyConflictLabel && (
                                <span className="font-normal truncate max-w-xs">
                                    · {logic.busyConflictLabel}
                                </span>
                            )}
                        </div>
                    )}
                    {logic.ferieError && (
                        <div className="flex items-center gap-1.5 text-destructive font-bold text-sm animate-bounce">
                            <AlertCircle className="w-4 h-4" /> {logic.ferieError}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="space-y-2 relative z-50">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                        Client
                    </Label>
                    <div className="relative">
                        <User className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input
                            className="pl-10 bg-muted border-none h-11 text-sm shadow-inner"
                            value={logic.formData.participants}
                            onChange={(e) =>
                                logic.setFormData((p) => ({
                                    ...p,
                                    participants: e.target.value,
                                }))
                            }
                            onFocus={() => logic.setIsFocused(true)}
                            onBlur={() =>
                                setTimeout(() => logic.setIsFocused(false), 200)
                            }
                            placeholder="Rechercher un client..."
                        />
                    </div>
                    {logic.isFocused && logic.formData.participants && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-40 overflow-y-auto z-50">
                            {logic.filteredClients.map((c: Client) => (
                                <div
                                    key={c.id}
                                    className="px-3 py-2 hover:bg-muted cursor-pointer flex flex-col"
                                    onClick={() => {
                                        logic.setFormData((p) => ({
                                            ...p,
                                            participants: c.nom || "",
                                            participantsID: c.id || "",
                                            mail: [c.mail, c.mail_2].filter(
                                                Boolean
                                            ) as string[],
                                        }))
                                        logic.setIsFocused(false)
                                    }}
                                >
                                    <span className="font-bold text-sm">
                                        {c.nom}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {c.mail}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                        Lieu
                    </Label>
                    <div className="relative">
                        <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-muted-foreground" />
                        <Input
                            className="pl-10 bg-muted border-none h-11 text-sm shadow-inner"
                            value={logic.formData.lieu}
                            onChange={(e) =>
                                logic.setFormData((p) => ({
                                    ...p,
                                    lieu: e.target.value,
                                }))
                            }
                            placeholder="Adresse ou lien visio"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">
                        Notes
                    </Label>
                    <Textarea
                        // 1. On remplace "overflow-hidden" par "overflow-y-auto"
                        // 2. On ajoute "max-h-[250px]" (tu peux ajuster la valeur selon tes besoins)
                        className="min-h-[80px] max-h-[250px] resize-none overflow-y-auto bg-muted border-none shadow-inner text-sm p-3"
                        value={logic.formData.description}
                        onChange={(e) => {
                            // Ajustement automatique de la hauteur
                            const target = e.target as HTMLTextAreaElement
                            target.style.height = "auto"
                            target.style.height = `${target.scrollHeight}px`

                            // Mise à jour du state
                            logic.setFormData((p) => ({
                                ...p,
                                description: e.target.value,
                            }))
                        }}
                        placeholder="Détails..."
                    />
                </div>
            </div>
        </div>
    )
}
