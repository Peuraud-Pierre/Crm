# Newsletter clients (sujet + message)

Date : 2026-10-14
Périmètre : deux repos.
- `Nokk_project` : migration Supabase, feature front `client-newsletter`,
  case d'opt-in sur la fiche client, entrée sidebar.
- `newsletter-console` (service Go voisin) : routes d'envoi, de test et de
  désinscription.

## Contexte et objectif

Les commerciaux veulent envoyer une newsletter aux **clients du CRM**
(`client_crm`), rédigée comme un mail : un sujet et un message. Il n'existe
aujourd'hui aucune notion d'abonnement côté client, et aucune route d'envoi
de mail libre (`newsletter-console` n'envoie que le tableau arrivages et
les stats CRM, en pièce jointe Excel).

Décisions validées avec Alex :
- Opt-in porté par un booléen sur `client_crm`, **`false` pour tous** au
  départ (existants et nouveaux) — le commercial coche client par client.
- Page dédiée « Newsletter » dans la catégorie **Commercial** de la sidebar.
- **Lien de désinscription en un clic** dans chaque mail (jeton signé).
- Logique d'envoi dans `newsletter-console` (approche A) : le serveur calcule
  lui-même la liste des destinataires, le front ne fournit que sujet + message.
- Message texte brut, mis en forme dans un gabarit HTML de marque.
- Seule l'adresse `mail` est utilisée (pas `mail_2`).
- Envoi de test vers soi-même, confirmation avec le nombre de destinataires,
  historique des envois.

## 1. Données (migration Supabase, Nokk_project)

Migration `supabase/migrations/20261014120000_client_newsletter.sql`,
idempotente :

1. `client_crm` :
   - `newsletter boolean NOT NULL DEFAULT false`
   - `newsletter_updated_at timestamptz NULL` — trace du consentement
     (dernière bascule, manuelle ou par désinscription).
   - Index partiel `client_crm_newsletter_idx ON client_crm (id) WHERE newsletter`.
2. Table `client_newsletter_sends` :
   | colonne | type | note |
   |---|---|---|
   | `id` | uuid PK default `gen_random_uuid()` | |
   | `subject` | text not null | |
   | `message` | text not null | |
   | `sent_by` | uuid not null | `auth.users.id` de l'auteur |
   | `status` | text not null | `sending` · `done` · `failed` (check) |
   | `recipient_count` | int not null default 0 | |
   | `sent_count` | int not null default 0 | |
   | `failed_count` | int not null default 0 | |
   | `error` | text null | erreur globale si `failed` |
   | `created_at` | timestamptz not null default now() | |
   | `finished_at` | timestamptz null | |
   - Index unique partiel `ON client_newsletter_sends ((true)) WHERE status = 'sending'`
     : garantit en base qu'un seul envoi est en cours.
   - RLS activée. `SELECT` autorisé si
     `user_has_permission(auth.uid(), 'newsletter_clients.send')`.
     Aucune policy d'écriture : seul le service Go (connexion
     service_role) écrit.
3. Permission `newsletter_clients.send` — « Envoyer la newsletter clients »,
   catégorie `crm`. **Créée sans octroi automatique** : elle s'attribue via
   l'UI rôles/services existante, pour qu'aucun commercial ne puisse arroser
   la base par défaut.
4. RLS `client_crm` : l'UPDATE de `newsletter` passe par les policies
   existantes de `client_crm` (le commercial édite déjà la fiche). À vérifier
   à l'implémentation ; si elles bloquent, ajouter une policy dédiée gardée
   par `crm.view`.

Après la migration : régénérer `src/integrations/supabase/types.ts`.

## 2. Service Go `newsletter-console`

Nouveau package `internal/clientnews` (handler, token, template, sender).

### Configuration
- `CLIENT_UNSUB_SECRET` (obligatoire) — clé HMAC des liens de désinscription.
- `PUBLIC_BASE_URL` (obligatoire) — URL publique du service, pour construire
  les liens. Ajoutées à `config.Config` et à `.env.example`.

### `GET /clients/newsletter/recipients`
- Mêmes middlewares que l'envoi. Répond `200 { "count": n }` : nombre de
  destinataires après filtre et dédoublonnage (identique à l'envoi réel).

### `POST /clients/newsletter/send`
- Middlewares : `authMW` + `RequirePermission(pool, "newsletter_clients.send")`.
- Corps JSON `{ "subject": string, "message": string }`.
  Validation : trim ; sujet 1–200 caractères, message 1–20 000 → sinon `400`.
- Destinataires : `SELECT id, mail FROM client_crm WHERE newsletter AND
  coalesce(trim(mail), '') <> ''`, filtrés par `net/mail.ParseAddress`,
  dédoublonnés par email (insensible à la casse ; on garde le premier `id`).
- `recipient_count = 0` → `400` « aucun client abonné ».
- Insère la ligne `client_newsletter_sends` (`status = sending`). Violation de
  l'index unique → `409` « un envoi est déjà en cours ».
- Répond **`202 { "id": uuid, "recipient_count": n }`**, puis envoie en
  goroutine sur un contexte détaché de la requête (annulé à l'arrêt du
  service), avec un timeout de 60 s **par mail** (pas de plafond global, la
  durée dépend du nombre d'abonnés) et une pause `SendDelayMs` entre chaque
  mail. Au démarrage du service, toute ligne restée `sending` (crash, redéploiement)
  passe à `failed` avec `error = 'interrompu'`, pour libérer l'index unique.
- Met à jour `sent_count` / `failed_count` au fil de l'eau (tous les 10 mails), puis `status = done` (`failed` si erreur
  globale, ex. timeout), `finished_at = now()`.
- Logs `slog` comme `internal/crm` (emails tronqués/ids courts).

### `POST /clients/newsletter/test`
- Mêmes middlewares, même corps et validation.
- Envoie un unique mail à l'adresse de l'utilisateur connecté (claim `email`
  du JWT ; à défaut `profiles`). Lien de désinscription factice
  (`PUBLIC_BASE_URL/clients/newsletter/unsubscribe?token=test`).
- Pas d'écriture en historique. Répond `200 { "to": email }`.

### `GET` et `POST /clients/newsletter/unsubscribe?token=…` (publiques)
- Jeton : `base64url(client_id) + "." + base64url(HMAC-SHA256(client_id, CLIENT_UNSUB_SECRET))`,
  comparaison en temps constant. Pas d'expiration.
- Jeton invalide → `400` + page HTML d'erreur sobre. `token=test` → page
  « lien de test ».
- Valide → `UPDATE client_crm SET newsletter = false, newsletter_updated_at = now()
  WHERE id = $1 AND newsletter` (idempotent ; client inconnu = même page de
  succès, pour ne rien révéler).
- `GET` → page HTML « Vous êtes désinscrit(e) de la newsletter ».
- `POST` → `200` vide (désinscription en un clic RFC 8058).
- Hors CORS (appel direct navigateur / client mail).

### Mailer
- `emailRequest` gagne `Headers map[string]string`, écrits (après
  `sanitizeHeader`) dans `buildMIMEMessage`. Seule modification de la brique
  SMTP partagée ; les envois existants passent `nil`.
- `Mailer.SendClientNewsletter(ctx, to, subject, html, unsubURL)` ajoute
  `List-Unsubscribe: <unsubURL>` et
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- Gabarit `clientNewsletterEmailHTML(message, unsubURL)` dans
  `internal/mailer/template.go`, même charte que les gabarits existants :
  message passé par `html.EscapeString` puis `\n` → `<br>` ; pied de page
  « Vous recevez ce mail car vous êtes client … — Se désinscrire ».

## 3. Front (Nokk_project)

### Feature `src/features/client-newsletter/` (Architecture_Feature §2)
```
client-newsletter/
  routes/ClientNewsletter.tsx          page, composition seule
  components/
    NewsletterComposer.tsx             sujet, message, compteur, boutons test/envoyer
    ConfirmSendDialog.tsx              confirmation « N clients vont recevoir ce mail »
    SendHistory.tsx                    envois : date, auteur, sujet, envoyés/échecs, statut
  hooks/data/
    useNewsletterRecipientCount.ts
    useNewsletterSend.ts               test + envoi réel, états, toasts
    useNewsletterHistory.ts            poll 3 s tant qu'un envoi est `sending`
  services/clientNewsletterService.ts
  types.ts
  index.ts
```

`clientNewsletterService.ts` :
- `sendClientNewsletter({subject, message})` → `POST /clients/newsletter/send`
- `sendClientNewsletterTest({subject, message})` → `POST /clients/newsletter/test`
- `fetchRecipientCount()` → `GET /clients/newsletter/recipients` (service Go,
  même filtre + dédoublonnage que l'envoi réel, pour que la confirmation
  affiche le nombre exact de mails qui partiront).
- `fetchSendHistory(limit = 20)` → `client_newsletter_sends` trié par
  `created_at desc`, avec le nom de l'auteur (`profiles`).
- URL : `env.PUBLIC_NEWSLETTER_API_URL` (déjà déclarée) ; en-tête
  `Authorization: Bearer <access_token>` comme
  `arrivage-admin/services/newsletterService.ts`. Les erreurs HTTP sont
  remontées avec le texte du serveur (`409`, `400`).

Comportement UI :
- Compteur « N clients abonnés recevront ce mail ».
- Textarea message (retours à la ligne conservés), rappel « un lien de
  désinscription est ajouté automatiquement ».
- « M'envoyer un test » → toast « Test envoyé à x@… ».
- « Envoyer » → `ConfirmSendDialog` → 202 → formulaire vidé, historique
  rafraîchi, ligne « en cours… 45/132 ».
- Boutons désactivés : champ vide, compteur à 0, envoi `sending` en cours,
  requête en vol.
- Tokens Tailwind du thème uniquement (pas de valeurs arbitraires).

### Routing et sidebar
- `router.tsx` : route `/newsletter`, `featureKey: "client_newsletter"`,
  `permissionCode: "newsletter_clients.send"`, `requireMfa: true`, lazy import.
- `menuItems.ts` : entrée « Newsletter », icône `Mail`, catégorie
  `Commercial`, même permission. Pas d'onglets → rien à ajouter côté ROUTING.md.

### Case sur la fiche client
- Nouveau composant `src/features/crm/components/Client/NewsletterOptIn.tsx` :
  `Switch` « Abonné à la newsletter » + « modifié le … ». Désactivé (avec
  tooltip « Ajoutez un email pour abonner ce client ») si `mail` vide.
- Inséré par une seule ligne dans `Fiche_split/colonneg.tsx` près des emails
  (fichier déjà au-delà du seuil de 400 lignes : on ne l'étend pas plus).
- Écriture : `updateClientNewsletter(id, value)` dans
  `crm/services/clientService.ts` (met à jour `newsletter` et
  `newsletter_updated_at`, `.select("id")`, 0 ligne ⇒ erreur, comme
  `updateSubscriberCrmStat`). Mise à jour optimiste + rollback + toast.
- Ajouter `newsletter` / `newsletter_updated_at` aux types CRM concernés.

## 4. Tests et vérification

Go :
- token : aller-retour, jeton altéré / mauvais secret / malformé rejetés.
- template : échappement HTML, `\n` → `<br>`, lien présent.
- validation : vide, trop long, JSON invalide.
- buildMIMEMessage : en-têtes ajoutés et nettoyés (pas d'injection CRLF).
- handler unsubscribe : idempotent, jeton invalide → 400.
- `go test ./...` vert.

Front :
- `clientService.updateClientNewsletter` : 0 ligne ⇒ erreur.
- `NewsletterComposer` : boutons désactivés selon les règles ci-dessus.
- `npm run lint` et `tsc --noEmit` sans hausse du ratchet.

Bout en bout (manuel) : cocher un client de test → test vers soi → envoi
réel → suivi dans l'historique → clic sur « Se désinscrire » → case décochée
sur la fiche.

## 5. Hors périmètre (V1)

Éditeur riche, images/pièces jointes, segmentation (par commercial, tag…),
programmation d'envoi, statistiques d'ouverture/clic, `mail_2`, import en
masse des consentements.

## 6. Déploiement

1. Migration Supabase + régénération des types.
2. Variables `CLIENT_UNSUB_SECRET` et `PUBLIC_BASE_URL` sur le service Go,
   puis déploiement de `newsletter-console`.
3. Attribution de `newsletter_clients.send` aux rôles voulus.
4. Déploiement du front.
