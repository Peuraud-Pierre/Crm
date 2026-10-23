// ── imageResize.ts ────────────────────────────────────────────────────────────
// RÔLE : re-encode côté client l'image d'illustration d'une thématique avant
// son upload, pour ne jamais stocker en Storage le fichier choisi par
// l'utilisateur — seule la version décodée puis ré-encodée par le canvas part.
//
// C'est autant une mesure de taille que de sécurité : le passage par
// createImageBitmap + canvas ne conserve que des pixels, donc rien de ce que le
// fichier d'origine transportait (balises d'un SVG déguisé, charge utile
// glissée dans un bloc de métadonnées) ne survit au ré-encodage. sniffImageMime
// refuse en amont ce que le canvas ne devrait pas avoir à décoder.
//
// Isolé de utils.tsx (fonctions pures sans effet de bord asynchrone) car ce
// module dépend d'API navigateur asynchrones (createImageBitmap, canvas) qui
// n'existent pas dans l'environnement de test (jsdom) : il est donc mocké en
// bloc dans ThematiqueFormDialog.upload.test.tsx plutôt qu'exercé avec de
// vraies images. Sa propre logique (calcul du ratio, pas d'agrandissement,
// conservation du nom/type) est testée séparément dans imageResize.test.ts en
// simulant createImageBitmap/canvas.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - components/ThematiqueFormDialog.tsx → resizeImageToMaxHeight, appelé sur
//     le fichier choisi juste avant uploadThematiqueImage

export const THEMATIQUE_IMAGE_MAX_HEIGHT = 200

// Redimensionne `file` pour que sa hauteur ne dépasse jamais `maxHeight`, en
// conservant le ratio d'aspect (la largeur est recalculée en conséquence).
// Si l'image est déjà plus petite ou égale à `maxHeight`, elle est retournée
// telle quelle (jamais d'agrandissement). Le nom du fichier d'origine est
// conservé ; le type MIME est celui produit par l'encodage canvas (identique
// en pratique au type d'origine pour les formats matriciels courants).
//
// `async function` + `await` : cette fonction fait des opérations qui prennent
// du temps (décoder l'image, l'encoder) sans bloquer le reste de l'appli
// pendant l'attente. `Promise<File>` comme type de retour signifie "cette
// fonction ne renvoie pas un File tout de suite, mais une promesse d'obtenir
// un File plus tard" ; `await` met en pause l'exécution de CETTE fonction
// (pas de l'appli entière) jusqu'à ce que la promesse soit résolue.
// `maxHeight: number = THEMATIQUE_IMAGE_MAX_HEIGHT` est une valeur par défaut :
// si l'appelant ne précise pas maxHeight, cette constante est utilisée.
export async function resizeImageToMaxHeight(
    file: File,
    maxHeight: number = THEMATIQUE_IMAGE_MAX_HEIGHT
): Promise<File> {
    const bitmap = await createImageBitmap(file)
    // try/finally : le bloc `finally` s'exécute TOUJOURS, que le bloc `try`
    // se termine normalement (return) ou qu'une erreur soit levée (throw).
    // Ici, ça garantit que bitmap.close() libère la mémoire du navigateur
    // dans tous les cas, même si une erreur interrompt le redimensionnement.
    try {
        // Une image déjà assez petite est ré-encodée quand même : la retourner
        // telle quelle enverrait les octets d'origine à Storage, et c'est
        // précisément ce qu'on veut éviter. Sa hauteur est simplement conservée
        // (jamais d'agrandissement).
        const height = Math.min(bitmap.height, maxHeight)
        const ratio = height / bitmap.height
        const width = Math.round(bitmap.width * ratio)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("Contexte de dessin 2D indisponible")
        ctx.drawImage(bitmap, 0, 0, width, height)

        // canvas.toBlob() est une API "à l'ancienne" basée sur un callback
        // (une fonction qu'on lui passe et qu'elle rappellera plus tard avec
        // le résultat), pas sur une Promise. On l'enveloppe manuellement dans
        // `new Promise((resolve) => ...)` pour pouvoir utiliser `await` dessus
        // comme sur n'importe quelle autre opération asynchrone : `resolve`
        // est la fonction qui, une fois appelée par toBlob, fait aboutir la
        // promesse avec la valeur reçue.
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, file.type || "image/png")
        )
        if (!blob) throw new Error("Échec de l'encodage de l'image redimensionnée")

        // Le nom suit le type réellement produit : c'est lui qui détermine
        // l'extension sous laquelle le fichier est stocké (uploadThematiqueImage),
        // et un nom qui contredit le contenu est exactement ce qu'on cherche à
        // rendre impossible.
        const type = blob.type || "image/png"
        return new File([blob], renameToType(file.name, type), { type })
    } finally {
        bitmap.close()
    }
}

const EXT_BY_MIME: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

function renameToType(name: string, mime: string): string {
    const ext = EXT_BY_MIME[mime] ?? "png"
    const base = name.replace(/\.[^.]+$/, "")
    return `${base}.${ext}`
}

// Types matriciels acceptés pour l'image d'illustration. Le SVG en est
// volontairement absent : il n'a rien à faire dans ce champ, et l'icône (le
// seul champ vectoriel) passe par sanitizeSvgText.
//
// Signatures lues dans le fichier lui-même : ni l'extension du nom ni le
// Content-Type annoncé par le navigateur ne sont vérifiables — les deux sont
// choisis par celui qui téléverse.
const MAGIC_NUMBERS: { mime: string; bytes: number[]; offset: number }[] = [
    { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff], offset: 0 },
    // WebP : conteneur RIFF, avec le format à l'octet 8 ("WEBP").
    { mime: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

/**
 * Renvoie le type MIME réel du fichier d'après ses premiers octets, ou null
 * s'il ne fait pas partie des formats matriciels acceptés.
 */
export async function sniffImageMime(file: File): Promise<string | null> {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

    for (const { mime, bytes, offset } of MAGIC_NUMBERS) {
        if (bytes.every((b, i) => header[offset + i] === b)) return mime
    }
    return null
}
