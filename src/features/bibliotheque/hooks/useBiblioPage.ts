// ── useBiblioPage.ts ──────────────────────────────────────────────────────────
// RÔLE : Orchestrateur de la page Bibliothèque.
//
// Ce hook assemble trois sous-hooks spécialisés :
//   - useBibli      → charge les données depuis Supabase et expose le CRUD bas niveau
//   - useDialog     → gère quel dialog est ouvert (create-qr, delete-thematique, etc.)
//   - useSearch     → filtre les données selon la saisie dans la barre de recherche
//
// Il ajoute par-dessus :
//   - Les handlers CRUD de haut niveau (handleSaveQR, handleDeleteThematique…)
//     qui appellent useBibli, affichent un toast si ça échoue, et ferment
//     le dialog si ça réussit.
//   - L'état dérivé (countByThematique, activeThematique, activeQRs) calculé
//     via useMemo pour éviter des recalculs inutiles.
//
// Règle importante : closeDialog() est appelé UNIQUEMENT si l'opération réussit.
// Si Supabase renvoie une erreur, le dialog reste ouvert et un toast rouge s'affiche.
//
// Le résultat est structuré en 4 groupes pour faciliter la lecture dans useBiblioContext :
//   data     → tout ce qui vient de la base de données
//   nav      → navigation, langue, recherche
//   dialogs  → état des dialogs et fonctions d'ouverture
//   handlers → fonctions qui déclenchent des actions CRUD
//
// CE FICHIER EST IMPORTÉ PAR :
//   - context/BiblioContext.tsx → monte le Provider avec la valeur de ce hook

import { useState, useMemo, useCallback } from "react"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Lang, QRContent, FormatMap } from "../types"
import { BIBLIO_PERMISSION, UI_TEXT } from "../constants"
import { toast } from "sonner"
import { useBibli } from "./data/useBibli"
import { useDialog } from "./useDialog"
import { useSearch } from "./useSearch"

export function useBiblioPage() {
    // canManage : autorise création / modification / suppression. Sans cette
    // permission la page reste entièrement consultable (SELECT ouvert à tout
    // authentifié côté RLS), mais tous les déclencheurs d'écriture sont masqués.
    // Le front n'est pas la barrière de sécurité : les policies RLS refusent déjà
    // INSERT/UPDATE/DELETE sur les 3 tables et le bucket Storage. Masquer évite
    // simplement de proposer des actions qui échoueraient.
    const { hasPermission } = useAuth()
    const canManage = hasPermission(BIBLIO_PERMISSION.manage)

    // lang : langue active de l'interface ("fr" ou "en")
    // Changer la langue re-rend tous les composants qui affichent du texte traduit.
    const [lang, setLang] = useState<Lang>("fr")

    // uiRef : référence stable vers l'objet de textes de la langue active.
    // On l'utilise dans les handlers useCallback pour lire le bon message d'erreur
    // SANS que lang apparaisse dans les dépendances du callback (ce qui forcerait
    // la recréation du callback à chaque changement de langue).
    // Pattern "event handler ref" — voir @/shared/hooks/useLiveRef.ts.
    const uiRef = useLiveRef(UI_TEXT[lang])

    // ui : version "live" des textes, utilisée directement dans le JSX
    const ui = UI_TEXT[lang]

    // Toutes les données Supabase + fonctions CRUD bas niveau (voir useBibli.ts).
    // "Déstructuration" : useBibli() renvoie UN SEUL objet avec tous ces champs ;
    // au lieu d'écrire `const bibli = useBibli()` puis `bibli.thematiques`,
    // `bibli.createQR`, etc. partout, on extrait directement chaque champ dans
    // sa propre variable en une seule instruction.
    const {
        thematiques,
        questionsReponses,
        formatReponses,
        brief,
        loading,
        loadError,
        refetch,
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
    } = useBibli()

    // thematiquesRef : miroir synchrone de `thematiques` (même pattern que
    // uiRef ci-dessus et dialogRef ci-dessous — voir @/shared/hooks/useLiveRef.ts).
    // handleDeleteThematique s'en sert pour lire l'image_url/icon_url À JOUR
    // d'une thématique plutôt que l'instantané figé dans dialog.thematique au
    // moment de l'ouverture du dialog de confirmation — sans quoi un
    // renommage (qui déplace le média en Storage, voir syncThematiqueMediaNaming)
    // survenu pendant que la confirmation est affichée ferait supprimer
    // l'ANCIEN chemin, laissant le fichier actuel orphelin dans le bucket.
    const thematiquesRef = useLiveRef(thematiques)

    // activeId : id de la thématique sélectionnée dans la sidebar.
    // Chaîne vide = aucune sélection → BriefPanel s'affiche à droite.
    const [activeId, setActiveId] = useState<string>("")

    // État du dialog actif et fonctions d'ouverture (voir useDialog.ts)
    const {
        dialog, dialogRef, closeDialog,
        openCreateQR, openEditQR, openDeleteQR, openEditFormat, openViewFormat,
        openCreateThematique, openRenameThematique, openDeleteThematique,
        openEditBrief, openEditChiffres,
    } = useDialog()

    // Logique de recherche : filtre les thématiques/Q&R selon la saisie (voir useSearch.ts)
    const {
        searchQuery, setSearchQuery,
        debouncedQuery,
        detailQRId, setDetailQRId,
        detailQR, detailThematique,
        searchGroups,
        handleNavigate, clearSearch,
    } = useSearch({ thematiques, questionsReponses, lang, setActiveId })

    // ── Handlers Q&R ──────────────────────────────────────────────────────────
    // Ces fonctions sont appelées par les dialogs de formulaire.
    // Elles lisent dialog.mode pour savoir si c'est une création ou une édition,
    // appellent la bonne fonction de useBibli, puis ferment le dialog OU affichent
    // un toast d'erreur selon le résultat.
    //
    // Règle uniforme pour TOUS les handlers ci-dessous : lire dialogRef.current
    // (jamais `dialog` directement) pour décider quelle branche exécuter.
    // Pourquoi : chaque handler est async et attend une réponse réseau (Supabase)
    // avant de refermer le dialog. Pendant cette attente, l'utilisateur peut fermer
    // le dialog ou en ouvrir un autre (double-clic, navigation rapide) ; si le
    // handler capturait `dialog` par closure (via la dépendance du useCallback),
    // il agirait sur l'état du dialog au moment où LA FONCTION A ÉTÉ CRÉÉE, pas au
    // moment où elle s'exécute réellement. dialogRef.current lit toujours l'état
    // le plus frais, sans que `dialog` ait besoin de figurer dans les dépendances
    // (ce qui, en bonus, évite de recréer ces callbacks à chaque changement de dialog).

    const handleSaveQR = useCallback(async (
        question: string, briefQr: string, questionEn: string, briefQrEn: string, thematiqueId: string
    ) => {
        const d = dialogRef.current
        const data: QRContent = { question, briefQr, questionEn, briefQrEn }
        // `d?.mode` : "optional chaining" (l'opérateur ?.). Si `d` vaut null ou
        // undefined, l'expression s'arrête tout de suite et vaut undefined, au
        // lieu de planter avec une erreur "Cannot read property 'mode' of null".
        // Utile ici car `d` (aucun dialog ouvert) est un cas normal, pas une erreur.
        if (d?.mode === "edit-qr") {
            const ok = await updateQR(d.qr.id, data, thematiqueId)
            if (ok) closeDialog()
            else toast.error(uiRef.current.errUpdateQR)
        } else if (d?.mode === "create-qr") {
            // thematiqueId vient du select du formulaire (pré-rempli avec la thématique active)
            const created = await createQR(thematiqueId, data)
            if (created) closeDialog()
            else toast.error(uiRef.current.errCreateQR)
        }
    }, [updateQR, createQR, closeDialog, dialogRef])

    const handleDeleteQR = useCallback(async () => {
        const d = dialogRef.current
        if (d?.mode !== "delete-qr") return
        const deletedId = d.qr.id
        const ok = await deleteQR(deletedId)
        if (ok) {
            // Si cette Q&R était affichée à droite dans la vue recherche, on
            // nettoie aussi cet état pour ne pas garder un panneau "fantôme"
            if (detailQRId === deletedId) setDetailQRId(null)
            closeDialog()
        } else {
            toast.error(uiRef.current.errDeleteQR)
        }
    }, [dialogRef, deleteQR, detailQRId, setDetailQRId, closeDialog])

    // ── Handlers Thématique ────────────────────────────────────────────────────

    const handleSaveThematique = useCallback(async (
        label: string, labelEn: string, imageUrl: string, iconUrl: string
    ) => {
        const d = dialogRef.current
        if (d?.mode === "rename-thematique") {
            const ok = await updateThematique(
                d.thematique.id, label, labelEn, imageUrl, iconUrl, d.thematique.label,
                d.thematique.imageUrl, d.thematique.iconUrl,
            )
            if (ok) closeDialog()
            else toast.error(uiRef.current.errRenameTopic)
        } else if (d?.mode === "create-thematique") {
            const created = await createThematique(label, labelEn, imageUrl, iconUrl)
            if (created) {
                // Sélectionne automatiquement la thématique fraîchement créée
                setActiveId(created.id)
                closeDialog()
            } else {
                toast.error(uiRef.current.errCreateTopic)
            }
        }
    }, [dialogRef, updateThematique, createThematique, closeDialog])

    const handleDeleteThematique = useCallback(async () => {
        const d = dialogRef.current
        if (d?.mode !== "delete-thematique") return
        const { id } = d.thematique
        // On lit imageUrl/iconUrl depuis thematiquesRef (état le plus frais),
        // pas depuis d.thematique (instantané pris à l'ouverture du dialog) —
        // voir le commentaire sur thematiquesRef plus haut. Repli sur le
        // snapshot du dialog si la thématique n'est plus dans la liste locale
        // (cas limite : déjà supprimée ailleurs entre-temps).
        const live = thematiquesRef.current.find((t) => t.id === id)
        // `??` ("nullish coalescing") : renvoie la valeur de gauche SAUF si elle
        // vaut null ou undefined, auquel cas elle prend celle de droite. Ici :
        // utiliser live.imageUrl si `live` existe ET que imageUrl n'est pas
        // vide/absent, sinon retomber sur l'instantané du dialog.
        const imageUrl = live?.imageUrl ?? d.thematique.imageUrl
        const iconUrl = live?.iconUrl ?? d.thematique.iconUrl
        const ok = await deleteThematique(id, imageUrl, iconUrl)
        if (ok) {
            // Désélectionne si c'était la thématique active
            if (activeId === id) setActiveId("")
            // Supabase supprime les Q&R en cascade (FK ON DELETE CASCADE).
            // Si une Q&R de cette thématique était affichée dans le panneau détail,
            // on nettoie l'état pour éviter un panneau "fantôme".
            if (detailQR?.thematiqueId === id) setDetailQRId(null)
            closeDialog()
        } else {
            toast.error(uiRef.current.errDeleteTopic)
        }
    }, [dialogRef, deleteThematique, activeId, detailQR, setDetailQRId, closeDialog])

    const handleSaveBrief = useCallback(async (briefFr: string, briefEn: string) => {
        const ok = await updateBrief(briefFr, briefEn)
        if (ok) closeDialog()
        else toast.error(uiRef.current.errSaveBrief)
    }, [updateBrief, closeDialog])

    const handleSaveChiffres = useCallback(async (chiffresFr: string, chiffresEn: string) => {
        const ok = await updateChiffres(chiffresFr, chiffresEn)
        if (ok) closeDialog()
        else toast.error(uiRef.current.errSaveChiffres)
    }, [updateChiffres, closeDialog])

    const handleSaveFormat = useCallback(async (map: FormatMap) => {
        const d = dialogRef.current
        if (d?.mode !== "edit-format") return
        const ok = await upsertFormat(d.qr.id, map)
        if (ok) closeDialog()
        else toast.error(uiRef.current.errSaveFormats)
    }, [dialogRef, upsertFormat, closeDialog])

    // ── État dérivé ────────────────────────────────────────────────────────────
    // Ces valeurs sont recalculées automatiquement quand leurs dépendances changent.
    // useMemo évite de refaire le calcul à chaque re-render si les données n'ont pas changé.

    // Dictionnaire { [thematique_id]: nombre_de_qr } — affiché comme badge dans la sidebar
    const countByThematique = useMemo(
        () => questionsReponses.reduce<Record<string, number>>((acc, qr) => {
            acc[qr.thematiqueId] = (acc[qr.thematiqueId] ?? 0) + 1
            return acc
        }, {}),
        [questionsReponses]
    )

    // Objet Thematique complet correspondant à activeId (undefined si rien de sélectionné)
    const activeThematique = useMemo(
        () => thematiques.find((t) => t.id === activeId),
        [thematiques, activeId]
    )

    // Liste des Q&R appartenant à la thématique active (tableau vide si rien de sélectionné)
    const activeQRs = useMemo(
        () => questionsReponses.filter((qr) => qr.thematiqueId === activeId),
        [questionsReponses, activeId]
    )

    return {
        /** Données Supabase brutes, agrégats calculés et état de chargement */
        data: {
            thematiques, questionsReponses, formatReponses, brief,
            countByThematique, activeThematique, activeQRs,
            loading, loadError, refetch,
        },
        /** Droits de l'utilisateur courant sur la feature */
        perms: { canManage },
        /** Langue, textes UI, navigation, recherche et sélection de détail */
        nav: {
            lang, setLang, ui,
            activeId, setActiveId,
            searchQuery, setSearchQuery, debouncedQuery, searchGroups,
            detailQRId, setDetailQRId, detailQR, detailThematique,
            handleNavigate, clearSearch,
        },
        /** État du dialog actif et fonctions d'ouverture */
        dialogs: {
            dialog, closeDialog,
            openCreateThematique, openRenameThematique, openDeleteThematique,
            openEditBrief, openEditChiffres,
            openCreateQR, openEditQR, openDeleteQR, openEditFormat, openViewFormat,
        },
        /** Handlers CRUD asynchrones — appellent useBibli puis ferment le dialog */
        handlers: {
            handleSaveQR, handleDeleteQR,
            handleSaveThematique, handleDeleteThematique,
            handleSaveBrief, handleSaveChiffres, handleSaveFormat,
            uploadThematiqueImage, uploadThematiqueIcon, discardUnsavedThematiqueMedia,
            replaceThematiqueImage, resolveThematiqueMediaUrl,
        },
    }
}
