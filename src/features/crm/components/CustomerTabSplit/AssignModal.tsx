import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/shared/ui/atoms/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Button } from "@/shared/ui/atoms/button"

interface AssignableUser {
    user_id?: string
    id?: string
    uuid?: string
    uid?: string
    name?: string
    full_name?: string
    nom?: string
    email?: string
}

interface AssignOwnerModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (userId: string) => void
    users: AssignableUser[]
    clientName?: string | null
}

export const AssignOwnerModal = ({
    open,
    onOpenChange,
    onConfirm,
    users,
    clientName,
}: AssignOwnerModalProps) => {
    const [selectedUser, setSelectedUser] = useState("")
    const handleConfirm = () => {
        if (selectedUser) onConfirm(selectedUser)
    }
    // Réinitialise la sélection à chaque ouverture/fermeture via le handler
    // (plutôt qu'un setState direct dans un useEffect).
    const handleOpenChange = (next: boolean) => {
        setSelectedUser("")
        onOpenChange(next)
    }
    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Assignation requise</DialogTitle>
                    <DialogDescription>
                        Pour déplacer{" "}
                        <strong>{clientName || "ce client"}</strong>, vous devez
                        sélectionner un responsable.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Responsable
                        </label>
                        <Select
                            value={selectedUser}
                            onValueChange={setSelectedUser}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Sélectionner une personne..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {users && users.length > 0 ? (
                                    users.map((u) => {
                                        const userId =
                                            u.user_id || u.id || u.uuid || u.uid
                                        const userName =
                                            u.name ||
                                            u.full_name ||
                                            u.nom ||
                                            u.email ||
                                            "Utilisateur sans nom"
                                        if (!userId) return null
                                        return (
                                            <SelectItem
                                                key={String(userId)}
                                                value={String(userId)}
                                            >
                                                {userName}
                                            </SelectItem>
                                        )
                                    })
                                ) : (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        Aucun utilisateur trouvé.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!selectedUser}
                        className="bg-primary text-primary-foreground"
                    >
                        Valider
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
