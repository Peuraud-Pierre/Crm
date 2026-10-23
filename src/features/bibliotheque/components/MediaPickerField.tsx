// ── MediaPickerField.tsx ──────────────────────────────────────────────────────
// RÔLE : un champ "média" — label associé (htmlFor/id) à un <input type="file">
// masqué, déclenché par un bouton stylé, avec aperçu optionnel et état de
// chargement. Utilisé deux fois dans ThematiqueFormDialog.tsx (image
// d'illustration, icône SVG), factorisé ici pour ne pas dupliquer la structure
// JSX (label + input caché + bouton + aperçu + hint).
//
// Extrait de ThematiqueFormDialog.tsx (qui approchait le seuil de 400 lignes —
// voir Architecture_Feature.pdf §15), avec runMediaUpload() (voir mediaUpload.ts,
// extrait pour la même raison).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/ThematiqueFormDialog.tsx → champs Image et Icône

import type { ChangeEvent, RefObject } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { Upload } from "lucide-react"

// ChangeEvent<HTMLInputElement> : le type TypeScript de l'événement reçu par
// onChange quand l'utilisateur choisit un fichier dans l'<input type="file">.
// RefObject<HTMLInputElement | null> : le type d'une "ref" React pointant vers
// cet <input> du DOM — voir l'explication de inputRef.current plus bas.
export function MediaPickerField({
    id, label, previewUrl, previewClassName, inputRef, accept, uploading, disabled,
    chooseLabel, uploadingLabel, hint, onChange,
}: {
    id: string
    label: string
    previewUrl: string
    previewClassName: string
    inputRef: RefObject<HTMLInputElement | null>
    accept: string
    uploading: boolean
    disabled: boolean
    chooseLabel: string
    uploadingLabel: string
    hint?: string
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-sm font-medium">{label}</label>
            {/* Rendu conditionnel avec `&&` : l'aperçu ne s'affiche que si previewUrl
                est une chaîne non vide (donc "truthy"). */}
            {previewUrl && <img src={previewUrl} alt="" className={previewClassName} />}
            {/* L'<input type="file"> natif du navigateur ouvre le sélecteur de fichiers
                du système. Il est visuellement caché (className="hidden") car on
                préfère afficher un bouton stylé (ci-dessous) — c'est ce bouton qui,
                au clic, déclenche l'ouverture du sélecteur via inputRef.current?.click(). */}
            <input ref={inputRef} id={id} type="file" accept={accept} className="hidden" onChange={onChange} />
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={disabled}
                loading={uploading}
                // inputRef.current pointe vers l'élément <input> réel du DOM (une "ref"
                // React sert à accéder directement à un élément HTML, en dehors du flux
                // normal props/state). "?." évite une erreur si l'input n'est pas encore monté.
                onClick={() => inputRef.current?.click()}
            >
                {/* Pendant l'upload, le spinner et la désactivation viennent de la
                    prop `loading` du Button : il n'y a plus qu'un libellé à choisir. */}
                {uploading ? (
                    uploadingLabel
                ) : (
                    <>
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {chooseLabel}
                    </>
                )}
            </Button>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}
