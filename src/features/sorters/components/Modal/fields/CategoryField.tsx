import { Label } from "@/shared/ui/atoms/label"
import { type SortingReport } from "../../struct"

export function CategoryField({ form }: { form: SortingReport }) {
    return (
        <div className="gap-2 flex flex-col items-center text-neutral-600 border border-primary p-2 rounded-lg">
            <Label className="font-semibold text-xl ">
                Catégorie de la balle
            </Label>
            <Label className="text-left text-xl">{form.category}</Label>
        </div>
    )
}
