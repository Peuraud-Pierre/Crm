-- Aligne les colonnes groupe_id et group_id pour les messages existants

update public.messages
set groupe_id = group_id
where groupe_id is null
  and group_id is not null;

update public.messages
set group_id = groupe_id
where group_id is null
  and groupe_id is not null;
