import { Button } from "@/shared/ui/atoms/button"

interface Props {
    onClick: () => void
    disabled: boolean
}

export function SubmitButton({ onClick, disabled }: Props) {
    return (
        <Button onClick={onClick} disabled={disabled} className="w-full mb-6">
            Générer l'image légendée
        </Button>
    )
}
