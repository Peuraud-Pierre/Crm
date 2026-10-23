#!/usr/bin/env node

// Peuple le wiki interne (public.wiki_categories / public.wiki_articles) avec la
// documentation utilisateur du module Stock > Arrivages, à partir du contenu
// vérifié du "Guide utilisateur - Tableau des arrivages.pdf" (v1.3, juillet 2026).
//
// Idempotent : peut être relancé sans dupliquer catégories/articles/images
// (recherche par nom/titre avant insertion, upload avec upsert:true).
//
// Utilisation :
//   PUBLIC_SUPABASE_URL=... PUBLIC_SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-wiki-arrivage.mjs
//
// SUPABASE_SERVICE_ROLE_KEY est fortement recommandé (contourne la RLS wiki.manage).
// À défaut, PUBLIC_SUPABASE_PUBLISHABLE_KEY est utilisée : il faut alors être
// authentifié avec un compte disposant de la permission wiki.manage (RLS oblige).

import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = path.join(__dirname, "../docs/wiki-arrivage-assets")

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
    console.error("ERROR: PUBLIC_SUPABASE_URL not found in environment")
    process.exit(1)
}

const apiKey = supabaseServiceRoleKey || supabasePublishableKey
if (!apiKey) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY or PUBLIC_SUPABASE_PUBLISHABLE_KEY required")
    process.exit(1)
}

console.log(`Supabase URL: ${supabaseUrl}`)
console.log(
    supabaseServiceRoleKey
        ? "Using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)"
        : "Using PUBLIC_SUPABASE_PUBLISHABLE_KEY (requires an authenticated session with wiki.manage)"
)

const supabase = createClient(supabaseUrl, apiKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function findCategory(name, parentId) {
    let query = supabase.from("wiki_categories").select("id").eq("name", name)
    query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId)
    const { data, error } = await query.maybeSingle()
    if (error) throw error
    return data?.id ?? null
}

async function upsertCategory(name, parentId, position = 0) {
    const existingId = await findCategory(name, parentId)
    if (existingId) return existingId
    const { data, error } = await supabase
        .from("wiki_categories")
        .insert({ name, parent_id: parentId, position })
        .select("id")
        .single()
    if (error) throw error
    return data.id
}

async function uploadImage(filename, storagePath) {
    const filePath = path.join(ASSETS_DIR, filename)
    const fileBuffer = fs.readFileSync(filePath)
    const ext = path.extname(filename).slice(1).toLowerCase()
    const contentType = ext === "png" ? "image/png" : "image/jpeg"
    const { error } = await supabase.storage.from("wiki").upload(storagePath, fileBuffer, {
        contentType,
        upsert: true,
    })
    if (error) throw error
    const { data } = supabase.storage.from("wiki").getPublicUrl(storagePath)
    return data.publicUrl
}

async function upsertArticle({ title, categoryId, sections, position }) {
    const { data: existing, error: selErr } = await supabase
        .from("wiki_articles")
        .select("id")
        .eq("title", title)
        .eq("category_id", categoryId)
        .maybeSingle()
    if (selErr) throw selErr

    const payload = { title, category_id: categoryId, sections, status: "published", position }

    if (existing) {
        const { error } = await supabase.from("wiki_articles").update(payload).eq("id", existing.id)
        if (error) throw error
        return existing.id
    }

    const { data, error } = await supabase.from("wiki_articles").insert(payload).select("id").single()
    if (error) throw error
    return data.id
}

function buildArticles({ imgOverview, imgCreate, imgEdit, imgExport }) {
    return [
        {
            title: "Vue d'ensemble et lecture du tableau des arrivages",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    title: "À quoi sert cette page ?",
                    content:
                        "Le **Tableau des arrivages** centralise le suivi de tous les conteneurs import : depuis leur départ chez le fournisseur jusqu'à leur déchargement en entrepôt. Chaque ligne représente un arrivage, c'est-à-dire un conteneur en cours d'acheminement ou déjà réceptionné.\n\nSur cette page vous pouvez :\n\n- Visualiser l'ensemble des arrivages, triés et regroupés par mois\n- Repérer en un coup d'œil les 5 prochains déchargements et les factures manquantes urgentes\n- Créer un nouvel arrivage manuellement\n- Modifier les informations d'un arrivage existant\n- Exporter tout ou partie du tableau au format Excel\n\n> ℹ️ Les actions disponibles (créer, modifier, exporter) dépendent de vos droits. Si un bouton n'est pas visible, c'est que votre rôle n'inclut pas cette permission.",
                },
                {
                    id: "s2",
                    type: "text",
                    title: "La barre d'en-tête",
                    content:
                        "La barre en haut du tableau affiche, de gauche à droite :\n\n| Élément | Description |\n| --- | --- |\n| **Tableau des arrivages** | Titre de la section |\n| **N arrivage(s) enregistré(s)** | Compteur total de tous les arrivages chargés |\n| ⚖️ **X kg total** | Somme des poids de tous les arrivages (affiché uniquement si au moins un poids est renseigné) |\n| Bouton **Exporter** | Télécharge un fichier Excel. Visible uniquement si vous avez la permission d'export |\n| Bouton **Nouvel arrivage** | Ouvre le formulaire de création. Visible uniquement si vous avez la permission de création |",
                },
                {
                    id: "s3",
                    type: "image",
                    url: imgOverview,
                    caption:
                        "Vue d'ensemble du tableau des arrivages, avec l'en-tête (compteur, poids total, boutons Exporter et Nouvel arrivage).",
                    alt: "Tableau des arrivages regroupé par mois",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Organisation par mois et pagination",
                    content:
                        "Les arrivages sont regroupés par mois et triés du plus récent au plus ancien. Chaque groupe commence par une ligne de titre indiquant le mois, le nombre d'arrivages et le poids total du mois.\n\nLa date de référence utilisée pour le classement dans un mois suit cette priorité :\n\n1. Date de déchargement prévue\n2. Date d'arrivée au port (Le Havre)\n3. Date de départ fournisseur\n\nLe tableau affiche 3 mois par page. La navigation s'effectue via les boutons **Précédent / Suivant** ou en cliquant directement sur un numéro de page.\n\n> ✅ Astuce : la page s'ouvre automatiquement sur les mois contenant les prochains déchargements. Un point ambre sur un numéro de page indique qu'elle contient au moins un des 5 prochains arrivages.",
                },
                {
                    id: "s5",
                    type: "text",
                    title: "Colonnes du tableau",
                    content:
                        "| Colonne | Description |\n| --- | --- |\n| Statut | Badge coloré indiquant l'état de l'arrivage (voir l'article *Statuts et indicateurs visuels*) |\n| Fournisseur | Nom du fournisseur et sa localisation si renseignée |\n| Facture | Date de la facture. Une icône ⚠️ rouge signale une facture manquante urgente |\n| Départ | Date de départ du fournisseur |\n| Le Havre | Date d'arrivée prévue au port du Havre |\n| Mode | Mode de transport : 40', 40HC, 20', COMPLET, LCL |\n| N° Conteneur | Numéro BIC du conteneur (ex : CSLU6080095) |\n| Déchargement | 📅 Date et heure prévues de déchargement (jour en clair + date + heure) |\n| Poids (kg) | Poids total du conteneur en kilogrammes |\n| Quantité | Nombre d'unités |\n| N° Interne | Référence interne libre (ex : GR 123) |\n| ✏️ | Bouton d'édition (apparaît au survol de la ligne sur desktop, toujours visible sur mobile) |",
                },
            ],
        },
        {
            title: "Statuts et indicateurs visuels d'un arrivage",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    title: "Les statuts possibles",
                    content:
                        "| Badge | Signification |\n| --- | --- |\n| **Planifié** | L'arrivage est enregistré mais pas encore expédié |\n| **En transit** | Le conteneur est en cours d'acheminement |\n| **Reçu** | La marchandise a été réceptionnée en entrepôt |\n| **Annulé** | L'arrivage a été annulé. Aucune alerte facture ne s'applique |",
                },
                {
                    id: "s2",
                    type: "text",
                    title: "Point ambre : statut mis à jour automatiquement",
                    content:
                        "Certaines transitions de statut sont posées automatiquement par le système (par exemple *Planifié → En transit* quand la date de départ est passée, ou *En transit → Reçu* quand la date de déchargement est passée).\n\nUn petit **point ambre** à côté du badge signifie que le statut a été mis à jour automatiquement et attend votre confirmation. Ouvrez l'arrivage (bouton crayon) pour le confirmer ou le corriger : toute sauvegarde manuelle confirme automatiquement le statut affiché.",
                },
                {
                    id: "s3",
                    type: "text",
                    title: "Arrivages imminents (fond ambre)",
                    content:
                        "Les 5 prochains arrivages par date de déchargement prévue sont mis en évidence par :\n\n- Un fond légèrement ambre sur la ligne\n- Une barre verticale ambre à gauche de la ligne\n- La date de déchargement affichée en texte ambre",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Alerte facture manquante (fond rouge)",
                    content:
                        "> ⚠️ Quand est-ce que l'alerte rouge se déclenche ?\n\nUne ligne passe en rouge lorsque les trois conditions suivantes sont réunies :\n\n- Aucune date de facture n'est renseignée\n- Le statut n'est pas *Annulé*\n- Le déchargement est prévu dans moins de 7 jours, ou la date est déjà dépassée\n\nDans ce cas : fond rouge, icône ⚠️ dans la colonne Facture, bordure gauche rouge.\n\n**Action à effectuer :** ouvrez l'arrivage (bouton crayon) et renseignez la date de facture.",
                },
            ],
        },
        {
            title: "Créer un arrivage",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    content:
                        "Cliquez sur **+ Nouvel arrivage** en haut à droite du tableau. Un panneau s'ouvre depuis la droite.",
                },
                {
                    id: "s2",
                    type: "image",
                    url: imgCreate,
                    caption: "Le panneau de création, avec les champs Identification, Transport, Poids & quantité.",
                    alt: "Formulaire de création d'un nouvel arrivage",
                },
                {
                    id: "s3",
                    type: "text",
                    title: "Étapes",
                    content:
                        "1. **Choisir le fournisseur** — cliquez sur le champ *Rechercher un fournisseur…* et tapez les premières lettres du nom, puis sélectionnez le fournisseur dans la liste. Champ obligatoire.\n2. **Saisir le N° de conteneur** — entrez le numéro BIC du conteneur (ex : CSLU6080095). Le texte est automatiquement mis en majuscules. Champ obligatoire.\n3. **Renseigner les informations optionnelles** — vous pouvez ajouter : N° interne, date de facture, mode de transport, date de départ, poids et quantité. Ces champs sont tous optionnels à la création.\n4. **Valider** — cliquez sur *Créer l'arrivage*. Le formulaire se ferme et la nouvelle ligne apparaît dans le tableau.",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Champs disponibles à la création",
                    content:
                        "| Champ | Obligatoire | Description |\n| --- | --- | --- |\n| Fournisseur | ✅ | Fournisseur de la marchandise |\n| N° Conteneur | ✅ | Numéro BIC (majuscules automatiques) |\n| N° Interne | — | Référence interne libre |\n| Date facture | — | Date de la facture fournisseur |\n| Mode de transport | — | 40', 40HC, 20', COMPLET, LCL |\n| Date de départ | — | Date d'expédition chez le fournisseur |\n| Poids (kg) | — | Poids total du conteneur |\n| Quantité | — | Nombre d'unités |\n\n> ℹ️ Plusieurs champs ne sont disponibles qu'en modification, pas à la création : date de déchargement prévue, date d'arrivée au Havre, statut, et notes. Pour ajouter un commentaire libre sur un arrivage, ouvrez-le après création via le bouton ✏️ (voir l'article *Modifier un arrivage*).",
                },
            ],
        },
        {
            title: "Modifier un arrivage",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    content:
                        "Survolez une ligne du tableau et cliquez sur le bouton crayon ✏️ à droite. Sur mobile, le bouton est toujours visible sans survol.\n\nLe panneau de modification s'ouvre avec toutes les informations déjà remplies. Vous pouvez modifier n'importe quel champ.",
                },
                {
                    id: "s2",
                    type: "image",
                    url: imgEdit,
                    caption: "Le panneau d'édition, avec la bannière rouge « Facture manquante » et le nombre de jours de retard.",
                    alt: "Formulaire de modification d'un arrivage avec alerte facture manquante",
                },
                {
                    id: "s3",
                    type: "text",
                    title: "Champs supplémentaires disponibles en modification",
                    content:
                        "| Champ | Description |\n| --- | --- |\n| Date & heure de déchargement | Date et heure précises du déchargement prévu. S'affiche au format local (ex : « Lundi · 23/06/26 · 08:30 »). Un indicateur J-X est calculé automatiquement |\n| Statut | Modifier manuellement le statut de l'arrivage |\n| Arrivée Le Havre | Date d'arrivée au port du Havre |\n| Notes | Commentaire libre sur l'arrivage |",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Alertes dans le formulaire d'édition",
                    content:
                        "**⚠️ Facture manquante** — une bannière rouge s'affiche si le déchargement est prévu dans moins de 7 jours (ou passé) et qu'aucune date de facture n'est renseignée. Le champ *Date facture* est mis en rouge. Saisissez la date pour faire disparaître l'alerte.\n\n**⚠️ Statut mis à jour automatiquement** — une bannière ambre s'affiche si le système a modifié le statut automatiquement. Vous pouvez cliquer sur *OK* pour confirmer, ou choisir un autre statut dans la liste. Toute sauvegarde confirme automatiquement le statut.",
                },
                {
                    id: "s5",
                    type: "text",
                    title: "Indicateur J-X",
                    content:
                        "Quand une date de déchargement est saisie, un indicateur apparaît sous le champ :\n\n- **J-3** : déchargement dans 3 jours\n- **J** : déchargement aujourd'hui\n- **J+2** : déchargement passé depuis 2 jours\n\nCliquez sur **Enregistrer** pour sauvegarder les modifications.",
                },
            ],
        },
        {
            title: "Exporter le tableau des arrivages en Excel",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    content:
                        "Deux modes d'export sont disponibles depuis les boutons en haut à droite du tableau : un export complet, et un export filtré par période.",
                },
                {
                    id: "s2",
                    type: "text",
                    title: "Export complet",
                    content:
                        "Cliquez sur **Exporter**. Le fichier Excel est généré et téléchargé immédiatement. Il contient tous les arrivages, sans filtre de date.",
                },
                {
                    id: "s3",
                    type: "image",
                    url: imgExport,
                    caption: "Le sélecteur de plage de dates, ouvert depuis l'icône calendrier.",
                    alt: "Sélecteur de plage de dates pour l'export par période",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Export par période",
                    content:
                        "1. Cliquez sur l'icône calendrier 📅. Un sélecteur de plage de dates s'ouvre.\n2. Sélectionnez la plage : cliquez sur la date de début, puis sur la date de fin. La plage sélectionnée est affichée en bas du calendrier.\n3. Cliquez sur **Télécharger**.\n\nSeuls les arrivages dont la date de référence (déchargement, ou Le Havre, ou départ) tombe dans la plage sont inclus.",
                },
                {
                    id: "s5",
                    type: "text",
                    title: "Contenu du fichier Excel",
                    content:
                        "| Colonne | Description |\n| --- | --- |\n| Statut | Libellé du statut |\n| Fournisseur | Nom du fournisseur |\n| Date facture | En-tête rouge — colonne critique |\n| Départ | Date de départ |\n| Le Havre | Date d'arrivée au port |\n| Mode | Mode de transport |\n| N° Conteneur | Numéro BIC |\n| Déchargement | En-tête ambre — colonne prioritaire (jour + date + heure) |\n| Poids (kg) | Poids total |\n| Quantité | Nombre d'unités |\n| N° Interne | Référence interne |\n| Lieu | Localisation du siège fournisseur |\n| Notes | Commentaires libres |\n\n> ℹ️ Le fichier Excel inclut une ligne de total à la fin de chaque mois (poids cumulé). Les colonnes sont pré-filtrées selon vos droits : certaines colonnes peuvent être absentes si votre rôle n'y a pas accès.",
                },
                {
                    id: "s6",
                    type: "text",
                    title: "Nom du fichier",
                    content:
                        "- Export complet : `arrivages_2026-06-16.xlsx`\n- Export période : `arrivages_01-06-2026_30-06-2026.xlsx`",
                },
            ],
        },
        {
            title: "S'abonner à la newsletter des arrivages",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    content:
                        "La newsletter des arrivages permet de recevoir par e-mail un état à jour du tableau, sans avoir besoin de se connecter à la Console. L'envoi se déclenche automatiquement dès qu'un arrivage est **ajouté** ou **modifié** (avec un court délai pour regrouper les changements rapprochés).\n\n> ℹ️ La suppression d'un arrivage n'est actuellement pas disponible dans l'application — seuls les ajouts et modifications déclenchent un envoi.",
                },
                {
                    id: "s2",
                    type: "text",
                    title: "S'abonner",
                    content:
                        "L'abonnement se fait depuis votre **profil** (et non depuis une page d'administration) : une carte *Newsletter Arrivages* y apparaît si vous disposez du droit correspondant.\n\n1. Ouvrez votre profil et repérez la carte *Newsletter Arrivages*\n2. Cochez les colonnes que vous souhaitez recevoir dans le fichier Excel joint à chaque e-mail\n3. Renseignez le code d'invitation (format `ARV-XXXXXXXX`) qu'un administrateur doit avoir créé au préalable pour vous — sans ce code, l'abonnement n'est pas possible\n4. Cliquez sur **S'abonner**\n\nSi vous n'avez pas de code d'invitation, demandez-en un à votre administrateur.",
                },
                {
                    id: "s3",
                    type: "text",
                    title: "Modifier ses colonnes ou se désabonner",
                    content:
                        "Une fois abonné, revenez sur la même carte dans votre profil : cochez/décochez des colonnes puis cliquez sur **Mettre à jour**, ou cliquez sur **Se désabonner** pour arrêter les envois (le code d'invitation n'est pas redemandé pour ces actions).",
                },
            ],
        },
        {
            title: "Questions fréquentes — Tableau des arrivages",
            sections: [
                {
                    id: "s1",
                    type: "text",
                    title: "Je ne vois pas le bouton « Nouvel arrivage »",
                    content:
                        "Ce bouton est masqué si vous ne disposez pas du droit de création. Contactez votre administrateur pour obtenir cette permission.",
                },
                {
                    id: "s2",
                    type: "text",
                    title: "Ma ligne est en rouge mais la facture est bien reçue",
                    content:
                        "Ouvrez l'arrivage (bouton crayon) et renseignez la date de facture dans la section *Facturation*. L'alerte disparaît dès qu'une date est enregistrée.",
                },
                {
                    id: "s3",
                    type: "text",
                    title: "Le statut a changé tout seul",
                    content:
                        "Le système peut mettre à jour certains statuts automatiquement. Un point ambre sur le badge vous indique que ce statut doit être confirmé. Ouvrez l'arrivage et cliquez sur *Enregistrer* pour confirmer.",
                },
                {
                    id: "s4",
                    type: "text",
                    title: "Comment trouver un arrivage d'un mois passé ?",
                    content:
                        "Naviguez vers les pages précédentes du tableau à l'aide des boutons *Précédent / Suivant* ou en cliquant sur les numéros de page.",
                },
                {
                    id: "s5",
                    type: "text",
                    title: "L'export ne contient pas toutes les colonnes",
                    content:
                        "Les colonnes visibles dans l'export dépendent de vos droits d'accès. Certaines colonnes (ex : Notes, Lieu) peuvent être masquées selon votre rôle. Contactez l'administrateur si vous avez besoin d'accéder à des données manquantes.",
                },
                {
                    id: "s6",
                    type: "text",
                    title: "Je ne vois pas la date de déchargement dans le tableau mais elle est renseignée",
                    content:
                        "La date de déchargement est affichée uniquement si elle a été saisie dans le formulaire d'édition. Vérifiez le champ *Date & heure prévues* dans le panneau de modification de l'arrivage concerné.",
                },
            ],
        },
    ]
}

async function main() {
    const stockId = await upsertCategory("Stock", null, 0)
    console.log(`✓ Catégorie "Stock" -> ${stockId}`)

    const arrivagesId = await upsertCategory("Arrivages", stockId, 0)
    console.log(`✓ Catégorie "Arrivages" -> ${arrivagesId}`)

    console.log("Upload des captures d'écran...")
    const imgOverview = await uploadImage("01-vue-ensemble-tableau.png", "articles/arrivage-vue-ensemble.png")
    const imgCreate = await uploadImage("02-creer-arrivage.png", "articles/arrivage-creation.png")
    const imgEdit = await uploadImage("03-modifier-arrivage-alerte-facture.png", "articles/arrivage-edition-alerte.png")
    const imgExport = await uploadImage("04-export-periode.png", "articles/arrivage-export-periode.png")
    console.log("✓ Images uploadées vers le bucket wiki")

    const articles = buildArticles({ imgOverview, imgCreate, imgEdit, imgExport })

    for (const [index, article] of articles.entries()) {
        const id = await upsertArticle({
            title: article.title,
            categoryId: arrivagesId,
            sections: article.sections,
            position: index,
        })
        console.log(`✓ Article "${article.title}" -> ${id}`)
    }

    console.log("\nTerminé. 2 catégories et 7 articles publiés sous Stock > Arrivages.")
}

main().catch((err) => {
    console.error("Erreur:", err.message)
    process.exit(1)
})
