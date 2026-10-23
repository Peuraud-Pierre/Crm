-- Seed : Wiki interne — Stock > Arrivages
--
-- Crée la catégorie "Stock" (racine), la sous-catégorie "Arrivages", et publie
-- 7 articles couvrant l'usage complet du Tableau des arrivages, à partir du
-- contenu vérifié du "Guide utilisateur - Tableau des arrivages.pdf" (v1.3,
-- juillet 2026).
--
-- Idempotent : relancer ce script ne duplique ni les catégories ni les articles
-- (recherche par nom/titre avant insertion).
--
-- AVANT D'EXÉCUTER :
--   1. Uploadez les 4 captures d'écran dans Storage > bucket "wiki" > dossier
--      "articles/" (Supabase Studio : Storage > wiki > New folder "articles" >
--      glisser-déposer les fichiers depuis Nokk_project/docs/wiki-arrivage-assets/).
--   2. Copiez les 4 URLs publiques obtenues et remplacez les 4 placeholders
--      ci-dessous (v_img_overview / v_img_create / v_img_edit / v_img_export).
--   3. Exécutez ce fichier dans Supabase Studio > SQL Editor (ou via psql /
--      supabase db execute).
--
-- Fichiers sources correspondants :
--   01-vue-ensemble-tableau.png            -> v_img_overview
--   02-creer-arrivage.png                  -> v_img_create
--   03-modifier-arrivage-alerte-facture.png -> v_img_edit
--   04-export-periode.png                  -> v_img_export

DO $$
DECLARE
    v_stock_id      uuid;
    v_arrivages_id  uuid;
    v_article_id    uuid;
    v_img_overview  text := '<<URL_IMAGE_VUE_ENSEMBLE>>';
    v_img_create    text := '<<URL_IMAGE_CREATION>>';
    v_img_edit      text := '<<URL_IMAGE_EDITION>>';
    v_img_export    text := '<<URL_IMAGE_EXPORT>>';
BEGIN
    ----------------------------------------------------------------------
    -- Catégories
    ----------------------------------------------------------------------

    SELECT id INTO v_stock_id
    FROM public.wiki_categories
    WHERE name = 'Stock' AND parent_id IS NULL;

    IF v_stock_id IS NULL THEN
        INSERT INTO public.wiki_categories (name, parent_id, position)
        VALUES ('Stock', NULL, 0)
        RETURNING id INTO v_stock_id;
    END IF;

    SELECT id INTO v_arrivages_id
    FROM public.wiki_categories
    WHERE name = 'Arrivages' AND parent_id = v_stock_id;

    IF v_arrivages_id IS NULL THEN
        INSERT INTO public.wiki_categories (name, parent_id, position)
        VALUES ('Arrivages', v_stock_id, 0)
        RETURNING id INTO v_arrivages_id;
    END IF;

    ----------------------------------------------------------------------
    -- Article 1 : Vue d'ensemble et lecture du tableau des arrivages
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Vue d'ensemble et lecture du tableau des arrivages$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Vue d'ensemble et lecture du tableau des arrivages$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'title', $t$À quoi sert cette page ?$t$,
                    'content', $c$Le **Tableau des arrivages** centralise le suivi de tous les conteneurs import : depuis leur départ chez le fournisseur jusqu'à leur déchargement en entrepôt. Chaque ligne représente un arrivage, c'est-à-dire un conteneur en cours d'acheminement ou déjà réceptionné.

Sur cette page vous pouvez :

- Visualiser l'ensemble des arrivages, triés et regroupés par mois
- Repérer en un coup d'œil les 5 prochains déchargements et les factures manquantes urgentes
- Créer un nouvel arrivage manuellement
- Modifier les informations d'un arrivage existant
- Exporter tout ou partie du tableau au format Excel

> ℹ️ Les actions disponibles (créer, modifier, exporter) dépendent de vos droits. Si un bouton n'est pas visible, c'est que votre rôle n'inclut pas cette permission.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'text',
                    'title', $t$La barre d'en-tête$t$,
                    'content', $c$La barre en haut du tableau affiche, de gauche à droite :

| Élément | Description |
| --- | --- |
| **Tableau des arrivages** | Titre de la section |
| **N arrivage(s) enregistré(s)** | Compteur total de tous les arrivages chargés |
| ⚖️ **X kg total** | Somme des poids de tous les arrivages (affiché uniquement si au moins un poids est renseigné) |
| Bouton **Exporter** | Télécharge un fichier Excel. Visible uniquement si vous avez la permission d'export |
| Bouton **Nouvel arrivage** | Ouvre le formulaire de création. Visible uniquement si vous avez la permission de création |$c$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'image',
                    'url', v_img_overview,
                    'caption', $t$Vue d'ensemble du tableau des arrivages, avec l'en-tête (compteur, poids total, boutons Exporter et Nouvel arrivage).$t$,
                    'alt', $t$Tableau des arrivages regroupé par mois$t$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Organisation par mois et pagination$t$,
                    'content', $c$Les arrivages sont regroupés par mois et triés du plus récent au plus ancien. Chaque groupe commence par une ligne de titre indiquant le mois, le nombre d'arrivages et le poids total du mois.

La date de référence utilisée pour le classement dans un mois suit cette priorité :

1. Date de déchargement prévue
2. Date d'arrivée au port (Le Havre)
3. Date de départ fournisseur

Le tableau affiche 3 mois par page. La navigation s'effectue via les boutons **Précédent / Suivant** ou en cliquant directement sur un numéro de page.

> ✅ Astuce : la page s'ouvre automatiquement sur les mois contenant les prochains déchargements. Un point ambre sur un numéro de page indique qu'elle contient au moins un des 5 prochains arrivages.$c$
                ),
                jsonb_build_object(
                    'id', 's5', 'type', 'text',
                    'title', $t$Colonnes du tableau$t$,
                    'content', $c$| Colonne | Description |
| --- | --- |
| Statut | Badge coloré indiquant l'état de l'arrivage (voir l'article *Statuts et indicateurs visuels*) |
| Fournisseur | Nom du fournisseur et sa localisation si renseignée |
| Facture | Date de la facture. Une icône ⚠️ rouge signale une facture manquante urgente |
| Départ | Date de départ du fournisseur |
| Le Havre | Date d'arrivée prévue au port du Havre |
| Mode | Mode de transport : 40', 40HC, 20', COMPLET, LCL |
| N° Conteneur | Numéro BIC du conteneur (ex : CSLU6080095) |
| Déchargement | 📅 Date et heure prévues de déchargement (jour en clair + date + heure) |
| Poids (kg) | Poids total du conteneur en kilogrammes |
| Quantité | Nombre d'unités |
| N° Interne | Référence interne libre (ex : GR 123) |
| ✏️ | Bouton d'édition (apparaît au survol de la ligne sur desktop, toujours visible sur mobile) |$c$
                )
            ),
            'published',
            0
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 2 : Statuts et indicateurs visuels d'un arrivage
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Statuts et indicateurs visuels d'un arrivage$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Statuts et indicateurs visuels d'un arrivage$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'title', $t$Les statuts possibles$t$,
                    'content', $c$| Badge | Signification |
| --- | --- |
| **Planifié** | L'arrivage est enregistré mais pas encore expédié |
| **En transit** | Le conteneur est en cours d'acheminement |
| **Reçu** | La marchandise a été réceptionnée en entrepôt |
| **Annulé** | L'arrivage a été annulé. Aucune alerte facture ne s'applique |$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'text',
                    'title', $t$Point ambre : statut mis à jour automatiquement$t$,
                    'content', $c$Certaines transitions de statut sont posées automatiquement par le système (par exemple *Planifié → En transit* quand la date de départ est passée, ou *En transit → Reçu* quand la date de déchargement est passée).

Un petit **point ambre** à côté du badge signifie que le statut a été mis à jour automatiquement et attend votre confirmation. Ouvrez l'arrivage (bouton crayon) pour le confirmer ou le corriger : toute sauvegarde manuelle confirme automatiquement le statut affiché.$c$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'text',
                    'title', $t$Arrivages imminents (fond ambre)$t$,
                    'content', $c$Les 5 prochains arrivages par date de déchargement prévue sont mis en évidence par :

- Un fond légèrement ambre sur la ligne
- Une barre verticale ambre à gauche de la ligne
- La date de déchargement affichée en texte ambre$c$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Alerte facture manquante (fond rouge)$t$,
                    'content', $c$> ⚠️ Quand est-ce que l'alerte rouge se déclenche ?

Une ligne passe en rouge lorsque les trois conditions suivantes sont réunies :

- Aucune date de facture n'est renseignée
- Le statut n'est pas *Annulé*
- Le déchargement est prévu dans moins de 7 jours, ou la date est déjà dépassée

Dans ce cas : fond rouge, icône ⚠️ dans la colonne Facture, bordure gauche rouge.

**Action à effectuer :** ouvrez l'arrivage (bouton crayon) et renseignez la date de facture.$c$
                )
            ),
            'published',
            1
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 3 : Créer un arrivage
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Créer un arrivage$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Créer un arrivage$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'content', $c$Cliquez sur **+ Nouvel arrivage** en haut à droite du tableau. Un panneau s'ouvre depuis la droite.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'image',
                    'url', v_img_create,
                    'caption', $t$Le panneau de création, avec les champs Identification, Transport, Poids & quantité.$t$,
                    'alt', $t$Formulaire de création d'un nouvel arrivage$t$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'text',
                    'title', $t$Étapes$t$,
                    'content', $c$1. **Choisir le fournisseur** — cliquez sur le champ *Rechercher un fournisseur…* et tapez les premières lettres du nom, puis sélectionnez le fournisseur dans la liste. Champ obligatoire.
2. **Saisir le N° de conteneur** — entrez le numéro BIC du conteneur (ex : CSLU6080095). Le texte est automatiquement mis en majuscules. Champ obligatoire.
3. **Renseigner les informations optionnelles** — vous pouvez ajouter : N° interne, date de facture, mode de transport, date de départ, poids et quantité. Ces champs sont tous optionnels à la création.
4. **Valider** — cliquez sur *Créer l'arrivage*. Le formulaire se ferme et la nouvelle ligne apparaît dans le tableau.$c$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Champs disponibles à la création$t$,
                    'content', $c$| Champ | Obligatoire | Description |
| --- | --- | --- |
| Fournisseur | ✅ | Fournisseur de la marchandise |
| N° Conteneur | ✅ | Numéro BIC (majuscules automatiques) |
| N° Interne | — | Référence interne libre |
| Date facture | — | Date de la facture fournisseur |
| Mode de transport | — | 40', 40HC, 20', COMPLET, LCL |
| Date de départ | — | Date d'expédition chez le fournisseur |
| Poids (kg) | — | Poids total du conteneur |
| Quantité | — | Nombre d'unités |

> ℹ️ Plusieurs champs ne sont disponibles qu'en modification, pas à la création : date de déchargement prévue, date d'arrivée au Havre, statut, et notes. Pour ajouter un commentaire libre sur un arrivage, ouvrez-le après création via le bouton ✏️ (voir l'article *Modifier un arrivage*).$c$
                )
            ),
            'published',
            2
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 4 : Modifier un arrivage
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Modifier un arrivage$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Modifier un arrivage$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'content', $c$Survolez une ligne du tableau et cliquez sur le bouton crayon ✏️ à droite. Sur mobile, le bouton est toujours visible sans survol.

Le panneau de modification s'ouvre avec toutes les informations déjà remplies. Vous pouvez modifier n'importe quel champ.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'image',
                    'url', v_img_edit,
                    'caption', $t$Le panneau d'édition, avec la bannière rouge « Facture manquante » et le nombre de jours de retard.$t$,
                    'alt', $t$Formulaire de modification d'un arrivage avec alerte facture manquante$t$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'text',
                    'title', $t$Champs supplémentaires disponibles en modification$t$,
                    'content', $c$| Champ | Description |
| --- | --- |
| Date & heure de déchargement | Date et heure précises du déchargement prévu. S'affiche au format local (ex : « Lundi · 23/06/26 · 08:30 »). Un indicateur J-X est calculé automatiquement |
| Statut | Modifier manuellement le statut de l'arrivage |
| Arrivée Le Havre | Date d'arrivée au port du Havre |
| Notes | Commentaire libre sur l'arrivage |$c$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Alertes dans le formulaire d'édition$t$,
                    'content', $c$**⚠️ Facture manquante** — une bannière rouge s'affiche si le déchargement est prévu dans moins de 7 jours (ou passé) et qu'aucune date de facture n'est renseignée. Le champ *Date facture* est mis en rouge. Saisissez la date pour faire disparaître l'alerte.

**⚠️ Statut mis à jour automatiquement** — une bannière ambre s'affiche si le système a modifié le statut automatiquement. Vous pouvez cliquer sur *OK* pour confirmer, ou choisir un autre statut dans la liste. Toute sauvegarde confirme automatiquement le statut.$c$
                ),
                jsonb_build_object(
                    'id', 's5', 'type', 'text',
                    'title', $t$Indicateur J-X$t$,
                    'content', $c$Quand une date de déchargement est saisie, un indicateur apparaît sous le champ :

- **J-3** : déchargement dans 3 jours
- **J** : déchargement aujourd'hui
- **J+2** : déchargement passé depuis 2 jours

Cliquez sur **Enregistrer** pour sauvegarder les modifications.$c$
                )
            ),
            'published',
            3
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 5 : Exporter le tableau des arrivages en Excel
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Exporter le tableau des arrivages en Excel$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Exporter le tableau des arrivages en Excel$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'content', $c$Deux modes d'export sont disponibles depuis les boutons en haut à droite du tableau : un export complet, et un export filtré par période.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'text',
                    'title', $t$Export complet$t$,
                    'content', $c$Cliquez sur **Exporter**. Le fichier Excel est généré et téléchargé immédiatement. Il contient tous les arrivages, sans filtre de date.$c$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'image',
                    'url', v_img_export,
                    'caption', $t$Le sélecteur de plage de dates, ouvert depuis l'icône calendrier.$t$,
                    'alt', $t$Sélecteur de plage de dates pour l'export par période$t$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Export par période$t$,
                    'content', $c$1. Cliquez sur l'icône calendrier 📅. Un sélecteur de plage de dates s'ouvre.
2. Sélectionnez la plage : cliquez sur la date de début, puis sur la date de fin. La plage sélectionnée est affichée en bas du calendrier.
3. Cliquez sur **Télécharger**.

Seuls les arrivages dont la date de référence (déchargement, ou Le Havre, ou départ) tombe dans la plage sont inclus.$c$
                ),
                jsonb_build_object(
                    'id', 's5', 'type', 'text',
                    'title', $t$Contenu du fichier Excel$t$,
                    'content', $c$| Colonne | Description |
| --- | --- |
| Statut | Libellé du statut |
| Fournisseur | Nom du fournisseur |
| Date facture | En-tête rouge — colonne critique |
| Départ | Date de départ |
| Le Havre | Date d'arrivée au port |
| Mode | Mode de transport |
| N° Conteneur | Numéro BIC |
| Déchargement | En-tête ambre — colonne prioritaire (jour + date + heure) |
| Poids (kg) | Poids total |
| Quantité | Nombre d'unités |
| N° Interne | Référence interne |
| Lieu | Localisation du siège fournisseur |
| Notes | Commentaires libres |

> ℹ️ Le fichier Excel inclut une ligne de total à la fin de chaque mois (poids cumulé). Les colonnes sont pré-filtrées selon vos droits : certaines colonnes peuvent être absentes si votre rôle n'y a pas accès.$c$
                ),
                jsonb_build_object(
                    'id', 's6', 'type', 'text',
                    'title', $t$Nom du fichier$t$,
                    'content', $c$- Export complet : `arrivages_2026-06-16.xlsx`
- Export période : `arrivages_01-06-2026_30-06-2026.xlsx`$c$
                )
            ),
            'published',
            4
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 6 : S'abonner à la newsletter des arrivages
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$S'abonner à la newsletter des arrivages$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$S'abonner à la newsletter des arrivages$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'content', $c$La newsletter des arrivages permet de recevoir par e-mail un état à jour du tableau, sans avoir besoin de se connecter à la Console. L'envoi se déclenche automatiquement dès qu'un arrivage est **ajouté** ou **modifié** (avec un court délai pour regrouper les changements rapprochés).

> ℹ️ La suppression d'un arrivage n'est actuellement pas disponible dans l'application — seuls les ajouts et modifications déclenchent un envoi.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'text',
                    'title', $t$S'abonner$t$,
                    'content', $c$L'abonnement se fait depuis votre **profil** (et non depuis une page d'administration) : une carte *Newsletter Arrivages* y apparaît si vous disposez du droit correspondant.

1. Ouvrez votre profil et repérez la carte *Newsletter Arrivages*
2. Cochez les colonnes que vous souhaitez recevoir dans le fichier Excel joint à chaque e-mail
3. Renseignez le code d'invitation (format `ARV-XXXXXXXX`) qu'un administrateur doit avoir créé au préalable pour vous — sans ce code, l'abonnement n'est pas possible
4. Cliquez sur **S'abonner**

Si vous n'avez pas de code d'invitation, demandez-en un à votre administrateur.$c$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'text',
                    'title', $t$Modifier ses colonnes ou se désabonner$t$,
                    'content', $c$Une fois abonné, revenez sur la même carte dans votre profil : cochez/décochez des colonnes puis cliquez sur **Mettre à jour**, ou cliquez sur **Se désabonner** pour arrêter les envois (le code d'invitation n'est pas redemandé pour ces actions).$c$
                )
            ),
            'published',
            5
        );
    END IF;

    ----------------------------------------------------------------------
    -- Article 7 : Questions fréquentes — Tableau des arrivages
    ----------------------------------------------------------------------

    SELECT id INTO v_article_id
    FROM public.wiki_articles
    WHERE title = $t$Questions fréquentes — Tableau des arrivages$t$ AND category_id = v_arrivages_id;

    IF v_article_id IS NULL THEN
        INSERT INTO public.wiki_articles (category_id, title, sections, status, position)
        VALUES (
            v_arrivages_id,
            $t$Questions fréquentes — Tableau des arrivages$t$,
            jsonb_build_array(
                jsonb_build_object(
                    'id', 's1', 'type', 'text',
                    'title', $t$Je ne vois pas le bouton « Nouvel arrivage »$t$,
                    'content', $c$Ce bouton est masqué si vous ne disposez pas du droit de création. Contactez votre administrateur pour obtenir cette permission.$c$
                ),
                jsonb_build_object(
                    'id', 's2', 'type', 'text',
                    'title', $t$Ma ligne est en rouge mais la facture est bien reçue$t$,
                    'content', $c$Ouvrez l'arrivage (bouton crayon) et renseignez la date de facture dans la section *Facturation*. L'alerte disparaît dès qu'une date est enregistrée.$c$
                ),
                jsonb_build_object(
                    'id', 's3', 'type', 'text',
                    'title', $t$Le statut a changé tout seul$t$,
                    'content', $c$Le système peut mettre à jour certains statuts automatiquement. Un point ambre sur le badge vous indique que ce statut doit être confirmé. Ouvrez l'arrivage et cliquez sur *Enregistrer* pour confirmer.$c$
                ),
                jsonb_build_object(
                    'id', 's4', 'type', 'text',
                    'title', $t$Comment trouver un arrivage d'un mois passé ?$t$,
                    'content', $c$Naviguez vers les pages précédentes du tableau à l'aide des boutons *Précédent / Suivant* ou en cliquant sur les numéros de page.$c$
                ),
                jsonb_build_object(
                    'id', 's5', 'type', 'text',
                    'title', $t$L'export ne contient pas toutes les colonnes$t$,
                    'content', $c$Les colonnes visibles dans l'export dépendent de vos droits d'accès. Certaines colonnes (ex : Notes, Lieu) peuvent être masquées selon votre rôle. Contactez l'administrateur si vous avez besoin d'accéder à des données manquantes.$c$
                ),
                jsonb_build_object(
                    'id', 's6', 'type', 'text',
                    'title', $t$Je ne vois pas la date de déchargement dans le tableau mais elle est renseignée$t$,
                    'content', $c$La date de déchargement est affichée uniquement si elle a été saisie dans le formulaire d'édition. Vérifiez le champ *Date & heure prévues* dans le panneau de modification de l'arrivage concerné.$c$
                )
            ),
            'published',
            6
        );
    END IF;

END $$;
