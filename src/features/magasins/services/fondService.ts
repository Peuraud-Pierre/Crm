// ── services/fondService.ts ───────────────────────────────────────────────────
// Fond de plan à décalquer : fichier image dans le bucket privé
// `magasin-plans` (migration 20261008100000_magasins_fond_plan), lu par URL signée. Le chemin et
// le calage vivent sur la ligne du magasin (magasinService.patchMagasin).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useFond.ts

import { supabase } from "@/integrations/supabase/client"
import { FOND_BUCKET } from "@/features/magasins/constants"

/** Durée de validité d'une URL signée : une session de travail. */
const SIGNED_URL_SECONDS = 60 * 60

/** `folder` : « <magasin_id>/<etage_id> », un dossier par étage. */
export async function uploadFond(folder: string, image: Blob, extension: "png" | "jpg"): Promise<string> {
    // Un nom par envoi : l'ancien fichier reste lisible jusqu'à ce que la
    // ligne du magasin pointe le nouveau, puis il est supprimé.
    const path = `${folder}/fond-${Date.now()}.${extension}`
    const { error } = await supabase.storage.from(FOND_BUCKET).upload(path, image, {
        contentType: extension === "png" ? "image/png" : "image/jpeg",
        upsert: false,
    })
    if (error) throw error
    return path
}

export async function removeFond(path: string): Promise<void> {
    const { error } = await supabase.storage.from(FOND_BUCKET).remove([path])
    if (error) throw error
}

export async function fondUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(FOND_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS)
    if (error || !data) throw error
    return data.signedUrl
}
