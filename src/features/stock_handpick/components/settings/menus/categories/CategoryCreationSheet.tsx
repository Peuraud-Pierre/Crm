import { useState } from "react"
import { Tags } from "lucide-react"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { FormSheet } from "@/shared/ui/organisms/form-sheet"
import type { CategoryWritable } from "@/features/stock_handpick/services/categorieHandpickService"

interface CategoryCreationSheetProps {
    open: boolean
    onClose: () => void
    /**
     * La catégorie créée, ou `null` en échec (déjà signalé). La sheet ne se
     * referme que sur un succès : un nom refusé ne doit pas vider la saisie.
     */
    onCreate: (payload: CategoryWritable) => Promise<unknown>
}

export function CategoryCreationSheet({
    open,
    onClose,
    onCreate,
}: CategoryCreationSheetProps) {
    const [name, setName] = useState("")
    const [tag, setTag] = useState("")
    const [loading, setLoading] = useState(false)

    const reset = () => {
        setName("")
        setTag("")
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const handleCreate = async () => {
        if (!name.trim()) return
        setLoading(true)
        try {
            const created = await onCreate({
                name: name.trim(),
                tag: tag.trim() || null,
                is_active: true,
            })
            if (created) handleClose()
        } finally {
            setLoading(false)
        }
    }

    return (
        <FormSheet
            open={open}
            onClose={handleClose}
            icon={Tags}
            title="Nouvelle catégorie"
            size="md"
            onSubmit={handleCreate}
            submitLabel="Créer"
            submitDisabled={!name.trim()}
            loading={loading}
        >
            <div className="flex flex-col gap-2">
                <Label htmlFor="hp-cat-name" className="text-sm font-semibold">
                    Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="hp-cat-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex : Vêtements homme"
                    className="h-10"
                    autoFocus
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="hp-cat-tag" className="text-sm font-semibold">
                    Tag
                </Label>
                <Input
                    id="hp-cat-tag"
                    value={tag}
                    onChange={(event) => setTag(event.target.value)}
                    placeholder="Ex : VET"
                    className="h-10 font-mono"
                />
            </div>
        </FormSheet>
    )
}
