# Salle de tri — `/salle-de-tri`

Feature `src/features/salle-de-tri/` (extraite de `features/stock` le 2026-10-02). Page à part, pas un onglet de `/stock` : elle consomme l'API publique du stock (`ReferentialProvider` monté par le routeur, `useReferentialContext`, `GESTION_THEME`, `EntityTimeline`, erreurs CRUD) et écrit dans le même journal (`activity_log`, consultable dans Stock → Historique). Route gatée sur `stock.tri.view` + `requireMfa`. La lecture des fournisseurs et catégories lui est ouverte par `20261001120000_stock_referentiels_lecture_tri_commandes.sql`.

Historique des **feuilles de tri** saisies par le responsable de la salle de tri. Permissions `stock.tri.view|create|update|delete` (`TRI_PERMISSIONS`, sans backfill). Migration `20261001100000_stock_tri.sql`.

## Modèle

| Niveau | Contenu |
|---|---|
| Fiche | trieur, date, heure de début et de fin (facultatives mais entières, fin > début) ; `duree_minutes` **dérivée** par la base |
| Balle (`fiches_tri_balles`) | une ligne de la feuille : **fournisseur**, catégorie, **poids initial**, qualité 1-3★, note |
| Répartition (`fiches_tri_repartition`) | kilos de la balle par type de sortie (MAG, KS, SO3, EXPORT… — référentiel `tri_sorties`) |

Le **fournisseur est celui de la balle**, pas de la fiche : une séance trie des balles de plusieurs fournisseurs, et la qualité 1-3★ de chaque balle sert à juger ce qu'envoie chacun (statistiques « Par fournisseur », balle par balle, sans kg/h puisque le temps appartient à la fiche). `v_fiches_tri` expose `fournisseur_ids` et `fournisseurs_noms`.

Une balle de 100 kg de pantalons se **répartit** entre les sorties : ce n'est pas un choix d'une sortie par ligne. Un **écart** entre poids initial et total réparti est admis (pesée, perte, part oubliée) : il est montré pendant la saisie, **ne bloque jamais** l'enregistrement, et ressort en avertissement sur la fiche, dans le tableau, les indicateurs et les statistiques. Seuil : 0,01 kg (`TRI_ECART_SEUIL_KG`, le même que les vues SQL).

Totaux jamais stockés : `v_fiches_tri_balles` (réparti, écart par balle) et `v_fiches_tri` (poids initial, réparti, écart, nb de balles, nb de balles en écart, qualité pondérée par le poids initial).

## Écriture

Uniquement par la RPC `save_fiche_tri(p_fiche, p_balles)` — une transaction (en-tête, balles, répartition), une entrée de journal par enregistrement (diff de l'en-tête + phrase par balle « 100 kg Pantalons ★★ → MAG 60 · KS 30 · SO3 6 (écart -4 kg) »). La RLS n'ouvre en direct que la suppression, journalisée par un trigger `BEFORE DELETE`.

## Interface

- **Saisie** (`FicheTriSheet`, `size="xl"`) : en-tête trieur / date / fournisseur / horaires (deux sélecteurs d'heure, durée affichée), puis une carte par balle (`BalleCard`) : catégorie, poids initial, qualité, un champ kg par type de sortie actif (ordre du référentiel), jauge de répartition (`RepartitionGauge`), note. Totaux en direct collés au pied. Clavier : `Entrée` avance de champ en champ et ouvre une nouvelle balle depuis la note de la dernière ; qualité aux touches 1-3.
- **Affichage des fiches** : liste (tableau groupé par jour) ou cartes (`FicheTriCard`, dans l'esprit des cartes de balles du stock : poids trié en gros, trieur, barre de répartition, fournisseurs, balles, qualité, durée, pastille d'écart). Bascule dans la barre de filtres, préférence gardée dans le navigateur (pas dans l'URL).
- **Vues (`?vue=`)**, déclarées dans le registre `VUES` de `TriBoard` (ajouter une vue = une entrée + son id dans `TRI_VUES`) : `fiches` (tableau groupé par jour), `statistiques`, `referentiel` (trieurs et types de sortie en listes compactes côte à côte, ajout en ligne, actif/inactif, réordonnancement des types — l'ordre fixe la colonne de saisie et la couleur).
- **Indicateurs** (`TriKpis`) au-dessus des fiches et des statistiques, sur la sélection filtrée ; la tuile des écarts filtre les fiches concernées. Sous chacun, sa **tendance** par rapport à la période précédente de même durée, aux mêmes filtres (`previousPeriod`, `compareTotals`) : ces fiches-là sont chargées à côté par `TriContext`, sans retarder la page ni signaler d'erreur, et rien n'est affiché pour « Tout ».
- **Filtres** à deux niveaux (`utils/triAnalytics.ts`) : en-tête (trieur, période, recherche, fiches en écart) et balle (fournisseur, catégorie, qualité minimale, type de sortie — ne garde que la part partie vers ce type).
- **Statistiques** : en tête, « Où partent les kilos » (part et kilos de chaque type sur la sélection) ; graphe par semaine en kilos ou en parts (100 % empilé).
- **Premier lancement** (`TriOnboarding`) : tant qu'il n'y a ni type de sortie ni trieur actif, la vue Fiches affiche les étapes à préparer à la place d'un tableau vide, et « Nouvelle fiche » renvoie vers « Trieurs et types » au lieu d'ouvrir une saisie qui ne peut pas aboutir.
- **URL :** `/salle-de-tri/new` ouvre la saisie, `/salle-de-tri/{id}` la fiche résumé (lue à l'unité si hors de la période chargée). Depuis la fiche résumé, ‹ › et les flèches ← → passent à la fiche voisine **dans l'ordre affiché, filtres compris** (navigation en `replace` : le retour arrière ferme la fiche au lieu de rejouer chaque fiche vue). Une fiche ouverte hors de la liste n'a pas de voisines.
- **Responsive** : pensé tablette + PC (saisie confortable dès 768 px), téléphone en consultation. Indicateurs sur une ligne à partir de `lg`, sinon poids trié en pleine largeur puis deux par deux ; filtres qui passent à la ligne ; boutons de 36 px au doigt, 32 px à partir de `md`.
- **Export Excel** (`utils/triExport.ts`) au format de la feuille papier : une ligne par balle, une colonne de kilos par type de sortie, écart.

## Base de dev

La migration a été réécrite en place le 2026-10-02 (la première version — une ligne = un seul type de sortie — n'était appliquée qu'en dev). Pour mettre une base de dev à jour : exécuter `supabase/seed/dev_reset_salle_de_tri.sql` (supprime fiches et vues de tri, garde trieurs et types), puis le contenu de la migration. Aucun `migration repair` : la version reste la même.

## Données de démonstration

`supabase/seed/dev_demo_salle_de_tri.sql` (dev / démo uniquement, après la migration) : 6 trieurs, ~40 fiches sur les 8 dernières semaines, ~10 % de balles en écart, une qualité propre à chaque fournisseur. Rejouable : il remplace les fiches **sans auteur** (`created_by IS NULL` — toute saisie par l'application en a un) et recale les dates sur le jour d'exécution, à relancer donc la veille d'une présentation. Prérequis : au moins un fournisseur et une catégorie dans le stock.

## Limite assumée de la V1

Le tableau catégorie × type est un CUMUL de ce qui a été trié, pas un stock — les sorties de la salle de tri ne sont pas tracées.
