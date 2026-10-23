import { Button } from "@/shared/ui/atoms/button"

export function SubmitButton({
    onClick,
    disabled,
}: {
    onClick: () => Promise<void>
    disabled: boolean
}) {
    return (
        <Button onClick={onClick} disabled={disabled} className="w-full">
            {disabled ? "Retouche en cours..." : "Envoyer"}
        </Button>
    )
}
