// ── hooks/data/useBiblioQR.ts ──────────────────────────────────────────────────
// RÔLE : CRUD des Questions/Réponses et de leurs formats de réponse.
//
// Extrait de useBibli.ts (qui approchait le seuil de 400 lignes — voir
// Architecture_Feature.pdf §15) pour séparer une responsabilité à part entière :
// useBibli.ts garde le chargement initial + le CRUD des thématiques/brief, ce
// hook gère UNIQUEMENT les Q&R et leurs formats. Aucun état ne vit ici — l'état
// (questionsReponses, formatReponses) et sa position max par thématique restent
// dans useBibli.ts, reçus ici en paramètres (mêmes setters/refs).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBibli.ts → seul consommateur

import { useCallback } from "react"
import type { Dispatch, SetStateAction, RefObject } from "react"
import type { QR, QRContent, FormatMap } from "@/features/bibliotheque/types"
import { mapQR } from "../../services/mappers"
import * as svc from "@/features/bibliotheque/services/bibliothequeService"

// Dispatch<SetStateAction<T>> est le type TypeScript de la fonction "setXxx"
// renvoyée par useState<T>(...) dans le hook PARENT (useBibli.ts). Ce hook ne
// crée pas son propre état : il reçoit en paramètre les fonctions setState
// (et une "ref", voir RefObject ci-dessous) déjà créées ailleurs, pour pouvoir
// mettre à jour le même état partagé.
// RefObject<T> est le type d'une valeur créée par useRef<T>(...) : un objet
// `{ current: T }` qui garde sa valeur entre les rendus SANS déclencher de
// re-render quand elle change (contrairement à useState).
interface UseBiblioQRParams {
    userId: string | undefined
    setQuestionsReponses: Dispatch<SetStateAction<QR[]>>
    setFormatReponses: Dispatch<SetStateAction<Record<string, FormatMap>>>
    maxQRPosByThematique: RefObject<Record<string, number>>
}

// useBiblioQR : regroupe les 4 opérations CRUD (Create/Read/Update/Delete, ici
// sans le Read qui vit dans useBibli.ts) pour les Questions/Réponses et leurs
// formats de réponse. Chaque fonction est `async` (elle contient des appels
// réseau vers Supabase avec `await`, donc elle s'exécute en plusieurs étapes
// sans bloquer le reste de l'application pendant l'attente) et renvoie une
// Promise — un objet qui représente "un résultat pas encore disponible, mais
// qui le sera plus tard". `await` met en pause SEULEMENT cette fonction
// jusqu'à ce que la Promise se résolve, puis continue avec la valeur obtenue.
export function useBiblioQR({
    userId, setQuestionsReponses, setFormatReponses, maxQRPosByThematique,
}: UseBiblioQRParams) {
    // Promise<QR | null> : type union — la fonction renvoie soit un objet QR
    // (succès), soit `null` (utilisateur non connecté ou erreur). L'appelant
    // doit donc toujours vérifier lequel des deux cas s'est produit.
    const createQR = useCallback(async (
        thematiqueId: string, data: QRContent,
    ): Promise<QR | null> => {
        if (!userId) return null
        const nextPos = (maxQRPosByThematique.current[thematiqueId] ?? -1) + 1
        maxQRPosByThematique.current[thematiqueId] = nextPos
        try {
            const row = await svc.insertQR(thematiqueId, data, nextPos, userId)
            const item = mapQR(row)
            // Mise à jour optimiste : on ajoute tout de suite le nouvel item dans
            // l'état local, sans attendre l'événement Realtime. `prev` est la valeur
            // du tableau juste avant ; `[...prev, item]` (opérateur "spread") crée un
            // NOUVEAU tableau contenant tous les éléments de `prev` plus `item` à la
            // fin — on ne modifie jamais le tableau existant directement (règle React).
            setQuestionsReponses((prev) => [...prev, item])
            return item
        } catch (err) {
            // Même garde-fou que createThematique dans useBibli.ts : ne reculer que
            // si aucune autre création concurrente sur la même thématique n'a déjà
            // avancé le compteur au-delà de la position qu'on avait réservée.
            if (maxQRPosByThematique.current[thematiqueId] === nextPos) {
                maxQRPosByThematique.current[thematiqueId] = nextPos - 1
            }
            console.error("[useBiblioQR] createQR:", err)
            return null
        }
    }, [userId, setQuestionsReponses, maxQRPosByThematique])

    // Promise<boolean> : ici le succès/échec est représenté par true/false
    // plutôt que par un objet — l'appelant (useBiblioPage.ts) n'a besoin de
    // rien de plus qu'un "ça a marché ou pas" pour décider d'afficher un toast.
    const updateQR = useCallback(async (id: string, data: QRContent, thematiqueId: string): Promise<boolean> => {
        try {
            await svc.patchQR(id, data, thematiqueId)
            // .map() reconstruit tout le tableau : pour chaque qr, si c'est celui
            // qu'on modifie, on crée une copie fusionnée ({ ...qr, ...data, ... }
            // — le spread écrase les anciens champs par ceux de `data`), sinon on
            // garde l'élément tel quel.
            setQuestionsReponses((prev) => prev.map((qr) =>
                qr.id === id ? { ...qr, ...data, thematiqueId } : qr
            ))
            return true
        } catch (err) {
            console.error("[useBiblioQR] updateQR:", err)
            return false
        }
    }, [setQuestionsReponses])

    const deleteQR = useCallback(async (id: string): Promise<boolean> => {
        try {
            await svc.removeQR(id)
            setQuestionsReponses((prev) => prev.filter((qr) => qr.id !== id))
            // On retire aussi les formats de réponse associés à cette Q&R : on
            // copie le dictionnaire ({ ...prev }) puis on supprime la clé `id`
            // de la copie, pour ne jamais modifier `prev` directement.
            setFormatReponses((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
            })
            return true
        } catch (err) {
            console.error("[useBiblioQR] deleteQR:", err)
            return false
        }
    }, [setQuestionsReponses, setFormatReponses])

    const upsertFormat = useCallback(async (qrId: string, map: FormatMap): Promise<boolean> => {
        try {
            await svc.upsertFormatMap(qrId, map)
            setFormatReponses((prev) => ({ ...prev, [qrId]: map }))
            return true
        } catch (err) {
            console.error("[useBiblioQR] upsertFormat:", err)
            return false
        }
    }, [setFormatReponses])

    return { createQR, updateQR, deleteQR, upsertFormat }
}
