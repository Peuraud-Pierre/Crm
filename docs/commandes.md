# Commandes boutiques — `/commandes`

Feature `src/features/commandes/` (extraite de `features/stock` le 2026-10-02, refondue le 2026-10-05). Elle consomme l'API publique du stock (`ReferentialProvider` / `useReferentialContext` pour les **catégories**, `GESTION_THEME`, `EntityTimeline`, erreurs CRUD). Constantes et permissions dans `constants.ts` (`COMMANDES_PERMISSIONS`, `COMMANDES_ROUTE`, configurations de statut).

C'est une page à part, pas un onglet de `/stock`. Route gatée sur `stock.commandes.view` + `requireMfa`. Les notifications SQL écrivent des liens `/commandes/{id}?vue=…` : ne pas renommer ces URL sans reporter le changement dans `20261001110000_stock_commandes.sql`.

Circulation entrepôt → boutiques affiliées. Migration `20261001110000_stock_commandes.sql` ; elle remplace d'elle-même le premier modèle (articles, pastilles) si elle le trouve en base. Données d'essai : `supabase/seed/dev_demo_commandes.sql`. Spécification de la V2 (console retail) : `docs/commandes-retail.md`.

## Modèle

- **Hiérarchie :** commande → livraisons **partielles** → palettes → cartons. Une commande, c'est une boutique et des **kilos BRUTS par catégorie de vêtements** (les catégories du stock, `categories_gestion`). Brut veut dire les vêtements seuls, sans cintre ni antivol. **Une catégorie par carton.**
- **Pas de catalogue d'articles, d'EAN ni de prix.** Le code couleur et le prix au kilo dépendent du type de boutique : ils relèvent de la boutique, pas de cet outil. Les écarts se comptent en **kg**.
- **Avancement et totaux dérivés** (`v_commande_avancement`, `v_commandes_boutique`, `v_livraisons_boutique`, `v_cartons`) : demandé, préparé, en transit, reçu, manquant, reste, kg en écart. Rien n'est stocké en double.
- **Statuts par RPC uniquement** (`expedier_livraison`, `receptionner_carton`, `cloturer_livraison`, `cloturer_commande`). Un trigger refuse tout changement de statut direct, sauf l'annulation d'une livraison qui n'est pas partie. Le contenu est figé par la RLS après l'expédition.
- **Codes :** `CMD-0017`, `LIV-0042`, `LIV-0042-P2`, `LIV-0042-C07` (le QR de l'étiquette carton, `utils/commandeCode.ts`). Le code d'un carton ne contient pas sa palette. Le QR porte un code **lisible**, pas une URL : la console retail lira la même étiquette.
- **Réception** : on scanne le QR du carton, on pèse si l'on veut (sans pesée, le prévu fait foi), et l'on signale ce qui se voit (*carton abîmé*, *pas la bonne catégorie*). Le verdict est calculé par la base, dans cet ordre : endommagé > mauvaise catégorie > écart de poids au-delà de 2 % > conforme. À la clôture, les cartons non scannés sont déclarés manquants, puis la livraison passe en `receptionnee` ou en `litige`.

## Permissions

| Code | Rôle |
|---|---|
| `stock.commandes.view` | Ouvre la page (lecture). **La boutique la détient aussi.** |
| `stock.commandes.manage` | Espace entrepôt : boutiques, commandes, préparation, expédition, clôture d'un reliquat |
| `stock.commandes.boutique` | Espace boutique : passer ses commandes (créer, modifier ou annuler tant qu'elles sont `ouverte` et sans livraison, RLS `commande_modifiable_boutique`), réceptionner, clôturer une réception |

## Deux espaces sur une même page

L'espace se déduit de la vue (`?vue=`). Une vue inconnue, ou qui appartient à un espace fermé, retombe sur la vue par défaut sans redirection (`utils/commandeVues.ts`). Le contrôle « Entrepôt | Boutique » ne s'affiche qu'à qui détient les deux rôles.

| Espace | Vues | Cible |
|---|---|---|
| Entrepôt | `a-faire` (par défaut) · `commandes` · `livraisons` · `planning` · `boutiques` | PC, tablette |
| Boutique | `accueil` « À recevoir » (par défaut) · `reception` · `mes-commandes` | téléphone d'abord, tablette |

**Parcours (2026-10-05, d'après Ethan).** Aujourd'hui la commande arrive **par mail** : l'entrepôt la saisit, la prépare, l'expédie ; la boutique sert d'abord à **réceptionner au QR et valider la livraison**. La commande passée par la boutique elle-même viendra avec le stock boutique.

- **À faire** (`utils/fileDeTravail.ts`) : file de travail en quatre étapes — à préparer, en préparation, en route, à régler — chaque carte porte son action suivante ; « Saisir une commande » est le premier bouton.
- **Préparer = un clic** (`preparerCommande`) : la livraison est créée avec des dates par défaut et s'ouvre ; sa fiche montre le fil Remplir → Étiqueter → Expédier → Réception (`LivraisonSteps`) et le bouton de l'étape courante. `LivraisonFormSheet` ne sert plus qu'aux livraisons hors commande.
- **Réception** : cartons cochés au fil des scans (`ReceptionChecklist`), écran de fin « Livraison validée » ou « écarts signalés ».

- **Le `detail`** désigne une commande dans `commandes` et `mes-commandes`, une livraison dans `livraisons` et `reception`, l'une ou l'autre dans `a-faire` et `planning` (UUID : pas de confusion possible).
- **Identité boutique simulée en V1** (`hooks/ui/useBoutiqueCourante.ts`) : un sélecteur « Vous êtes la boutique… », retenu en `localStorage` (`commandes.boutique`). Un lien profond impose sa boutique. En V2, la boutique viendra du compte.
- **Mise en page de l'espace boutique :** colonne centrée, cibles de 48 px et plus, onglets fixés en bas sur téléphone (`BoutiqueTabBar`), bascule de vues au-dessus de `md`.
- **Distribution :**
  - realtime sur toutes les tables ;
  - une **nouvelle commande** notifie `manage` ;
  - une **expédition** notifie `boutique` (lien vers la réception) ;
  - un litige, une réception ou une commande soldée notifie `manage`.
- **Impression :** étiquettes cartons (catégorie et poids en gros, plus le QR) et palettes (`shared/utils/qrLabelSheet`), bordereau A4 (`utils/commandeLabels.ts`).
