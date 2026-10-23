import { Button } from "@/shared/ui/atoms/button"

interface Props {
    onClick: () => void
    disabled: boolean
}

export function SubmitButton({ onClick, disabled }: Props) {
    return (
        <Button
            onClick={onClick}
            disabled={disabled}
            className="w-full bg-primary hover:bg-primary/90"
        >
            {disabled ? "Processing cutout..." : "Start Cutout"}
        </Button>
    )
}
