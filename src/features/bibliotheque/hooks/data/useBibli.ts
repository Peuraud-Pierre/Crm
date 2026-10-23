// ── hooks/data/useBibli.ts ─────────────────────────────────────────────────────
// RÔLE : Hook de données central — c'est le "cerveau" de la Bibliothèque côté données.
//
// Il fait deux choses :
//   1. CHARGEMENT INITIAL : appelle bibliothequeService.fetchAllBiblioData() au
//      montage du composant pour remplir l'état React.
//   2. CRUD : expose des fonctions (createThematique, updateQR, deleteQR…) qui
//      appellent bibliothequeService, puis mettent à jour l'état local.
//
// La synchronisation Supabase Realtime (modifications faites par d'autres
// utilisateurs) est déléguée à useBiblioRealtime.ts — responsabilité séparée
// pour ne pas cumuler fetch + CRUD + temps réel dans un seul hook.
//
// Ce hook ne sait rien de l'interface : pas de toast, pas de dialog, pas de
// navigation. C'est useBiblioPage.ts qui s'en charge.
//
// Mises à jour optimistes : quand on crée un élément, il s'affiche IMMÉDIATEMENT
// dans la liste sans attendre la réponse de Supabase (meilleure expérience utilisateur).
// Si Supabase confirme ensuite via Realtime, on déduplique.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useBiblioPage.ts → seul consommateur, qui assemble données + UI
//
// CE FICHIER IMPORTE :
//   - hooks/data/useBiblioRealtime.ts → souscriptions temps réel
//   - hooks/data/useBiblioQR.ts → CRUD Q&R + formats de réponse (extrait
//     d'ici pour rester sous le seuil de 400 lignes, voir son en-tête)
//   - services/bibliothequeService.ts → toutes les opérations Supabase (CRUD
//     des 4 tables + upload/renommage/suppression de médias, réexportés
//     depuis services/bibliothequeMediaService.ts)
//   - services/mappers.ts → conversion des lignes Supabase (snake_case) en
//     objets métier (camelCase)

import { useState, useCallback, useRef } from "react"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import type { Thematique, QR, FormatMap, Brief } from "@/features/bibliotheque/types"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { mapThematique, mapQR, mapFormatRow, mapBriefRow } from "../../services/mappers"
import * as svc from "@/features/bibliotheque/services/bibliothequeService"
import { useBiblioRealtime } from "./useBiblioRealtime"
import { useBiblioQR } from "./useBiblioQR"

export function useBibli() {
    // ── État React : données de la Bibliothèque ────────────────────────────────
    // useState<T>(valeurInitiale) crée une variable réactive :
    //   - thematiques : le tableau en lecture
    //   - setThematiques : la fonction pour le modifier (React re-rend le composant)
    const [thematiques, setThematiques] = useState<Thematique[]>([])
    const [questionsReponses, setQuestionsReponses] = useState<QR[]>([])
    // qrsRef : miroir synchrone de questionsReponses (voir @/shared/hooks/useLiveRef.ts).
    // Permet à deleteThematique de lire la liste à jour des Q&R AVANT de déclencher
    // les setState, sans dépendre de questionsReponses dans les deps de useCallback
    // (qui casserait la mémoïsation).
    const qrsRef = useLiveRef(questionsReponses)
    // Record<string, FormatMap> = un dictionnaire { "id-de-qr": FormatMap }
    const [formatReponses, setFormatReponses] = useState<Record<string, FormatMap>>({})
    const [brief, setBrief] = useState<Brief>({ brief: "", briefEn: "", chiffres: "", chiffresEn: "" })
    const [loading, setLoading] = useState(true)      // true = données pas encore chargées
    const [loadError, setLoadError] = useState(false) // true = erreur réseau ou Supabase

    // useRef stocke une valeur SANS déclencher de re-render quand elle change.
    // On s'en sert pour mémoriser la position max de chaque groupe, afin que
    // le prochain élément inséré prenne la position suivante (max + 1).
    // Les suppressions créent des "trous" dans les positions — on utilise max
    // plutôt que length pour éviter les conflits de position.
    const maxThematiquePosRef = useRef(-1)
    const maxQRPosByThematiqueRef = useRef<Record<string, number>>({})

    const { user } = useAuth()

    // ── Chargement initial ─────────────────────────────────────────────────────
    // useCallback mémoïse la fonction pour éviter de la recréer à chaque render.
    // Le tableau [] en deuxième argument signifie "créer cette fonction une seule fois".

    const fetchAll = useCallback(async () => {
        setLoading(true)
        setLoadError(false)
        try {
            // Appel au service : charge les 4 tables en parallèle
            const { thematiques: tRows, questionsReponses: qRows, formatReponses: fRows, brief: bRow } =
                await svc.fetchAllBiblioData()

            // Conversion des lignes brutes (snake_case, nullables) en objets métier
            setThematiques(tRows.map(mapThematique))
            setQuestionsReponses(qRows.map(mapQR))

            // Construction du dictionnaire des formats : { "qr-id": FormatMap }
            // On itère sur chaque ligne et on ajoute une entrée au dictionnaire
            const map: Record<string, FormatMap> = {}
            for (const row of fRows) {
                const [qrId, fmt] = mapFormatRow(row)
                map[qrId] = fmt
            }
            setFormatReponses(map)

            // Le brief peut ne pas exister encore (première utilisation)
            if (bRow) setBrief(mapBriefRow(bRow))

            // Mémorisation de la position max pour chaque groupe,
            // utilisée pour assigner la bonne position aux nouveaux éléments.
            // reduce() parcourt le tableau et accumule un résultat (ici le max).
            maxThematiquePosRef.current = tRows.reduce((m, r) => Math.max(m, r.position), -1)
            maxQRPosByThematiqueRef.current = qRows.reduce<Record<string, number>>((acc, r) => {
                acc[r.thematique_id] = Math.max(acc[r.thematique_id] ?? -1, r.position)
                return acc
            }, {})
        } catch (err) {
            setLoadError(true)
            console.error("[useBibli] fetchAll:", err)
        } finally {
            // finally s'exécute toujours, même en cas d'erreur → on retire le loader
            setLoading(false)
        }
    }, [])

    // ── CRUD Thématiques ───────────────────────────────────────────────────────
    // CRUD = Create, Read, Update, Delete (les 4 opérations de base sur les données).

    const createThematique = useCallback(async (
        label: string, labelEn: string, imageUrl = "", iconUrl = "",
    ): Promise<Thematique | null> => {
        // Si l'utilisateur n'est pas connecté, on ne peut pas créer
        if (!user?.user_id) return null
        // Calcul de la prochaine position (juste après le dernier élément)
        const nextPos = maxThematiquePosRef.current + 1
        maxThematiquePosRef.current = nextPos
        try {
            // insertThematiqueWithMediaRetry (pas insertThematique) : si le chemin
            // image/icône déjà téléversé entre en conflit avec une AUTRE thématique
            // au niveau de l'index UNIQUE partiel en base (course gagnée par un
            // renommage concurrent entre le pré-check et cette écriture — voir
            // bibliothequeMediaService.ts detectMediaConflict), le service déplace
            // automatiquement le média vers un chemin libre et retente.
            const row = await svc.insertThematiqueWithMediaRetry(label, labelEn, imageUrl, iconUrl, nextPos, user.user_id)
            const item = mapThematique(row)
            // Mise à jour optimiste : l'item s'affiche IMMÉDIATEMENT sans attendre
            // l'événement Realtime (qui peut prendre 1-5 secondes).
            // Le handler Realtime INSERT vérifiera qu'on ne duplique pas.
            // prev = valeur précédente du tableau, [...prev, item] = nouveau tableau avec l'item ajouté
            setThematiques((prev) => [...prev, item])
            return item
        } catch (err) {
            // En cas d'échec, on annule l'incrémentation — MAIS seulement si personne
            // d'autre n'a réservé une position plus haute entre-temps (double-clic, ou
            // deux onglets créant chacun une thématique en parallèle). Si le ref a déjà
            // avancé au-delà de nextPos, une autre création concurrente a réussi avec
            // cette position plus haute : la faire reculer écraserait sa réservation et
            // ferait obtenir la MÊME position à une future création (pas de contrainte
            // UNIQUE en base sur `position` → tri instable). Ne reculer que si le ref
            // vaut encore exactement nextPos garantit qu'on ne récupère que sa propre
            // réservation, jamais celle d'un tiers.
            if (maxThematiquePosRef.current === nextPos) {
                maxThematiquePosRef.current = nextPos - 1
            }
            console.error("[useBibli] createThematique:", err)
            return null
        }
    }, [user])

    // previousLabel : nom (FR) de la thématique AVANT modification. S'il diffère
    // du nouveau label et que la thématique a déjà une image/icône, on renomme
    // (déplace) les fichiers en Storage pour rester synchronisé avec le nom
    // affiché — voir bibliothequeService.syncThematiqueMediaNaming. Omis (ou
    // égal à label) → aucun appel Storage supplémentaire.
    //
    // previousImageUrl / previousIconUrl : chemins Storage AVANT modification
    // (avant tout upload fait pendant la session du dialog). Utilisés en toute
    // fin de fonction pour supprimer l'ancien fichier devenu orphelin quand
    // l'utilisateur a choisi une NOUVELLE image/icône pendant un renommage —
    // jusqu'ici, seul le cas "même fichier, juste renommé" (syncThematiqueMediaNaming
    // ci-dessous) était couvert ; remplacer le fichier ne supprimait jamais
    // l'ancien. Voir le commentaire au-dessus du nettoyage plus bas.
    const updateThematique = useCallback(async (
        id: string, label: string, labelEn: string, imageUrl = "", iconUrl = "", previousLabel?: string,
        previousImageUrl = "", previousIconUrl = "",
    ): Promise<boolean> => {
        let finalImageUrl = imageUrl
        let finalIconUrl = iconUrl
        if (previousLabel !== undefined && previousLabel !== label) {
            try {
                const synced = await svc.syncThematiqueMediaNaming(id, label, imageUrl, iconUrl)
                finalImageUrl = synced.imageUrl
                finalIconUrl = synced.iconUrl
            } catch (err) {
                // best-effort : un échec de renommage Storage ne doit pas bloquer
                // la sauvegarde du reste de la thématique
                console.error("[useBibli] syncThematiqueMediaNaming:", err)
            }
        }
        // patchThematiqueWithMediaRetry (pas patchThematique) : mêmes garanties de
        // retry-sur-conflit qu'à la création (voir createThematique ci-dessus) —
        // pertinent ici aussi car syncThematiqueMediaNaming vient de déplacer le
        // média avec le même pré-check non-atomique. Elle renvoie les chemins
        // RÉELLEMENT écrits en base (après relocalisation éventuelle), qui peuvent
        // différer de finalImageUrl/finalIconUrl si une retry a eu lieu.
        let writtenImageUrl = finalImageUrl
        let writtenIconUrl = finalIconUrl
        try {
            const written = await svc.patchThematiqueWithMediaRetry(id, label, labelEn, finalImageUrl, finalIconUrl)
            writtenImageUrl = written.imageUrl
            writtenIconUrl = written.iconUrl
        } catch (err) {
            console.error("[useBibli] updateThematique:", err)
            // ThematiqueMediaWriteError porte les DERNIERS chemins réellement
            // tentés (après d'éventuelles relocalisations) — c'est CEUX-LÀ qu'il
            // faut ramener à l'ancien chemin, pas nécessairement finalImageUrl/
            // finalIconUrl si une retry a déplacé le fichier plus loin entre-temps.
            const lastImageUrl = err instanceof svc.ThematiqueMediaWriteError ? err.lastImageUrl : finalImageUrl
            const lastIconUrl = err instanceof svc.ThematiqueMediaWriteError ? err.lastIconUrl : finalIconUrl
            // Storage a déjà déplacé le(s) fichier(s) vers lastImageUrl/lastIconUrl
            // avant cet échec DB — on les ramène à leur ancien chemin (imageUrl/
            // iconUrl) pour que Storage reste synchronisé avec ce que la base
            // contient réellement (best-effort, ne bloque pas le retour false).
            if (lastImageUrl !== imageUrl) {
                svc.revertMediaMove(lastImageUrl, imageUrl).catch((revertErr) => {
                    console.error("[useBibli] revertMediaMove (image):", revertErr)
                })
            }
            if (lastIconUrl !== iconUrl) {
                svc.revertMediaMove(lastIconUrl, iconUrl).catch((revertErr) => {
                    console.error("[useBibli] revertMediaMove (icon):", revertErr)
                })
            }
            return false
        }
        setThematiques((prev) => prev.map((t) =>
            t.id === id ? { ...t, label, labelEn, imageUrl: writtenImageUrl, iconUrl: writtenIconUrl } : t
        ))

        // Nettoyage best-effort de l'ancien média désormais remplacé par
        // writtenImageUrl/writtenIconUrl. Couvre deux cas avec le même code :
        //   - renommage SANS nouveau fichier : syncThematiqueMediaNaming a déjà
        //     déplacé (Storage.move) l'ancien chemin vers le nouveau — l'ancien
        //     chemin est déjà vide, ce delete est alors un no-op silencieux.
        //   - un NOUVEAU fichier a été téléversé pendant la session du dialog
        //     (avec ou sans renommage) : l'ancien fichier existe toujours à son
        //     ancien chemin, jamais référencé par syncThematiqueMediaNaming
        //     (qui ne regarde que le chemin ACTUEL du formulaire, déjà celui du
        //     nouvel upload) — sans ce nettoyage, il restait orphelin pour toujours.
        // Comparé à writtenImageUrl/writtenIconUrl (pas finalImageUrl/finalIconUrl) :
        // ce sont les chemins réellement écrits en base après une éventuelle
        // relocalisation sur conflit (voir patchThematiqueWithMediaRetry ci-dessus).
        const staleImageUrl = previousImageUrl && previousImageUrl !== writtenImageUrl ? previousImageUrl : ""
        const staleIconUrl = previousIconUrl && previousIconUrl !== writtenIconUrl ? previousIconUrl : ""
        if (staleImageUrl || staleIconUrl) {
            svc.deleteThematiqueMedia(staleImageUrl, staleIconUrl).catch((err) => {
                console.error("[useBibli] cleanup ancien média après remplacement:", err)
            })
        }

        return true
    }, [])

    const deleteThematique = useCallback(async (
        id: string, imageUrl: string, iconUrl: string,
    ): Promise<boolean> => {
        try {
            await svc.removeThematique(id)
            // Nettoyage des médias dans Supabase Storage — best-effort, lancé sans
            // attendre : une erreur ici (fichier déjà absent, etc.) ne doit ni faire
            // échouer la suppression (déjà actée côté base) ni retarder la mise à
            // jour de l'UI locale ci-dessous le temps d'un aller-retour réseau
            // supplémentaire. L'erreur reste journalisée si l'appel échoue.
            svc.deleteThematiqueMedia(imageUrl, iconUrl).catch((err) => {
                console.error("[useBibli] deleteThematiqueMedia:", err)
            })
            // Nettoyage local immédiat — on ne dépend plus des événements Realtime
            // en cascade (qui peuvent tarder) pour purger la thématique, ses Q&R,
            // et leurs formats de réponse associés.
            const removedQrIds = qrsRef.current
                .filter((qr) => qr.thematiqueId === id)
                .map((qr) => qr.id)
            setThematiques((prev) => prev.filter((t) => t.id !== id))
            setQuestionsReponses((prev) => prev.filter((qr) => qr.thematiqueId !== id))
            if (removedQrIds.length > 0) {
                setFormatReponses((prev) => {
                    const next = { ...prev }
                    for (const qrId of removedQrIds) delete next[qrId]
                    return next
                })
            }
            delete maxQRPosByThematiqueRef.current[id]
            return true
        } catch (err) {
            console.error("[useBibli] deleteThematique:", err)
            return false
        }
    }, [])

    // Téléverse un média de thématique (image ou icône SVG) et renvoie son chemin
    // dans le bucket. Ne touche à aucun état local — l'appelant (ThematiqueFormDialog)
    // se charge de placer le chemin renvoyé dans le formulaire. excludeId : id de
    // la thématique en cours d'édition, pour ne pas se considérer soi-même comme
    // une collision de nom (voir bibliothequeService.uploadThematiqueImage/Icon).
    const uploadThematiqueImage = useCallback((file: File, label: string, excludeId?: string): Promise<string> =>
        svc.uploadThematiqueImage(file, label, excludeId), [])

    const uploadThematiqueIcon = useCallback((file: File, label: string, excludeId?: string): Promise<string> =>
        svc.uploadThematiqueIcon(file, label, excludeId), [])

    // Supprime du bucket un média fraîchement téléversé mais jamais sauvegardé
    // (l'utilisateur a choisi un fichier puis annulé le dialog sans valider) —
    // évite les fichiers orphelins. Best-effort : erreur journalisée par l'appelant.
    const discardUnsavedThematiqueMedia = useCallback((imageUrl: string, iconUrl: string): Promise<void> =>
        svc.deleteThematiqueMedia(imageUrl, iconUrl), [])

    // Remplace l'image d'une thématique par un nouveau fichier déjà téléversé
    // pendant la session du dialog : supprime D'ABORD l'ancienne image du
    // bucket, PUIS renomme la nouvelle vers le nom canonique de la thématique
    // (libéré par cette suppression) — voir bibliothequeMediaService.ts.
    // Appelée par ThematiqueFormDialog au moment de la soumission (handleSubmit),
    // pas à la sélection du fichier.
    const replaceThematiqueImage = useCallback((
        oldImagePath: string, newImagePath: string, label: string, excludeId: string,
    ): Promise<string> => svc.replaceThematiqueImage(oldImagePath, newImagePath, label, excludeId), [])

    // Résout un chemin bucket (image_url / icon_url) en URL affichable. Fonction
    // pure et synchrone (aucun état local) : on réexpose directement la référence
    // du service, sans wrapper useCallback inutile. Exposée ici — plutôt
    // qu'importée directement par les composants — pour respecter la couche
    // service obligatoire (toujours passer par un hook, voir CLAUDE.md).
    const resolveThematiqueMediaUrl = svc.resolveThematiqueMediaUrl

    const updateBrief = useCallback(async (briefFr: string, briefEn: string): Promise<boolean> => {
        try {
            await svc.upsertBrief(briefFr, briefEn)
            setBrief((prev) => ({ ...prev, brief: briefFr, briefEn }))
            return true
        } catch (err) {
            console.error("[useBibli] updateBrief:", err)
            return false
        }
    }, [])

    const updateChiffres = useCallback(async (chiffresFr: string, chiffresEn: string): Promise<boolean> => {
        try {
            await svc.upsertChiffres(chiffresFr, chiffresEn)
            setBrief((prev) => ({ ...prev, chiffres: chiffresFr, chiffresEn }))
            return true
        } catch (err) {
            console.error("[useBibli] updateChiffres:", err)
            return false
        }
    }, [])

    // ── CRUD Questions / Réponses et Formats ──────────────────────────────────
    // Extrait dans useBiblioQR.ts (voir son en-tête) — useBibli.ts approchait le
    // seuil de 400 lignes (Architecture_Feature.pdf §15).
    const { createQR, updateQR, deleteQR, upsertFormat } = useBiblioQR({
        userId: user?.user_id,
        setQuestionsReponses, setFormatReponses,
        maxQRPosByThematique: maxQRPosByThematiqueRef,
    })

    // ── Souscriptions temps réel (Supabase Realtime) ──────────────────────────
    // Déléguées à useBiblioRealtime.ts (responsabilité séparée). Ce hook déclenche
    // aussi le chargement initial (fetchAll) une fois l'utilisateur authentifié.
    useBiblioRealtime({
        userId: user?.user_id,
        fetchAll,
        setThematiques, setQRs: setQuestionsReponses, setFormatReponses, setBrief,
        maxThematiquePos: maxThematiquePosRef, maxQRPosByThematique: maxQRPosByThematiqueRef,
    })

    return {
        thematiques,
        questionsReponses,
        formatReponses,
        brief,
        loading,
        loadError,
        refetch: fetchAll,
        createThematique,
        updateThematique,
        uploadThematiqueImage,
        uploadThematiqueIcon,
        discardUnsavedThematiqueMedia,
        replaceThematiqueImage,
        resolveThematiqueMediaUrl,
        updateBrief,
        updateChiffres,
        deleteThematique,
        createQR,
        updateQR,
        deleteQR,
        upsertFormat,
    }
}
