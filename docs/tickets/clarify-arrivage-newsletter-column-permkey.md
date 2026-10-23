# Clarifier le permKey `stock.arrivage.newsletter.<permKey>` (visibilité de colonne)

**Type :** amélioration / dette technique (naming) — pas un bug fonctionnel
**Priorité suggérée :** basse (pas d'impact utilisateur actuel)
**Trouvé en corrigeant la doc "Tableau des arrivages" (juillet 2026)**

## Contexte

Le permKey `stock.arrivage.newsletter.<permKey>` (où `<permKey>` est une clé de colonne comme `internal_ref`, `fournisseur_lieu`, `status`...) est utilisé à l'identique dans **deux fichiers** :

- `src/features/stock/components/flow/ExportArrivageButton.tsx:295` — filtre les colonnes visibles dans l'export Excel manuel.
- `src/features/profile/hooks/data/useNewsletterSubscription.ts` — filtre les colonnes qu'un abonné peut choisir de recevoir par e-mail (catalogue `NEWSLETTER_COLUMNS` + préfixe `NEWSLETTER_COLUMN_PERMISSION_PREFIX` dans `src/features/profile/constants.ts`).

Les deux fichiers définissent exactement le même jeu de clés de colonnes (`status`, `fournisseur_name`, `fournisseur_lieu`, `transport_mode`, `container_no`, `internal_ref`, `departure_date`, `port_arrival_date`, `prev_dechargement_at`, `invoice_date`, `total_weight_kg`, `total_qty`, `notes`). Ce n'est donc pas une collision accidentelle : c'est **une seule permission de sensibilité par colonne, volontairement partagée entre les deux canaux de diffusion** (export manuel et newsletter par e-mail).

**Le nom est cependant trompeur** : `stock.arrivage.newsletter.<permKey>` laisse penser qu'il ne concerne que la newsletter, alors qu'il gouverne aussi l'export Excel — d'autant que la même famille de permissions contient déjà `stock.arrivage.newsletter.admin` et `stock.arrivage.newsletter.send`, qui elles sont réellement spécifiques à la newsletter (page admin, renvoi manuel).

## Ce qu'il ne faut PAS faire

Ne pas renommer uniquement dans `ExportArrivageButton.tsx` (ex. en `stock.arrivage.export.<permKey>`) sans traiter le catalogue de `features/profile/constants.ts` en même temps : cela casserait le partage de permission — un rôle actuellement autorisé à voir une colonne sensible dans les deux canaux perdrait cet accès dans l'un des deux sans qu'on s'en rende compte.

## Pistes d'action (à arbitrer par l'équipe dev/produit)

1. **Ne rien changer, documenter seulement** — c'est ce qui a été fait dans `docs/flow-limited-technical.md` (§3.5, §3.7, §5) : le nom reste `newsletter.<permKey>` mais son usage partagé est maintenant explicite dans la doc. Option la plus sûre, aucun risque de régression.
2. **Renommer vers un nom neutre** (ex. `stock.arrivage.column.<permKey>` ou `stock.arrivage.field.<permKey>`), en modifiant les deux fichiers en même temps :
   - `ExportArrivageButton.tsx:295`
   - `src/features/profile/constants.ts` (`NEWSLETTER_COLUMN_PERMISSION_PREFIX`)
   - Vérifier comment ces permKeys sont provisionnés aujourd'hui : ils n'apparaissent dans **aucune migration `supabase/migrations/*.sql`** trouvée (pas d'`INSERT INTO public.permissions` pour `stock.arrivage.newsletter.<col>`), contrairement à d'autres permissions de la feature (`stock.arrivage.packing.import`, `stock.arrivage.newsletter.send`) qui, elles, sont cataloguées. À clarifier avant tout renommage : sont-elles accordées via `role_permissions` sans entrée dans `public.permissions`, ou existe-t-il un mécanisme de provisioning différent (ex. wildcard, JSON legacy — voir `20260225_migrate_roles_permissions_from_json.sql`) ? Si un renommage est fait, il faut migrer les grants existants vers les nouvelles clés pour ne pas faire disparaître silencieusement l'accès de rôles qui l'ont déjà.

## Fichiers à consulter
- `Nokk_project/src/features/stock/components/flow/ExportArrivageButton.tsx`
- `Nokk_project/src/features/profile/constants.ts` et `Nokk_project/src/features/profile/hooks/data/useNewsletterSubscription.ts`
- `Nokk_project/docs/flow-limited-technical.md` (§3.5, §3.7, §5 — documentation à jour de ce comportement)
