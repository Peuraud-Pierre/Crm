-- Resserrement de la policy INSERT de `public.cryptedmessage`.
--
-- 20260907120000_cryptedmessage_rls_consolidation.sql ne vérifiait plus que
-- l'identité de l'émetteur. Test RLS du 07/09/2026 (rôle `authenticated`,
-- transaction annulée) : l'insertion dans `group:<uuid>` d'un groupe dont le
-- compte n'est PAS membre réussissait.
--
-- L'impact restait une nuisance, pas une fuite : le message est chiffré avec
-- une clé absente des `key_wraps` des membres, donc indéchiffrable pour eux.
-- Mais il apparaît dans leur fil, et rien ne limite le volume.
--
-- On restaure donc la vérification d'appartenance de
-- 20260302000000_cryptedmessage_groups.sql, sous une forme qui couvre aussi
-- le 1-à-1 (l'ancienne policy groupe ne s'appliquait qu'aux `chat_id`
-- préfixés `group:` et laissait le reste à une policy séparée).

drop policy if exists "cryptedmessage_insert" on public.cryptedmessage;

create policy "cryptedmessage_insert"
on public.cryptedmessage
for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
  and (
    chat_id not like 'group:%'
    or cmg_is_member(
      (replace(chat_id, 'group:', ''))::uuid,
      (select auth.uid())
    )
  )
);
