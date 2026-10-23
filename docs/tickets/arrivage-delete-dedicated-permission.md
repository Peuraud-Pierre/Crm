# Créer un permKey dédié pour la suppression d'un arrivage

**Type :** produit / sécurité (durcissement des permissions)
**Priorité suggérée :** moyenne — pas d'incident connu, mais écart par rapport au principe de moindre privilège
**Trouvé en corrigeant la doc "Tableau des arrivages" (juillet 2026)**

## Contexte

La suppression d'un arrivage n'est protégée par **aucune permission dédiée**. Elle est possible uniquement au niveau des policies RLS Postgres :

- `arrivage_manuel_delete` — `Nokk_project/supabase/migrations/20260521_arrivage_manuel.sql:79`
- `arrivage_state_delete` — `Nokk_project/supabase/migrations/20260421121000_arrivages_rls.sql:200`

Les deux policies (déjà en production) exigent :
```sql
has_permission('stock.view'::text)
AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
```

C'est-à-dire : la même permission que la simple **lecture** (`stock.view`), plus une exigence de session ré-authentifiée en AAL2 (ex. MFA). Il n'existe pas de `stock.arrivage.delete` (ou équivalent), et aucun bouton de suppression n'est exposé dans l'UI (`FlowBoard.tsx`, `ArrivageLimitedTable.tsx`) — la fonction `deleteArrivage` (`useShipment.ts:140`, exposée via `ShipmentContext.tsx:108`) n'est donc appelable qu'en dehors du parcours UI standard (ex. appel direct API/DB par un utilisateur authentifié avec AAL2).

**Concrètement** : toute personne ayant accès en lecture au module Stock et une session AAL2 peut aujourd'hui supprimer un arrivage, sans qu'un rôle distinct ne soit nécessaire pour cette action destructive.

## Action proposée

1. Créer un permKey dédié, par exemple `stock.arrivage.delete`, et l'enregistrer dans `public.permissions` (voir le pattern utilisé par `supabase/migrations/20260703120000_newsletter_send_permission.sql` pour la structure d'une migration de ce type).
2. Modifier les deux policies RLS pour exiger ce nouveau permKey en plus de (ou à la place de) `stock.view` :
   - `arrivage_manuel_delete` (`20260521_arrivage_manuel.sql`)
   - `arrivage_state_delete` (`20260421121000_arrivages_rls.sql`)
3. Décider si l'exigence AAL2 doit être conservée en plus du nouveau permKey (recommandé — défense en profondeur) ou si le nouveau permKey suffit.
4. Décider si une UI de suppression doit être exposée (actuellement absente) ou si cette capacité doit rester réservée à un usage admin/support hors UI.
5. Attribuer le nouveau permKey aux rôles qui doivent conserver la capacité de suppression, avant de retirer l'accès basé sur `stock.view` — pour éviter de bloquer un usage existant sans transition.

## Fichiers à modifier
- `Nokk_project/supabase/migrations/` — nouvelle migration pour le permKey + policies mises à jour
- `Nokk_project/docs/flow-limited-technical.md` (§5) — documentation à jour de ce comportement, à corriger une fois le fix appliqué
