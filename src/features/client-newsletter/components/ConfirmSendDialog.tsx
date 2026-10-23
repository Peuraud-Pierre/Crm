import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"

interface ConfirmSendDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    recipientCount: number
    subject: string
    onConfirm: () => void
}

export function ConfirmSendDialog({
    open,
    onOpenChange,
    recipientCount,
    subject,
    onConfirm,
}: ConfirmSendDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Envoyer la newsletter ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        « {subject} » va être envoyé à{" "}
                        <strong>
                            {recipientCount} client{recipientCount > 1 ? "s" : ""}
                        </strong>
                        . Cette action est irréversible.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>Envoyer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
