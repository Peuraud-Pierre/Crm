import { useRef } from "react"
import { Camera } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { Button } from "@/shared/ui/atoms/button"
import { resolveAvatarUrl } from "@/shared/lib/avatar"

interface AvatarUploaderProps {
    avatarUrl?: string | null
    fullName?: string
    uploading: boolean
    onSelect: (file: File) => void
}

/** Initiales affichées tant qu'aucune photo n'est définie. */
function initials(fullName?: string): string {
    const letters = (fullName ?? "")
        .split(" ")
        .map((part) => part[0] ?? "")
        .join("")
    return letters || "?"
}

export function AvatarUploader({
    avatarUrl,
    fullName,
    uploading,
    onSelect,
}: AvatarUploaderProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    return (
        <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-border">
                <AvatarImage src={resolveAvatarUrl(avatarUrl)} />
                <AvatarFallback className="text-lg">
                    {initials(fullName)}
                </AvatarFallback>
            </Avatar>

            <div className="space-y-2">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Nouvelle photo de profil"
                    onChange={(event) => {
                        const [file] = Array.from(event.target.files ?? [])
                        // Réinitialisé pour permettre de resélectionner le
                        // même fichier après un échec.
                        event.target.value = ""
                        if (file) onSelect(file)
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => inputRef.current?.click()}
                >
                    <Camera className="mr-2 h-4 w-4" />
                    {uploading ? "Téléversement…" : "Changer la photo"}
                </Button>
                <p className="text-xs text-muted-foreground">
                    JPG ou PNG, visible par vos collègues.
                </p>
            </div>
        </div>
    )
}
