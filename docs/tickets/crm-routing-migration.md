# Aligner le routing CRM sur le modèle Administration/Stock

## Contexte

`docs/ROUTING.md` documente le modèle recommandé pour les features à onglets/deep-links : URL comme unique source de vérité, dérivée par `useParams`, sans duplication d'état. `src/features/administration` et `src/features/stock` (onglet Arrivages) suivent ce modèle.

`src/features/crm/routes/SinglePageCRM.tsx` (route `/crm/:section?/:detail?`) résout le même problème mais avec une architecture plus ancienne :

- Triple source de vérité pour l'onglet actif : `CRMContext.activeTab` (state React) + `localStorage` + URL, synchronisées manuellement.
- ~6 `useEffect` couplés bidirectionnels (un effet URL→état, un effet état→URL avec arbitrage push/replace via `isCanonicalCrmPath()`), plus un fallback legacy `?tab=xxx`.

Ça fonctionne en production et n'est pas cassé — ce n'est donc pas une urgence — mais c'est plus difficile à faire évoluer sans risquer une boucle d'effets ou une désynchronisation entre les trois sources, et ça diverge de la convention désormais établie ailleurs dans l'app.

## Périmètre proposé

1. Remplacer `CRMContext.activeTab` (state + `localStorage`) par une dérivation directe de `useParams().section` dans `SinglePageCRM.tsx`, comme `Administration.tsx`/`Stock.tsx`.
2. Réduire les ~6 `useEffect` de synchronisation à un seul effet de garde uni-directionnel (URL → redirection si invalide), en s'inspirant du modèle `FlowBoard.tsx` pour la fiche client (`/crm/client/{id}` → état dérivé, pas de `useState` dupliqué).
3. Décider si le fallback `?tab=xxx` (compat notifications historiques, voir `supabase/migrations/20260624120000_crm_notifications_urls.sql`) peut être retiré, ou doit être conservé plus longtemps (vérifier si des notifications encore non lues en base pointent vers l'ancien format avant de le retirer).

## Non-objectif

Ne pas toucher au contrat d'URL `/crm/:section?/:detail?` lui-même (déjà correct et déjà utilisé par les notifications CRM) — seulement la mécanique interne de synchronisation.

## Statut

Non planifié — ticket de suivi, pas de date cible.
