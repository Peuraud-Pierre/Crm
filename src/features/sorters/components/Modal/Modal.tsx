import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { useSorters } from "@/features/sorters/context/SortersProvider"
import { useEffect } from "react"

import { type SortingReport } from "../struct"
import { CategoryField } from "./fields/CategoryField"
import { CommentsField } from "./fields/CommentsField"
import { NumbersFields } from "./fields/NumbersFields"
import { QualityField } from "./fields/QualityField"

export default function Modal() {
    const {
        openForm,
        setOpenForm,
        editing,
        form,
        setForm,
        saving,
        handleSave,
    } = useSorters()

    if (form == null) {
        return
    }

    if (setForm == null) {
        return
    }

    useEffect(() => {
        const total =
            Number(form.mag_kg || 0) +
            Number(form.kssummer_kg || 0) +
            Number(form.kswinter_kg || 0) +
            Number(form.so3_kg || 0) +
            Number(form.client_kg || 0) +
            Number(form.export_kg || 0)

        setForm((prev) => ({ ...(prev as SortingReport), quantity: total }))
    }, [
        form.mag_kg,
        form.kssummer_kg,
        form.kswinter_kg,
        form.so3_kg,
        form.client_kg,
        form.export_kg,
    ])

    return (
        <Dialog open={openForm} onOpenChange={setOpenForm}>
            <DialogContent
                className="w-[95vw] max-w-lg sm:max-w-xl md:max-w-2xl p-6 w-[95vw] max-w-4xl p-6 
               max-h-[90vh] overflow-y-auto"
            >
                <DialogHeader>
                    <DialogTitle>
                        {editing ? "Modifier un rapport" : "Nouveau rapport"}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <CategoryField form={form} />
                    {/* <SupplierField form={form} /> */}
                    <NumbersFields form={form} setForm={setForm} />

                    <CommentsField form={form} setForm={setForm} />
                </div>

                <DialogFooter className="!justify-center">
                    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                        <QualityField form={form} setForm={setForm} />

                        <Button
                            variant="outline"
                            onClick={() => setOpenForm(false)}
                        >
                            Annuler
                        </Button>

                        <Button
                            onClick={() => handleSave(form?.id as string)}
                            loading={saving}
                        >
                            {saving ? null : "Mettre à jour"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
