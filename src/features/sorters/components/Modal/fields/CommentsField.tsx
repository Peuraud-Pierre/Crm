import { Textarea } from "@/shared/ui/atoms/textarea"
import { type SortingReport } from "../../struct"
import { type Dispatch, type SetStateAction } from "react"

export function CommentsField({
    form,
    setForm,
}: {
    form: SortingReport
    setForm: Dispatch<SetStateAction<SortingReport | null>>
}) {
    return (
        <div className="space-y-1">
            <Textarea
                value={form.comments || ""}
                className="w-full h-24 border border-primary rounded-lg p-2 "
                placeholder="Ajouter des commentaires..."
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
            />
        </div>
    )
}
