import { type Dispatch, type SetStateAction } from "react"
import { Label } from "@/shared/ui/atoms/label"
import { Star } from "lucide-react"
import { type SortingReport } from "../../struct"

export function QualityField({
    form,
    setForm,
}: {
    form: SortingReport
    setForm?: Dispatch<SetStateAction<SortingReport | null>>
}) {
    return (
        <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">Qualité:</Label>

            <div className="flex items-center gap-1">
                {[1, 2, 3].map((star) => (
                    <Star
                        key={star}
                        onClick={() => {
                            if (setForm) {
                                setForm((prev) => {
                                    if (!prev) return null
                                    return { ...prev, quality: star }
                                })
                            }
                        }}
                        className={`w-6 h-6 cursor-pointer transition ${
                            form.quality >= star
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground hover:text-yellow-400"
                        }`}
                    />
                ))}
            </div>
        </div>
    )
}
