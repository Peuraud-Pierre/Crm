import { Camera, FolderPlus, Plus, Trash2 } from "lucide-react"
import { useRef } from "react"

import { Button } from "@/shared/ui/atoms/button"

/**
 * Barre d'actions du Drive : ajout de fichiers, capture photo, création de
 * dossier, accès à la corbeille. Les deux `input[type=file]` restent ici,
 * pilotés par les boutons qui leur correspondent.
 */
export default function DriveActions({
    uploading,
    onUpload,
    onNewFolder,
    onOpenTrash,
}: {
    uploading: boolean
    onUpload: (files: FileList) => void
    onNewFolder: () => void
    onOpenTrash: () => void
}) {
    const fileRef = useRef<HTMLInputElement>(null)
    const cameraRef = useRef<HTMLInputElement>(null)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files?.length) onUpload(files)
        // Réinitialisé pour que le même fichier puisse être renvoyé ensuite.
        e.target.value = ""
    }

    return (
        <div className="mb-4 flex flex-col flex-wrap gap-2 sm:flex-row">
            <Button
                onClick={() => fileRef.current?.click()}
                className="w-full gap-2 sm:w-auto"
                disabled={uploading}
            >
                {uploading ? (
                    "Envoi en cours…"
                ) : (
                    <>
                        <Plus className="h-4 w-4" /> Ajouter des fichiers
                    </>
                )}
            </Button>

            <Button
                onClick={() => cameraRef.current?.click()}
                className="w-full gap-2 sm:w-auto"
                disabled={uploading}
            >
                <Camera className="h-4 w-4" /> Prendre une photo
            </Button>

            <Button
                variant="outline"
                onClick={onNewFolder}
                className="w-full gap-2 sm:w-auto"
                disabled={uploading}
            >
                <FolderPlus className="h-4 w-4" /> Nouveau dossier
            </Button>

            <Button
                variant="outline"
                onClick={onOpenTrash}
                className="w-full gap-2 sm:ml-auto sm:w-auto"
            >
                <Trash2 className="h-4 w-4" /> Corbeille
            </Button>

            {/* Aucun attribut accept : le Drive prend tout type. */}
            <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={handleChange}
            />
            {/* La capture reste bornée aux médias : c'est l'appareil photo. */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*,video/mp4"
                capture="environment"
                hidden
                onChange={handleChange}
            />
        </div>
    )
}
