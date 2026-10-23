/**
 * Sépare le radical d'un nom de fichier de son extension.
 *
 * Sert au renommage : l'utilisateur ne modifie que le radical, l'extension
 * étant recollée telle quelle. La changer par inadvertance casserait l'ouverture
 * du fichier (le type MIME stocké ne suivrait pas) sans que rien ne le signale.
 *
 * Cas volontairement traités comme « pas d'extension » :
 *  - un dossier, qui n'en a jamais ;
 *  - un nom sans point (« notes ») ;
 *  - un fichier caché sans suffixe (« .env ») — le point initial fait partie
 *    du nom, ce n'est pas un séparateur d'extension ;
 *  - un nom finissant par un point (« sauvegarde. »), qui n'a rien à protéger.
 *
 * Les extensions composées ne sont pas reconnues : « archive.tar.gz » donne
 * le radical « archive.tar » et l'extension « .gz ». C'est sans conséquence
 * ici, le suffixe restant protégé dans les deux cas.
 */
export function splitFileName(
    title: string,
    isFolder?: boolean
): { base: string; ext: string } {
    if (isFolder) return { base: title, ext: "" }

    const dot = title.lastIndexOf(".")
    if (dot <= 0 || dot === title.length - 1) {
        return { base: title, ext: "" }
    }

    return { base: title.slice(0, dot), ext: title.slice(dot) }
}
