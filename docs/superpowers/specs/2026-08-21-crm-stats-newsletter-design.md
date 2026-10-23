# Digest mensuel des stats CRM par newsletter

Date : 2026-08-21
Périmètre : front-end (React) + migration Supabase de ce repo uniquement.
Hors périmètre : implémentation de l'endpoint d'envoi côté service Go
(backend séparé, hors de ce repo) — traité comme un contrat d'API à
respecter, pas comme du code à écrire ici.

## Contexte

`ExportStatsButton.tsx` (`src/features/crm/components/Analytics/`) génère
aujourd'hui un export Excel des stats CRM **côté navigateur**, sur clic
utilisateur (`XLSX.writeFile`, téléchargement local). Le besoin est
d'automatiser cet envoi : chaque mois, le même type d'export doit partir
par email vers une liste de destinataires CRM (managers/direction), sans
intervention manuelle.

`NewsletterCrmTab.tsx` (`src/features/crm/components/newsletter-crm/`)
existe déjà comme onglet dans `CrmAdmin.tsx`, mais son contenu actuel
(stat tiles ouverture/clic, liste de campagnes fictives, tableau "Logs S-1")
modélise des campagnes marketing — un concept qui ne correspond pas au
vrai besoin. Ce document remplace entièrement ce contenu par un écran de
configuration du digest mensuel.

L'envoi effectif part d'un service externe qui lit sa configuration
depuis Supabase (même principe que d'autres envois automatisés déjà en
place dans le produit) : ce repo expose la configuration (destinataires +
planification) via deux tables Supabase, et un endpoint HTTP
(`POST {PUBLIC_NEWSLETTER_API_URL}/crm-stats/send`) déclenche un envoi
manuel immédiat. Le contenu exact de l'email (mise en forme des stats) et
la logique de planification/cron sont hors périmètre de ce repo.

## Modèle de données

Deux nouvelles tables Supabase (migration
`supabase/migrations/<timestamp>_crm_stats_newsletter.sql`) :

### `crm_stats_recipients`

Liste des destinataires du digest, gérée depuis l'admin CRM.

| colonne     | type          | contrainte                          |
|-------------|---------------|--------------------------------------|
| id          | uuid          | PK, default gen_random_uuid()        |
| email       | text          | NOT NULL, unique                     |
| full_name   | text          | nullable                             |
| active      | boolean       | NOT NULL default true                |
| created_at  | timestamptz   | NOT NULL default now()               |
| created_by  | uuid          | FK auth.users(id), nullable          |

### `crm_stats_schedule`

Planification, ligne unique (singleton — contrainte `CHECK (id = 1)` sur
une colonne `id smallint PRIMARY KEY DEFAULT 1`, pattern déjà utilisé
ailleurs dans le repo pour des configs à une seule ligne).

| colonne       | type        | contrainte                                        |
|---------------|-------------|-----------------------------------------------------|
| id            | smallint    | PK, CHECK (id = 1)                                   |
| enabled       | boolean     | NOT NULL default false                               |
| day_of_month  | smallint    | NOT NULL default 1, CHECK (1..28)                    |
| send_hour     | smallint    | NOT NULL default 8, CHECK (0..23)                    |
| updated_at    | timestamptz | NOT NULL default now()                               |
| updated_by    | uuid        | FK auth.users(id), nullable                          |

`day_of_month` est borné à 28 pour rester valide tous les mois (évite le
cas des mois à 28/29/30 jours). La migration insère la ligne singleton par
défaut (`enabled = false`).

### Permission

Nouvelle permission `crm.stats_newsletter.admin`, créée dans la même
migration (pattern `INSERT ... WHERE NOT EXISTS`, idempotent), attribuée
aux rôles qui ont déjà accès à `/crm-admin` aujourd'hui (`permissionCode:
"crm.view"` sur la route — à confirmer contre la table `roles` en
implémentation).

### RLS

Sur les deux tables :
- lecture/écriture via `has_permission('crm.stats_newsletter.admin')`
  (fonction déjà existante) ;
- policy `service_role` bypass (`FOR ALL TO service_role USING (true)`)
  pour que le service d'envoi (connexion directe, hors contexte JWT)
  puisse lire `crm_stats_recipients`/`crm_stats_schedule` sans policy
  utilisateur.

## Couche service / hooks

Nouveau fichier `src/features/crm/services/crmStatsNewsletterService.ts` :

```
fetchCrmStatsRecipients(): Promise<CrmStatsRecipient[]>
addCrmStatsRecipient(input: { email: string; fullName?: string }): Promise<CrmStatsRecipient>
removeCrmStatsRecipient(id: string): Promise<void>
toggleCrmStatsRecipient(id: string, active: boolean): Promise<void>

fetchCrmStatsSchedule(): Promise<CrmStatsSchedule>
updateCrmStatsSchedule(input: {
    enabled: boolean
    dayOfMonth: number
    sendHour: number
}): Promise<CrmStatsSchedule>

triggerCrmStatsSend(signal?: AbortSignal): Promise<void>
```

`triggerCrmStatsSend` appelle `POST {PUBLIC_NEWSLETTER_API_URL}/crm-stats/send`
— **contrat d'API proposé, pas encore implémenté côté backend**. Tant que
l'endpoint n'existe pas, l'appel échoue (404/réseau) ; l'erreur est
propagée normalement (pas de mock silencieux), affichée à l'utilisateur
via toast par le hook appelant. Un commentaire dans le service documente
ce statut « en attente du endpoint ».

Types dans `src/features/crm/types.ts` : `CrmStatsRecipient`,
`CrmStatsSchedule`.

Hook `src/features/crm/hooks/CRM_hook/use_crm_stats_newsletter.tsx` — même
pattern que `use_brief_options_admin.tsx` (état local `useState` +
`useEffect` de fetch initial, pas de React Query, aucune lib de data
fetching dans cette feature) :

```
useCrmStatsNewsletter() → {
    recipients, schedule, loading,
    addRecipient, removeRecipient, toggleRecipient,
    updateSchedule,
    send, sending, sendError,
}
```

## UI — `NewsletterCrmTab.tsx`

Remplace entièrement le contenu actuel (stat tiles, `FAKE_CAMPAIGNS`,
tableau "Logs S-1" — tous supprimés). Trois blocs :

1. **Planification** (`Card`) : toggle "Activé", `Select` jour du mois
   (1 à 28), `Select` heure d'envoi, bouton "Enregistrer" désactivé tant
   que rien n'a changé (dirty state classique), toast de confirmation.
2. **Destinataires** (`Card`) : liste (email, nom, badge actif/inactif,
   bouton supprimer par ligne) + formulaire d'ajout (email requis, nom
   optionnel) en pied de carte.
3. **Envoi manuel** : bouton "Envoyer maintenant" (variant outline),
   ouvre un petit dialog de confirmation avant d'appeler `send()` du hook,
   pour éviter un envoi accidentel à toute la liste. Résultat
   (succès/erreur) en toast.

Pas de tableau d'historique des envois dans cette itération : aucune
donnée d'historique n'est disponible côté front tant que le backend
n'expose rien pour ce digest.

## Tests

- `crmStatsNewsletterService.test.ts` : mocks du client Supabase (succès
  + erreur) pour chaque fonction CRUD, et un cas pour `triggerCrmStatsSend`
  qui vérifie l'appel HTTP et la propagation d'erreur.
- `use_crm_stats_newsletter.test.tsx` : suit le pattern des autres tests
  de hooks CRM déjà en place (ex. `use_brief_options_admin` — pas de test
  dédié existant, s'aligner sur `use_client.test.tsx`/`use_tache.test.tsx`
  pour la structure de mock du service).
- Pas de test e2e navigateur pour le bouton d'envoi manuel : son succès
  dépend d'un backend qui n'existe pas encore dans ce périmètre.

## Points ouverts pour l'implémentation

- Rôle(s) exact(s) à attribuer à la permission `crm.stats_newsletter.admin`
  (à vérifier contre la table `roles` existante en implémentation).
