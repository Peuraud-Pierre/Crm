// ── mediaUpload.ts ─────────────────────────────────────────────────────────────
// RÔLE : logique commune aux champs média (image, icône) de ThematiqueFormDialog.tsx :
// vérification de taille, validation de contenu optionnelle, transformation
// optionnelle (redimensionnement), puis upload avec gestion de l'état de
// chargement et des erreurs (log + toast). handleImageChange/handleIconChange
// n'ont plus qu'à fournir leurs propres vérifications préalables (type de
// fichier) et les callbacks/messages spécifiques à leur champ.
//
// Extrait de ThematiqueFormDialog.tsx (qui approchait le seuil de 400 lignes —
// voir Architecture_Feature.pdf §15), avec MediaPickerField (voir MediaPickerField.tsx).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/ThematiqueFormDialog.tsx → handleImageChange, handleIconChange

import { toast } from "sonner"

export async function runMediaUpload(params: {
    file: File
    label: string
    excludeId: string | undefined
    maxSizeBytes: number
    upload: (file: File, label: string, excludeId?: string) => Promise<string>
    setUploading: (v: boolean) => void
    setValue: (v: string) => void
    errTooLarge: (maxMb: number) => string
    errUpload: string
    validateContent?: (file: File) => Promise<string | null>
    // transformFile : appliqué juste avant l'upload (ex: redimensionnement de
    // l'image). Le fichier original n'est utilisé que pour les vérifications
    // ci-dessus (taille, contenu) — c'est le résultat de transformFile qui est
    // réellement envoyé à Storage, jamais le fichier choisi par l'utilisateur.
    transformFile?: (file: File) => Promise<File>
    // "async function(...): Promise<void>" : cette fonction est asynchrone (mot-clé
    // "async"), elle peut donc utiliser "await" à l'intérieur pour attendre le
    // résultat d'opérations longues (upload réseau...) sans bloquer le reste de
    // l'application. Elle ne renvoie rien d'utile (Promise<void>), elle agit surtout
    // via les callbacks (setUploading, setValue) fournis dans "params".
}): Promise<void> {
    const { file, label, excludeId, maxSizeBytes, upload, setUploading, setValue, errTooLarge, errUpload, validateContent, transformFile } = params
    // Vérification de taille AVANT tout appel réseau : échec rapide, sans upload inutile.
    if (file.size > maxSizeBytes) {
        toast.error(errTooLarge(maxSizeBytes / (1024 * 1024)))
        return
    }
    // validateContent est optionnelle (le "?" dans son type ci-dessus) : si elle
    // est fournie, on l'attend (await) avant de continuer.
    if (validateContent) {
        const contentError = await validateContent(file)
        if (contentError) {
            toast.error(contentError)
            return
        }
    }
    setUploading(true)
    // try/catch/finally : on tente l'upload (try), on rattrape une éventuelle
    // erreur pour afficher un message clair plutôt que de faire planter l'appli
    // (catch), et dans tous les cas — succès ou échec — on repasse "uploading"
    // à false à la fin (finally).
    try {
        const fileToUpload = transformFile ? await transformFile(file) : file
        const path = await upload(fileToUpload, label, excludeId)
        setValue(path)
    } catch (err) {
        console.error("[ThematiqueFormDialog] media upload:", err)
        toast.error(errUpload)
    } finally {
        setUploading(false)
    }
}
