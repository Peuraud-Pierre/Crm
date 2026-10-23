import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"

import { useMemo, useState } from "react"
import { useProfilesCtx } from "@/shared/context/ProfilesProvider"
import { useSellJournalContext } from "@/features/sell-journal/context/SellJournalContext"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Plus } from "lucide-react"

export function EntryForm() {
    const today = new Date().toISOString().slice(0, 10)

    const { profiles } = useProfilesCtx()
    const { createEntry } = useSellJournalContext()

    const [isSubmitting, setIsSubmitting] = useState(false)

    const [form, setForm] = useState({
        date: today,
        service: "",
        commercial: "",
        ca: "",
    })

    const commercialUsers = useMemo(
        () =>
            profiles?.filter((p) => p.service?.nom === "Commercial") ?? [],
        [profiles]
    )

    const handleChange = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (isSubmitting) return
        setIsSubmitting(true)

        try {
            await createEntry(
                form.date.slice(0, 10),
                form.service,
                form.commercial,
                form.ca
            )
            setForm({
                date: today,
                service: "",
                commercial: "",
                ca: "",
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="rounded-xl border border-white/10 bg-card-300 p-5 shadow-lg">
            <h3 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground">
                Nouvelle entrée
            </h3>

            <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 gap-4 md:grid-cols-5"
            >
                {/* DATE */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        Date
                    </label>
                    <Input
                        type="date"
                        value={form.date}
                        onChange={(e) =>
                            handleChange("date", e.target.value)
                        }
                        className="h-11 rounded-lg bg-background/50"
                    />
                </div>

                {/* SERVICE */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        Service
                    </label>
                    <Select
                        value={form.service}
                        onValueChange={(value) =>
                            handleChange("service", value)
                        }
                    >
                        <SelectTrigger className="h-11 rounded-lg bg-background/50">
                            <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Handpick">
                                Handpick
                            </SelectItem>
                            <SelectItem value="Grossiste">
                                Grossiste
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* COMMERCIAL */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        Commercial
                    </label>
                    <Select
                        value={form.commercial}
                        onValueChange={(value) =>
                            handleChange("commercial", value)
                        }
                    >
                        <SelectTrigger className="h-11 rounded-lg bg-background/50">
                            <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                            {commercialUsers.map((u) => (
                                <SelectItem
                                    key={u.user_id}
                                    value={u.full_name}
                                >
                                    {u.full_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* CA */}
                <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                        Chiffre d&apos;affaires (€)
                    </label>
                    <Input
                        type="number"
                        placeholder="Montant"
                        value={form.ca}
                        onChange={(e) => handleChange("ca", e.target.value)}
                        className="h-11 rounded-lg bg-background/50"
                    />
                </div>

                {/* ACTION */}
                <div className="flex items-end">
                    <Button
                        type="submit"
                        disabled={
                            isSubmitting ||
                            !form.date ||
                            !form.service ||
                            !form.commercial ||
                            !form.ca
                        }
                        className="h-11 w-full rounded-lg bg-success font-medium text-success-foreground hover:bg-success/90 disabled:opacity-40"
                    >
                        <Plus className="mr-2" />
                        Ajouter
                    </Button>
                </div>
            </form>
        </div>
    )
}
