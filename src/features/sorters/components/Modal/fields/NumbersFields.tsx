import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { type SortingReport } from "../../struct"

import { type Dispatch, type SetStateAction } from "react"
import { Shirt, Weight } from "lucide-react"

export function NumbersFields({
    form,
    setForm,
}: {
    form: SortingReport
    setForm: Dispatch<SetStateAction<SortingReport | null>>
}) {
    const fields = [
        { key: "mag", label: "MAG" },
        { key: "kswinter", label: "KS Hiver" },
        { key: "kssummer", label: "KS Été" },
        { key: "so3", label: "SO3" },
        { key: "export", label: "Export" },
        { key: "client", label: "Client" },
    ]

    const updateField = (fieldKey: string, rawValue: string, isKg = false) => {
        const value =
            rawValue === "" || rawValue === null
                ? null
                : isKg
                ? parseFloat(rawValue)
                : parseInt(rawValue)

        setForm((prev: SortingReport | null) => {
            if (!prev) return null
            return {
                ...prev,
                [fieldKey as keyof SortingReport]: value,
            }
        })
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 px-3 text-sm font-medium text-neutral-600">
                <div className="text-left">Catégorie</div>
                <div className="text-center">Pièces</div>
                <div className="text-center">Kg</div>
            </div>

            {fields.map(({ key, label }) => {
                const pieceKey = key + "_piece"
                const kgKey = key + "_kg"

                return (
                    <div
                        key={key}
                        className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 p-3 rounded-lg bg-primary border border-neutral-800"
                    >
                        {/* Label */}
                        <Label className="text-neutral-200 hover:text-neutral-100 text-left">
                            {label}
                        </Label>

                        {/* Pièces */}
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min="0"
                                placeholder="0 Pièce"
                                className="text-center border border-neutral-800 rounded-lg"
                                value={
                                    form[pieceKey as keyof SortingReport] ==
                                    null
                                        ? ""
                                        : String(
                                              form[
                                                  pieceKey as keyof SortingReport
                                              ]
                                          )
                                }
                                onChange={(e) => {
                                    const v = e.target.value
                                    updateField(pieceKey, v, false)
                                }}
                            />
                            <Shirt className="w-8 h-8" />
                        </div>

                        {/* Kg */}
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0 Kg"
                                className="text-center border border-neutral-800 rounded-lg"
                                value={
                                    form[kgKey as keyof SortingReport] == null
                                        ? ""
                                        : String(
                                              form[kgKey as keyof SortingReport]
                                          )
                                }
                                onChange={(e) => {
                                    const v = e.target.value
                                    updateField(kgKey, v, true)
                                }}
                            />
                            <Weight className="w-8 h-8" />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
