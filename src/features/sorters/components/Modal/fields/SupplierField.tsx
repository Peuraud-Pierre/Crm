import { Label } from "@/shared/ui/atoms/label"

export function SupplierField({ form }: { form: { name?: string | null } }) {
    return (
        <div className="gap-2">
            <Label>Fournisseur</Label>
            <Label>{form.name}</Label>
        </div>
    )
}
