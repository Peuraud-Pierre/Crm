import { Button } from "@/shared/ui/atoms/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/ui/atoms/dialog"
import { Label } from "@/shared/ui/atoms/label"
import { RadioGroup, RadioGroupItem } from "@/shared/ui/atoms/radio-group"
import { type Profile } from "@/shared/context/ProfilesProvider"
import { type Balle } from "@/features/sorters/types/type_gestion"
import { UserCheck } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

interface AssignDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    merchandiseName: Balle | null
    people: Profile[]
    onAssign: (balle: Balle, personId: string) => void
}

export const AssignDialog = ({
    open,
    onOpenChange,
    merchandiseName,
    people,
    onAssign,
}: AssignDialogProps) => {
    const [selectedPerson, setSelectedPerson] = useState<string>("")

    // 🔥 tri pour lisibilité + useMemo pour éviter un tri à chaque render
    const sortedPeople = useMemo(() => {
        return [...people].sort((a, b) =>
            a.full_name.localeCompare(b.full_name)
        )
    }, [people])

    // 🔥 safe display : si pas de marchandise chargée on évite l’erreur
    const title = merchandiseName
        ? `${merchandiseName.fournisseur?.name || "??"} / ${
              merchandiseName.category || ""
          }`
        : ""

    // 🔥 callback mémoisé, n'est plus recréé inutilement
    const handleAssign = useCallback(() => {
        if (!selectedPerson) return
        if (!merchandiseName) return

        onAssign(merchandiseName, selectedPerson)
        setSelectedPerson("")
        onOpenChange(false)
    }, [selectedPerson, onAssign, onOpenChange])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-primary" />
                        Assigner {title}
                    </DialogTitle>
                    <DialogDescription>
                        Sélectionnez une personne à qui assigner cette
                        marchandise.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <RadioGroup
                        value={selectedPerson}
                        onValueChange={setSelectedPerson}
                    >
                        {sortedPeople.map((person) => {
                            const key = person.id || person.user_id
                            return (
                                <div
                                    key={key}
                                    className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-accent transition-colors"
                                >
                                    <RadioGroupItem value={key} id={key} />
                                    <Label
                                        htmlFor={key}
                                        className="flex-1 cursor-pointer font-medium"
                                    >
                                        {person.full_name}
                                    </Label>
                                </div>
                            )
                        })}
                    </RadioGroup>
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Annuler
                    </Button>

                    <Button
                        onClick={handleAssign}
                        disabled={!selectedPerson}
                        className="bg-primary"
                    >
                        Assigner
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
