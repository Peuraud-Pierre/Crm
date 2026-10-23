# Salle de commande — V1 livrée, V2 avec la console retail

Document de travail pour l'échange avec le **responsable du service commande** : ce que fait la V1 (présentée pour valider une direction), ce qu'il faut décider ensemble, et le branchement prévu avec la console retail. Code : `src/features/commandes/`, migration `supabase/migrations/20261001110000_stock_commandes.sql`, doc technique `docs/commandes.md`.

---

## 1. Le problème

Aujourd'hui, une personne valide **en bloc** la réception d'une commande en boutique. Un carton manquant, une autre catégorie que celle annoncée, un poids qui ne correspond pas : rien ne le rattrape, et l'erreur se paie en logistique (renvois) et en finance (avoirs, valeur de stock fausse).

L'outil vise à devenir **la source de vérité** de ce qui part de l'entrepôt et de ce que chaque boutique reçoit réellement, carton par carton.

## 2. Ce que fait la V1

| Étape | Qui | Dans l'outil |
|---|---|---|
| Commande | **Boutique** (ou service commande pour elle) | Une boutique, une date souhaitée, des **kilos bruts par catégorie** de vêtements (sans cintre ni antivol) ; modifiable par la boutique tant que rien n'est préparé |
| Préparation | Entrepôt | Une ou plusieurs **livraisons partielles** ; chacune se remplit en palettes → cartons (une catégorie par carton) ; le « reste à servir » de la commande est proposé, découpé en cartons de 25 kg |
| Étiquetage | Entrepôt | Étiquette logistique **QR** par carton (`LIV-0042-C07`), étiquette palette, bordereau A4 à signer |
| Expédition | Entrepôt | Le contenu est figé, la boutique est prévenue |
| Réception | Boutique (simulée dans nokk_project en V1, au téléphone) | Scan du **QR du carton** ; pesée facultative ; « carton abîmé » / « pas la bonne catégorie » ; verdict calculé par la base |
| Clôture | Boutique ou entrepôt | Les cartons jamais scannés deviennent **manquants** ; la livraison est **réceptionnée** ou en **litige** |
| Supervision | Service commande | Planning boutique × jour, retards, litiges, **kilos en écart** |

Les verdicts de réception :

| Constat | Verdict | Compté en écart |
|---|---|---|
| Rien de signalé, poids dans ±2 % (ou pas de pesée) | conforme | 0 |
| Poids hors ±2 % | écart de poids | \|prévu − reçu\| kg |
| « Pas la bonne catégorie » déclaré | mauvaise catégorie | tout le carton |
| « Carton abîmé » déclaré | endommagé | tout le carton |
| Jamais scanné à la clôture | manquant | tout le carton |

Les écarts se comptent en **kilos**. Le code couleur et le prix au kilo dépendent du type de boutique : ils restent hors de l'outil (révision du 2026-10-05).

## 3. Questions pour le service commande

1. **Fractionnement.** Comment découpe-t-on une commande aujourd'hui : par catégorie, par date, par camion, par palette pleine ? La V1 ne fait que « préparer une livraison avec ce qui reste » ; l'interface souple se dessinera sur votre réponse.
2. **Planning.** Qui fixe les dates de préparation / expédition / arrivée ? Y a-t-il des tournées fixes par boutique ?
3. **Tolérance de poids.** ±2 % est repris des packing lists fournisseurs. Est-ce la bonne valeur pour un carton de 25 kg ?
4. **Reliquat.** Un reste non servi est-il re-commandé, reporté sur la commande suivante, ou annulé ? (La V1 permet de le clôturer avec un motif.)
5. **Écarts.** Qui traite un litige, et comment : renvoi, avoir, régularisation de stock ?
6. **Qui est prévenu de quoi ?** V1 : expédition → boutiques ; litige, réception, commande soldée → service commande.
7. **Catégories commandables.** Toutes les catégories du stock sont-elles commandables par toutes les boutiques, ou faut-il une liste par boutique (ou par type de boutique) ?
8. **Contenu d'un carton.** Toujours une seule catégorie ? (Hypothèse de la V1.)

## 4. V2 — brancher la console retail

La console retail (`../retail`, Go hexagonal + Postgres propre) a déjà les briques d'arrivée : `shops`, `shop_products`, `shop_stock_movements` (type `reception`), `shop_purchase_orders` (champ `source`). Elle expose `/api/v1/external/*` à nokk_project (JWT Supabase), aujourd'hui pour les tickets.

### 4.1 Préalable de sécurité — à faire AVANT tout le reste

`ExternalJWTAuthMiddleware` (`backend/internal/adapters/handlers/middleware.go`) accorde **`RoleAdmin` à tout porteur d'un JWT Supabase valide**. Acceptable pour les tickets ; pas pour des réceptions et des mouvements de stock. Il faut un périmètre dédié : un rôle `external_platform` limité aux routes `/external/shipments*`, et l'identité nokk_project conservée pour l'audit.

### 4.2 Contrat proposé

| Sens | Route | Rôle |
|---|---|---|
| nokk_project → retail | `GET /api/v1/external/shops` | Rapprocher `boutiques.retail_shop_id` des `shops.id` |
| nokk_project → retail | `POST /api/v1/external/shipments` | À l'**expédition** : pousser le manifeste (livraison, palettes, cartons, catégorie, kg brut) |
| boutique → retail | `POST /api/v1/shops/:shopId/shipments/:id/cartons/:code/receive` | Réception carton par carton depuis la console retail (même verdict qu'en V1) |
| retail → nokk_project | webhook signé, ou `GET /api/v1/external/shipments/:id` en pull | Remonter les réceptions vers `cartons` (via une RPC dédiée, jamais un UPDATE direct) |

Une réception **conforme** devient côté retail un `shop_stock_movements(type = 'reception', source = 'nokk_project', quantity = kg)` sur la catégorie reçue (la boutique y applique son code couleur et son prix) : c'est le premier pas vers le **stock boutique numérisé**.

### 4.3 Ce que la V1 a préparé

- `boutiques.retail_shop_id` (clé de rapprochement, unique) ;
- le QR porte un **code lisible**, pas une URL nokk_project : la même étiquette sera lue par la console retail ;
- le verdict est calculé **en base** (`receptionner_carton`) : la console retail n'aura pas à réimplémenter la règle, seulement à l'appeler (ou à la répliquer à l'identique, testée sur `utils/commandeAvancement.ts`).

## 5. Feuille de route possible

1. **V1 (présentée)** — circuit complet dans nokk_project, réception simulée.
2. **V1.1** — retours du service commande : fractionnement, tolérance, notifications, codification.
3. **V2** — sécurité de l'API externe, manifeste poussé à la console retail, réception en boutique dans la console retail.
4. **V3** — stock boutique alimenté par les réceptions, ventes au poids par code couleur de la boutique, tendances par famille / saison / boutique, réassort suggéré.
