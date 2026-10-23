import { Button } from "@/shared/ui/atoms/button"

interface Props {
    onClick: () => void
    disabled: boolean
}

export function SubmitButton({ onClick, disabled }: Props) {
    return (
        <Button onClick={onClick} disabled={disabled} className="w-full">
            {disabled ? "Processing..." : "Generate Artistic Retouch"}
        </Button>
    )
}
