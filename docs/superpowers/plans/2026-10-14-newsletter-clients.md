# Newsletter clients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'envoyer, depuis une page « Newsletter » de la catégorie Commercial, un mail (sujet + message) à tous les clients CRM abonnés, avec opt-in par client et désinscription en un clic.

**Architecture:** Le booléen `client_crm.newsletter` porte l'opt-in. Le service Go `newsletter-console` (repo voisin) expose 4 routes authentifiées/gardées par la permission `newsletter_clients.send` (compteur, test, envoi asynchrone) et une route publique de désinscription à jeton HMAC ; il calcule lui-même les destinataires et journalise chaque envoi dans `client_newsletter_sends`. Le front ajoute une feature `client-newsletter` (page, composer, historique) et un switch d'opt-in sur la fiche client.

**Tech Stack:** Go 1.25 (net/http, pgx v5, golang-jwt), Postgres/Supabase (RLS), React + TypeScript + rsbuild, rstest + Testing Library, Tailwind (tokens `@theme`), shadcn atoms de `@/shared/ui/atoms`.

**Spec:** `docs/superpowers/specs/2026-10-14-newsletter-clients-design.md`

**Repos :**
- `FRONT` = `<repo>`
- `GO` = `<newsletter-console>`

## Global Constraints

- **Aucun `git commit` sans accord explicite de Alex** (règle permanente, y compris pour les sous-agents). Chaque tâche se termine par « lister les fichiers modifiés », pas par un commit.
- Opt-in : `client_crm.newsletter boolean NOT NULL DEFAULT false` — `false` pour tous au départ.
- Seule l'adresse `mail` est utilisée (jamais `mail_2`).
- Permission : code exact `newsletter_clients.send`, label « Envoyer la newsletter clients », catégorie `crm`, **sans octroi automatique**.
- Sujet : 1–200 caractères (après trim), sans CR/LF. Message : 1–20 000 caractères (après trim).
- Un seul envoi `sending` à la fois (index unique en base) → `409`.
- Pause entre mails : `SendDelayMs` existant ; timeout **60 s par mail**, pas de plafond global.
- Au démarrage du service Go, toute ligne `sending` passe à `failed` avec `error = 'interrompu'`.
- Jeton de désinscription : `base64url(client_id) + "." + base64url(HMAC-SHA256(client_id, CLIENT_UNSUB_SECRET))`, sans expiration, comparaison en temps constant ; `token=test` = lien factice des mails de test.
- En-têtes mail : `List-Unsubscribe: <url>` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- Nouvelles variables Go obligatoires : `CLIENT_UNSUB_SECRET`, `PUBLIC_BASE_URL`. Aucune nouvelle variable front (on réutilise `env.PUBLIC_NEWSLETTER_API_URL`).
- Front : jamais de `supabase.from(...)` hors `services/` ; jamais `import.meta.env` hors `env.ts` ; pas de valeur Tailwind arbitraire ; `src/integrations/supabase/types.ts` est généré — **ne pas l'éditer à la main** (casts `as any` documentés, comme `arrivage-admin/services/newsletterService.ts`).
- `colonneg.tsx` dépasse déjà 400 lignes : on n'y ajoute qu'un import et une ligne JSX.
- Gates front : `npm run lint` et `npm run typecheck` sans hausse du nombre d'erreurs ; tests via `npx rstest run <fichier>`.
- Gates Go : `go vet ./...` et `go test ./...` verts.

## Review Focus

1. **Message contenant du HTML ou des accents** (`<script>`, `&`, `é`, `—`) → affiché littéralement et correctement encodé dans le mail, jamais interprété. Test : `TestClientNewsletterEmailHTML_EscapesAndBreaks` (Tâche 2).
2. **Double clic / deux commerciaux qui envoient en même temps** → le second reçoit un `409` lisible, un seul envoi part. Test : `TestSendHandler_Conflict` (Tâche 4) + index unique (Tâche 1).
3. **Clients en double ou emails invalides dans `client_crm`** (même adresse sur deux fiches, casse différente, `"n/a"`) → un seul mail par adresse, invalides ignorés, compteur cohérent avec l'envoi. Test : `TestDedupeRecipients` (Tâche 4).
4. **Lien de désinscription altéré, tronqué, cliqué deux fois, ou déclenché en POST par Gmail** → jeton altéré refusé (400) sans toucher la base ; double clic idempotent ; POST one-click accepté. Tests : `TestVerifyToken_*` (Tâche 3), `TestUnsubscribeHandler_*` (Tâche 4).
5. **Service redéployé pendant un envoi** → l'envoi ne reste pas bloqué en `sending` (sinon plus aucun envoi possible). Test : `TestRun_StopsWhenContextCancelled` (Tâche 4) + `FailStaleSends` au démarrage (Tâche 5).

---

## File Structure

GO :
- Modify `internal/mailer/mailer.go` — champ `Headers` sur `emailRequest`, méthode `SendClientNewsletter`.
- Modify `internal/mailer/smtp.go` — écriture des en-têtes additionnels dans `buildMIMEMessage`.
- Modify `internal/mailer/template.go` — gabarit `clientNewsletterEmailHTML`.
- Create `internal/mailer/template_test.go`.
- Modify `internal/mailer/smtp_test.go` — test des en-têtes.
- Create `internal/clientnews/token.go` + `token_test.go` — jeton HMAC.
- Create `internal/clientnews/compose.go` — validation du corps + dédoublonnage des destinataires.
- Create `internal/clientnews/store.go` — interface `Store` + implémentation pgx.
- Create `internal/clientnews/page.go` — pages HTML de désinscription.
- Create `internal/clientnews/service.go` — handlers HTTP + boucle d'envoi.
- Create `internal/clientnews/service_test.go` — tests (faux store / faux sender).
- Modify `internal/subscription/auth.go` — `EmailFromContext`.
- Modify `internal/config/config.go`, `.env.example`, `cmd/server/main.go` — config + câblage.

FRONT :
- Create `supabase/migrations/20261014120000_client_newsletter.sql`.
- Create `src/features/client-newsletter/{types.ts,index.ts}`.
- Create `src/features/client-newsletter/services/clientNewsletterService.ts` + `.test.ts`.
- Create `src/features/client-newsletter/utils/submitState.ts` + `.test.ts`.
- Create `src/features/client-newsletter/hooks/data/{useNewsletterRecipientCount,useNewsletterHistory,useNewsletterSend}.ts`.
- Create `src/features/client-newsletter/components/{NewsletterComposer,ConfirmSendDialog,SendHistory}.tsx`.
- Create `src/features/client-newsletter/routes/ClientNewsletter.tsx`.
- Modify `src/app/routes/router.tsx`, `src/shared/components/layout/menuItems.ts`.
- Modify `src/features/crm/types/client.ts`, `src/features/crm/services/clientService.ts` (+ test).
- Create `src/features/crm/hooks/data/useClientNewsletterOptIn.ts`.
- Create `src/features/crm/components/Client/NewsletterOptIn.tsx`.
- Modify `src/features/crm/components/Client/Fiche_split/colonneg.tsx` (1 import + 1 ligne).

---

### Task 1: Migration Supabase

**Files:**
- Create: `FRONT/supabase/migrations/20261014120000_client_newsletter.sql`

**Interfaces:**
- Produces: colonnes `client_crm.newsletter`, `client_crm.newsletter_updated_at` ; table `public.client_newsletter_sends(id, subject, message, sent_by, status, recipient_count, sent_count, failed_count, error, created_at, finished_at)` ; permission `newsletter_clients.send`.

- [ ] **Step 1: Écrire la migration**

```sql
-- ============================================================
-- Newsletter clients (spec 2026-10-14-newsletter-clients-design.md)
--
-- 1. Opt-in par client : client_crm.newsletter (false pour tous au départ,
--    le commercial coche client par client) + date de dernière bascule
--    (trace du consentement, aussi écrite par la désinscription en un clic).
-- 2. Journal des envois : client_newsletter_sends, écrit uniquement par le
--    service Go newsletter-console (connexion service_role), lu par le front
--    sous la permission newsletter_clients.send.
-- 3. Permission newsletter_clients.send, créée SANS octroi automatique :
--    elle s'attribue via l'UI rôles/services, pour qu'aucun rôle ne puisse
--    écrire à toute la base clients par défaut.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ── 1. Opt-in client ──────────────────────────────────────────
ALTER TABLE public.client_crm
    ADD COLUMN IF NOT EXISTS newsletter boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS newsletter_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS client_crm_newsletter_idx
    ON public.client_crm (id) WHERE newsletter;

-- ── 2. Journal des envois ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_newsletter_sends (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject         text NOT NULL,
    message         text NOT NULL,
    sent_by         uuid NOT NULL,
    status          text NOT NULL CHECK (status IN ('sending', 'done', 'failed')),
    recipient_count integer NOT NULL DEFAULT 0,
    sent_count      integer NOT NULL DEFAULT 0,
    failed_count    integer NOT NULL DEFAULT 0,
    error           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz
);

-- Un seul envoi en cours à la fois : le service Go traduit la violation
-- (23505) en 409.
CREATE UNIQUE INDEX IF NOT EXISTS client_newsletter_sends_one_sending_idx
    ON public.client_newsletter_sends (status) WHERE status = 'sending';

CREATE INDEX IF NOT EXISTS client_newsletter_sends_created_at_idx
    ON public.client_newsletter_sends (created_at DESC);

ALTER TABLE public.client_newsletter_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_clients.send can read sends" ON public.client_newsletter_sends;
CREATE POLICY "newsletter_clients.send can read sends"
    ON public.client_newsletter_sends FOR SELECT TO authenticated
    USING (public.user_has_permission(auth.uid(), 'newsletter_clients.send'));
-- Pas de policy d'écriture : seul le service_role écrit.

-- ── 3. Permission ─────────────────────────────────────────────
INSERT INTO public.permissions (code, label, category)
SELECT 'newsletter_clients.send', 'Envoyer la newsletter clients', 'crm'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'newsletter_clients.send'
);
```

- [ ] **Step 2: Vérifier la syntaxe localement**

Run: `cd "$FRONT" && grep -c "IF NOT EXISTS" supabase/migrations/20261014120000_client_newsletter.sql`
Expected: `6` (idempotence sur colonnes, index, table).

- [ ] **Step 3: Appliquer la migration — étape manuelle, par Alex**

Demander à Alex d'appliquer le fichier sur Supabase (SQL Editor). Puis vérifier, dans le SQL Editor :

```sql
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_name = 'client_crm' AND column_name LIKE 'newsletter%';
-- attendu : newsletter boolean false ; newsletter_updated_at timestamptz NULL
SELECT count(*) FROM client_crm WHERE newsletter; -- attendu : 0
SELECT code FROM permissions WHERE code = 'newsletter_clients.send'; -- 1 ligne
```

- [ ] **Step 4: Vérifier que la RLS `client_crm` laisse un commercial modifier `newsletter`**

Les policies UPDATE de `client_crm` ne sont pas versionnées dans `supabase/migrations`. Dans le SQL Editor :

```sql
SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'client_crm';
```

Expected : une policy `UPDATE` sans restriction de colonne (le front met déjà à jour `client_crm` via `updateClientRow`). Si aucune policy UPDATE n'autorise les commerciaux, **s'arrêter et le signaler à Alex** avant la Tâche 8.

- [ ] **Step 5: Fin de tâche** — lister le fichier créé. Ne pas commiter.

---

### Task 2: Mailer — en-têtes additionnels + gabarit newsletter client (GO)

**Files:**
- Modify: `GO/internal/mailer/mailer.go` (struct `emailRequest`, nouvelle méthode)
- Modify: `GO/internal/mailer/smtp.go` (`buildMIMEMessage`)
- Modify: `GO/internal/mailer/template.go`
- Modify: `GO/internal/mailer/smtp_test.go`
- Create: `GO/internal/mailer/template_test.go`

**Interfaces:**
- Produces: `func (m *Mailer) SendClientNewsletter(ctx context.Context, to, subject, message, unsubURL string) error` ; `emailRequest.Headers map[string]string`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `internal/mailer/smtp_test.go` :

```go
func TestBuildMIMEMessage_ExtraHeaders(t *testing.T) {
	req := emailRequest{
		To:      "client@example.com",
		Subject: "Nouveautés",
		Body:    "<p>x</p>",
		Headers: map[string]string{
			"List-Unsubscribe":      "<https://api.test/u?token=abc>",
			"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
		},
	}

	msg := buildMIMEMessage(req, "from@example.com")

	for _, h := range []string{
		"List-Unsubscribe: <https://api.test/u?token=abc>\r\n",
		"List-Unsubscribe-Post: List-Unsubscribe=One-Click\r\n",
	} {
		if !strings.Contains(msg, h) {
			t.Errorf("en-tête manquant : %q", h)
		}
	}
	// Les en-têtes doivent précéder le corps (avant la ligne vide).
	headerBlock := msg[:strings.Index(msg, "\r\n\r\n")]
	if !strings.Contains(headerBlock, "List-Unsubscribe:") {
		t.Error("List-Unsubscribe doit être dans le bloc d'en-têtes")
	}
}

func TestBuildMIMEMessage_ExtraHeadersNoCRLFInjection(t *testing.T) {
	req := emailRequest{
		To:      "client@example.com",
		Subject: "x",
		Body:    "x",
		Headers: map[string]string{"List-Unsubscribe": "<https://a>\r\nBcc: evil@example.com"},
	}

	msg := buildMIMEMessage(req, "from@example.com")

	if strings.Contains(msg, "\r\nBcc:") {
		t.Error("CR/LF dans une valeur d'en-tête ne doit pas créer un nouvel en-tête")
	}
}
```

Créer `internal/mailer/template_test.go` :

```go
package mailer

import (
	"strings"
	"testing"
)

func TestClientNewsletterEmailHTML_EscapesAndBreaks(t *testing.T) {
	out := clientNewsletterEmailHTML("Bonjour <b>&</b> é —\r\nligne 2\nligne 3", "https://api.test/u?token=a&b")

	if strings.Contains(out, "<b>&</b>") {
		t.Error("le HTML du message doit être échappé")
	}
	if !strings.Contains(out, "&lt;b&gt;&amp;&lt;/b&gt; é —<br>ligne 2<br>ligne 3") {
		t.Errorf("échappement ou sauts de ligne incorrects :\n%s", out)
	}
	if !strings.Contains(out, `href="https://api.test/u?token=a&amp;b"`) {
		t.Error("le lien de désinscription doit être présent et échappé")
	}
	if !strings.Contains(out, "Se désinscrire") {
		t.Error("libellé du lien de désinscription manquant")
	}
}
```

- [ ] **Step 2: Lancer les tests — échec attendu**

Run: `cd "$GO" && go test ./internal/mailer/`
Expected: FAIL — `unknown field Headers in struct literal` et `undefined: clientNewsletterEmailHTML`.

- [ ] **Step 3: Implémenter**

Dans `internal/mailer/mailer.go`, struct `emailRequest`, ajouter après `AttachmentData` :

```go
	// Headers : en-têtes additionnels (ex. List-Unsubscribe). Nettoyés de
	// tout CR/LF par buildMIMEMessage. nil pour les envois existants.
	Headers map[string]string
```

Ajouter à la fin de `mailer.go` :

```go
// SendClientNewsletter envoie la newsletter clients (sujet + message libres
// rédigés depuis Nokk_project) à un destinataire, avec le lien de
// désinscription en pied de mail et les en-têtes List-Unsubscribe (bouton
// natif des messageries, RFC 8058). Voir internal/clientnews.
func (m *Mailer) SendClientNewsletter(ctx context.Context, to, subject, message, unsubURL string) error {
	return sendEmail(ctx, emailRequest{
		To:      to,
		Subject: subject,
		Body:    clientNewsletterEmailHTML(message, unsubURL),
		Headers: map[string]string{
			"List-Unsubscribe":      "<" + unsubURL + ">",
			"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
		},
		SmtpHost: m.smtpHost,
		SmtpPort: m.smtpPort,
		SmtpUser: m.smtpUser,
		SmtpPass: m.smtpPass,
	})
}
```

Dans `internal/mailer/smtp.go`, ajouter `"sort"` aux imports, puis dans `buildMIMEMessage`, juste après `sb.WriteString("MIME-Version: 1.0\r\n")` :

```go
	// En-têtes additionnels, triés pour un rendu déterministe.
	keys := make([]string, 0, len(req.Headers))
	for k := range req.Headers {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		sb.WriteString(sanitizeHeader(k) + ": " + sanitizeHeader(req.Headers[k]) + "\r\n")
	}
```

Dans `internal/mailer/template.go`, remplacer `import "fmt"` par :

```go
import (
	"fmt"
	"html"
	"strings"
)
```

et ajouter avant `baseHTML` :

```go
// clientNewsletterEmailHTML est le corps de la newsletter clients : message
// texte libre saisi dans Nokk_project, échappé (aucun HTML interprété)
// avec ses retours à la ligne conservés, plus le pied de page de
// désinscription obligatoire.
func clientNewsletterEmailHTML(message, unsubURL string) string {
	normalized := strings.ReplaceAll(message, "\r\n", "\n")
	body := strings.ReplaceAll(html.EscapeString(normalized), "\n", "<br>")
	content := fmt.Sprintf(`
<div>%s</div>
<br>
<p style="font-size:12px;color:#888888;">
  Vous recevez ce mail car vous êtes client de Nokk_project.
  <a href="%s" style="color:#888888;">Se désinscrire</a>
</p>`, body, html.EscapeString(unsubURL))

	return baseHTML(content)
}
```

- [ ] **Step 4: Lancer les tests — succès attendu**

Run: `cd "$GO" && go test ./internal/mailer/ && go vet ./...`
Expected: `ok  newsletter-console/internal/mailer`, vet sans sortie.

- [ ] **Step 5: Fin de tâche** — lister les fichiers modifiés. Ne pas commiter.

---

### Task 3: Jeton de désinscription HMAC (GO)

**Files:**
- Create: `GO/internal/clientnews/token.go`
- Create: `GO/internal/clientnews/token_test.go`

**Interfaces:**
- Produces: `func SignToken(clientID string, secret []byte) string` ; `func VerifyToken(token string, secret []byte) (string, error)` ; `var ErrInvalidToken`.

- [ ] **Step 1: Écrire les tests qui échouent**

```go
package clientnews

import (
	"errors"
	"strings"
	"testing"
)

var testSecret = []byte("s3cret")

const testClientID = "7b0f3c2e-1d2a-4e5f-9a8b-0c1d2e3f4a5b"

func TestVerifyToken_RoundTrip(t *testing.T) {
	got, err := VerifyToken(SignToken(testClientID, testSecret), testSecret)
	if err != nil || got != testClientID {
		t.Fatalf("got (%q, %v), want (%q, nil)", got, err, testClientID)
	}
}

func TestVerifyToken_URLSafe(t *testing.T) {
	tok := SignToken(testClientID, testSecret)
	if strings.ContainsAny(tok, "+/=") {
		t.Errorf("le jeton doit être base64url sans padding : %q", tok)
	}
}

func TestVerifyToken_Rejects(t *testing.T) {
	valid := SignToken(testClientID, testSecret)
	other := SignToken("11111111-1111-1111-1111-111111111111", testSecret)
	idPart, _, _ := strings.Cut(valid, ".")
	_, otherSig, _ := strings.Cut(other, ".")

	cases := map[string]string{
		"vide":            "",
		"sans point":      strings.ReplaceAll(valid, ".", ""),
		"signature vide":  idPart + ".",
		"id vide":         "." + otherSig,
		"base64 invalide": "!!!.???",
		"signature volée": idPart + "." + otherSig,
		"tronqué":         valid[:len(valid)-2],
	}
	for name, tok := range cases {
		if _, err := VerifyToken(tok, testSecret); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("%s : err = %v, want ErrInvalidToken", name, err)
		}
	}
	if _, err := VerifyToken(valid, []byte("autre-secret")); !errors.Is(err, ErrInvalidToken) {
		t.Errorf("mauvais secret : err = %v, want ErrInvalidToken", err)
	}
}
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `cd "$GO" && go test ./internal/clientnews/`
Expected: FAIL — `undefined: SignToken`.

- [ ] **Step 3: Implémenter `token.go`**

```go
// Package clientnews envoie la newsletter clients (sujet + message libres)
// aux clients CRM abonnés (client_crm.newsletter = true) et gère leur
// désinscription en un clic. Spec : Nokk_project
// docs/superpowers/specs/2026-10-14-newsletter-clients-design.md.
package clientnews

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
)

// ErrInvalidToken couvre tout jeton malformé ou mal signé, sans distinguer
// les cas : la page publique n'a rien à révéler de plus.
var ErrInvalidToken = errors.New("invalid unsubscribe token")

// SignToken produit le jeton de désinscription d'un client :
// base64url(client_id) "." base64url(HMAC-SHA256(client_id, secret)).
// Pas d'expiration : un lien de désinscription doit rester valide.
func SignToken(clientID string, secret []byte) string {
	enc := base64.RawURLEncoding
	return enc.EncodeToString([]byte(clientID)) + "." + enc.EncodeToString(sign(clientID, secret))
}

// VerifyToken renvoie le client_id porté par un jeton valide.
func VerifyToken(token string, secret []byte) (string, error) {
	idPart, sigPart, ok := strings.Cut(token, ".")
	if !ok || idPart == "" || sigPart == "" {
		return "", ErrInvalidToken
	}
	enc := base64.RawURLEncoding
	idBytes, err := enc.DecodeString(idPart)
	if err != nil {
		return "", ErrInvalidToken
	}
	sig, err := enc.DecodeString(sigPart)
	if err != nil {
		return "", ErrInvalidToken
	}
	clientID := string(idBytes)
	if !hmac.Equal(sig, sign(clientID, secret)) {
		return "", ErrInvalidToken
	}
	return clientID, nil
}

func sign(clientID string, secret []byte) []byte {
	h := hmac.New(sha256.New, secret)
	h.Write([]byte(clientID))
	return h.Sum(nil)
}
```

- [ ] **Step 4: Lancer — succès attendu**

Run: `cd "$GO" && go test ./internal/clientnews/ -run Token -v`
Expected: PASS des 3 tests.

- [ ] **Step 5: Fin de tâche** — lister les fichiers créés. Ne pas commiter.

---

### Task 4: Service clientnews — validation, store, handlers, boucle d'envoi (GO)

**Files:**
- Create: `GO/internal/clientnews/compose.go`
- Create: `GO/internal/clientnews/store.go`
- Create: `GO/internal/clientnews/page.go`
- Create: `GO/internal/clientnews/service.go`
- Create: `GO/internal/clientnews/service_test.go`
- Modify: `GO/internal/subscription/auth.go` (ajout `EmailFromContext`)

**Interfaces:**
- Consumes: `SignToken`, `VerifyToken`, `ErrInvalidToken` (Tâche 3) ; `subscription.SubjectFromContext(ctx) (string, bool)` (existant).
- Produces:
  - `type Recipient struct { ClientID, Email string }`
  - `type Store interface { ListRecipients(ctx) ([]Recipient, error); CreateSend(ctx, subject, message, sentBy string, recipientCount int) (string, error); UpdateProgress(ctx, id string, sent, failed int) error; FinishSend(ctx, id string, sent, failed int, errMsg string) error; Unsubscribe(ctx, clientID string) error; FailStaleSends(ctx) (int64, error) }`
  - `var ErrSendInProgress`
  - `func NewStore(pool *pgxpool.Pool) Store`
  - `type Sender interface { SendClientNewsletter(ctx context.Context, to, subject, message, unsubURL string) error }` (satisfait par `*mailer.Mailer`, Tâche 2)
  - `func NewService(bg context.Context, store Store, sender Sender, secret, baseURL string, sendDelayMs int) *Service`
  - Méthodes `*Service` : `RecipientCountHandler()`, `SendHandler()`, `TestHandler()`, `UnsubscribeHandler()` → `http.HandlerFunc`.
  - `func subscription.EmailFromContext(ctx context.Context) (string, bool)`
  - Contrats HTTP : `GET /clients/newsletter/recipients` → `200 {"count": n}` ; `POST /clients/newsletter/send` → `202 {"id","recipient_count"}` | `400` | `409` ; `POST /clients/newsletter/test` → `200 {"to"}` | `400` | `502` ; `GET|POST /clients/newsletter/unsubscribe?token=` → `200` | `400`.

- [ ] **Step 1: Ajouter `EmailFromContext` dans `internal/subscription/auth.go`** (après `SubjectFromContext`)

```go
// EmailFromContext returns the "email" claim of the Supabase JWT stored by
// RequireAuth (used to address test sends to the caller).
func EmailFromContext(ctx context.Context) (string, bool) {
	claims, ok := ctx.Value(claimsKey).(jwt.MapClaims)
	if !ok {
		return "", false
	}
	email, ok := claims["email"].(string)
	return email, ok && email != ""
}
```

- [ ] **Step 2: Écrire les tests qui échouent — `service_test.go`**

```go
package clientnews

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
)

// ── Faux store / faux sender ─────────────────────────────────────────

type fakeStore struct {
	mu           sync.Mutex
	recipients   []Recipient
	createErr    error
	created      []string // sujets
	unsubscribed []string
	finished     chan finishCall
}

type finishCall struct {
	sent, failed int
	errMsg       string
}

func newFakeStore(r ...Recipient) *fakeStore {
	return &fakeStore{recipients: r, finished: make(chan finishCall, 1)}
}

func (f *fakeStore) ListRecipients(context.Context) ([]Recipient, error) { return f.recipients, nil }
func (f *fakeStore) CreateSend(_ context.Context, subject, _, _ string, _ int) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.createErr != nil {
		return "", f.createErr
	}
	f.created = append(f.created, subject)
	return "send-1", nil
}
func (f *fakeStore) UpdateProgress(context.Context, string, int, int) error { return nil }
func (f *fakeStore) FinishSend(_ context.Context, _ string, sent, failed int, errMsg string) error {
	f.finished <- finishCall{sent, failed, errMsg}
	return nil
}
func (f *fakeStore) Unsubscribe(_ context.Context, id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.unsubscribed = append(f.unsubscribed, id)
	return nil
}
func (f *fakeStore) FailStaleSends(context.Context) (int64, error) { return 0, nil }

type sentMail struct{ to, subject, message, unsubURL string }

type fakeSender struct {
	mu    sync.Mutex
	sent  []sentMail
	failTo map[string]bool
}

func (s *fakeSender) SendClientNewsletter(_ context.Context, to, subject, message, unsubURL string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failTo[to] {
		return errors.New("smtp 550")
	}
	s.sent = append(s.sent, sentMail{to, subject, message, unsubURL})
	return nil
}

func newTestService(store Store, sender Sender) *Service {
	return NewService(context.Background(), store, sender, "s3cret", "https://api.test/", 0)
}

func post(h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	return rec
}

const validBody = `{"subject":"  Nouveautés  ","message":"Bonjour\nà tous"}`

// ── Validation ───────────────────────────────────────────────────────

func TestParseCompose(t *testing.T) {
	ok, err := parseCompose(strings.NewReader(validBody))
	if err != nil || ok.Subject != "Nouveautés" || ok.Message != "Bonjour\nà tous" {
		t.Fatalf("got (%+v, %v)", ok, err)
	}

	bad := map[string]string{
		"json invalide":   `{`,
		"sujet vide":      `{"subject":"  ","message":"x"}`,
		"message vide":    `{"subject":"x","message":" "}`,
		"sujet trop long": `{"subject":"` + strings.Repeat("é", 201) + `","message":"x"}`,
		"message trop long": `{"subject":"x","message":"` + strings.Repeat("a", 20001) + `"}`,
		"sujet CRLF":      `{"subject":"a\r\nBcc: x@y.z","message":"x"}`,
	}
	for name, body := range bad {
		if _, err := parseCompose(strings.NewReader(body)); err == nil {
			t.Errorf("%s : erreur attendue", name)
		}
	}

	// Limites exactes acceptées.
	edge := `{"subject":"` + strings.Repeat("é", 200) + `","message":"` + strings.Repeat("a", 20000) + `"}`
	if _, err := parseCompose(strings.NewReader(edge)); err != nil {
		t.Errorf("200/20000 caractères doivent passer : %v", err)
	}
}

func TestDedupeRecipients(t *testing.T) {
	got := dedupeRecipients([]Recipient{
		{"c1", "Alice@Example.com"},
		{"c2", " alice@example.com "},
		{"c3", "n/a"},
		{"c4", ""},
		{"c5", "bob@example.com"},
	})
	want := []Recipient{{"c1", "Alice@Example.com"}, {"c5", "bob@example.com"}}
	if len(got) != len(want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("[%d] got %+v, want %+v", i, got[i], want[i])
		}
	}
}

// ── Compteur ─────────────────────────────────────────────────────────

func TestRecipientCountHandler(t *testing.T) {
	svc := newTestService(newFakeStore(Recipient{"c1", "a@x.fr"}, Recipient{"c2", "A@x.fr"}, Recipient{"c3", "b@x.fr"}), &fakeSender{})
	rec := httptest.NewRecorder()
	svc.RecipientCountHandler()(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	var body struct{ Count int `json:"count"` }
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusOK || body.Count != 2 {
		t.Fatalf("code=%d count=%d, want 200/2", rec.Code, body.Count)
	}
}

// ── Envoi ────────────────────────────────────────────────────────────

func TestSendHandler_AcceptsAndSendsInBackground(t *testing.T) {
	store := newFakeStore(Recipient{"c1", "a@x.fr"}, Recipient{"c2", "b@x.fr"})
	sender := &fakeSender{failTo: map[string]bool{"b@x.fr": true}}
	svc := newTestService(store, sender)

	rec := post(svc.SendHandler(), validBody)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("code=%d body=%s, want 202", rec.Code, rec.Body)
	}
	var body struct {
		ID             string `json:"id"`
		RecipientCount int    `json:"recipient_count"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.ID != "send-1" || body.RecipientCount != 2 {
		t.Fatalf("body = %+v", body)
	}

	select {
	case f := <-store.finished:
		if f.sent != 1 || f.failed != 1 || f.errMsg != "" {
			t.Errorf("finish = %+v, want sent=1 failed=1", f)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("FinishSend jamais appelé")
	}

	m := sender.sent[0]
	if m.to != "a@x.fr" || m.subject != "Nouveautés" {
		t.Errorf("mail = %+v", m)
	}
	u, err := url.Parse(m.unsubURL)
	if err != nil || u.Host != "api.test" || u.Path != "/clients/newsletter/unsubscribe" {
		t.Fatalf("unsubURL = %q", m.unsubURL)
	}
	if id, err := VerifyToken(u.Query().Get("token"), []byte("s3cret")); err != nil || id != "c1" {
		t.Errorf("jeton du lien = (%q, %v), want c1", id, err)
	}
}

func TestSendHandler_Conflict(t *testing.T) {
	store := newFakeStore(Recipient{"c1", "a@x.fr"})
	store.createErr = ErrSendInProgress
	rec := post(newTestService(store, &fakeSender{}).SendHandler(), validBody)
	if rec.Code != http.StatusConflict {
		t.Fatalf("code=%d, want 409", rec.Code)
	}
}

func TestSendHandler_NoRecipients(t *testing.T) {
	store := newFakeStore(Recipient{"c1", "pas-un-mail"})
	rec := post(newTestService(store, &fakeSender{}).SendHandler(), validBody)
	if rec.Code != http.StatusBadRequest || len(store.created) != 0 {
		t.Fatalf("code=%d created=%v, want 400 sans création", rec.Code, store.created)
	}
}

func TestSendHandler_InvalidBody(t *testing.T) {
	store := newFakeStore(Recipient{"c1", "a@x.fr"})
	rec := post(newTestService(store, &fakeSender{}).SendHandler(), `{"subject":"","message":"x"}`)
	if rec.Code != http.StatusBadRequest || len(store.created) != 0 {
		t.Fatalf("code=%d, want 400", rec.Code)
	}
}

func TestRun_StopsWhenContextCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	store := newFakeStore()
	svc := NewService(ctx, store, &fakeSender{}, "s3cret", "https://api.test", 0)

	svc.run("send-1", composeRequest{Subject: "s", Message: "m"}, []Recipient{{"c1", "a@x.fr"}})

	f := <-store.finished
	if f.sent != 0 || f.errMsg != "interrompu" {
		t.Errorf("finish = %+v, want sent=0 errMsg=interrompu", f)
	}
}

// ── Test ─────────────────────────────────────────────────────────────

func TestTestHandler(t *testing.T) {
	sender := &fakeSender{}
	svc := newTestService(newFakeStore(), sender)
	svc.emailFrom = func(context.Context) (string, bool) { return "moi@nokk-project.example", true }

	rec := post(svc.TestHandler(), validBody)
	if rec.Code != http.StatusOK || len(sender.sent) != 1 {
		t.Fatalf("code=%d sent=%d", rec.Code, len(sender.sent))
	}
	if sender.sent[0].to != "moi@nokk-project.example" || !strings.HasSuffix(sender.sent[0].unsubURL, "token=test") {
		t.Errorf("mail = %+v", sender.sent[0])
	}

	svc.emailFrom = func(context.Context) (string, bool) { return "", false }
	if rec := post(svc.TestHandler(), validBody); rec.Code != http.StatusBadRequest {
		t.Errorf("sans email : code=%d, want 400", rec.Code)
	}
}

// ── Désinscription ───────────────────────────────────────────────────

func unsub(svc *Service, method, token string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, "/clients/newsletter/unsubscribe?token="+url.QueryEscape(token), nil)
	svc.UnsubscribeHandler()(rec, req)
	return rec
}

func TestUnsubscribeHandler_ValidIsIdempotent(t *testing.T) {
	store := newFakeStore()
	svc := newTestService(store, &fakeSender{})
	tok := SignToken("c1", []byte("s3cret"))

	for i := 0; i < 2; i++ {
		rec := unsub(svc, http.MethodGet, tok)
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "désinscrit") {
			t.Fatalf("clic %d : code=%d body=%s", i+1, rec.Code, rec.Body)
		}
	}
	if len(store.unsubscribed) != 2 || store.unsubscribed[0] != "c1" {
		t.Errorf("unsubscribed = %v", store.unsubscribed)
	}
}

func TestUnsubscribeHandler_OneClickPost(t *testing.T) {
	store := newFakeStore()
	rec := unsub(newTestService(store, &fakeSender{}), http.MethodPost, SignToken("c1", []byte("s3cret")))
	if rec.Code != http.StatusOK || len(store.unsubscribed) != 1 {
		t.Fatalf("code=%d unsubscribed=%v", rec.Code, store.unsubscribed)
	}
}

func TestUnsubscribeHandler_InvalidToken(t *testing.T) {
	store := newFakeStore()
	tok := SignToken("c1", []byte("autre-secret"))
	rec := unsub(newTestService(store, &fakeSender{}), http.MethodGet, tok)
	if rec.Code != http.StatusBadRequest || len(store.unsubscribed) != 0 {
		t.Fatalf("code=%d unsubscribed=%v, want 400 sans écriture", rec.Code, store.unsubscribed)
	}
}

func TestUnsubscribeHandler_TestToken(t *testing.T) {
	store := newFakeStore()
	rec := unsub(newTestService(store, &fakeSender{}), http.MethodGet, "test")
	if rec.Code != http.StatusOK || len(store.unsubscribed) != 0 || !strings.Contains(rec.Body.String(), "test") {
		t.Fatalf("code=%d unsubscribed=%v", rec.Code, store.unsubscribed)
	}
}
```

- [ ] **Step 3: Lancer — échec attendu**

Run: `cd "$GO" && go test ./internal/clientnews/`
Expected: FAIL — `undefined: Recipient`, `undefined: NewService`, etc.

- [ ] **Step 4: Implémenter `compose.go`**

```go
package clientnews

import (
	"encoding/json"
	"errors"
	"io"
	"net/mail"
	"strings"
	"unicode/utf8"
)

const (
	maxSubjectLen = 200
	maxMessageLen = 20000
	maxBodyBytes  = 256 << 10
)

type composeRequest struct {
	Subject string `json:"subject"`
	Message string `json:"message"`
}

// parseCompose lit et valide le corps {subject, message}. Les messages
// d'erreur sont en français : le front les affiche tels quels en toast.
func parseCompose(r io.Reader) (composeRequest, error) {
	var req composeRequest
	if err := json.NewDecoder(io.LimitReader(r, maxBodyBytes)).Decode(&req); err != nil {
		return req, errors.New("Corps de requête invalide.")
	}
	req.Subject = strings.TrimSpace(req.Subject)
	req.Message = strings.TrimSpace(req.Message)
	switch {
	case req.Subject == "":
		return req, errors.New("Le sujet est obligatoire.")
	case utf8.RuneCountInString(req.Subject) > maxSubjectLen:
		return req, errors.New("Le sujet dépasse 200 caractères.")
	case strings.ContainsAny(req.Subject, "\r\n"):
		return req, errors.New("Le sujet ne doit pas contenir de retour à la ligne.")
	case req.Message == "":
		return req, errors.New("Le message est obligatoire.")
	case utf8.RuneCountInString(req.Message) > maxMessageLen:
		return req, errors.New("Le message dépasse 20 000 caractères.")
	}
	return req, nil
}

// Recipient est un client abonné : son id (pour le jeton de désinscription)
// et son adresse `mail`.
type Recipient struct {
	ClientID string
	Email    string
}

// dedupeRecipients écarte les adresses invalides et garde une seule entrée
// par adresse (insensible à la casse) — la première rencontrée, dont l'id
// sert au jeton de désinscription.
func dedupeRecipients(in []Recipient) []Recipient {
	seen := make(map[string]struct{}, len(in))
	out := make([]Recipient, 0, len(in))
	for _, r := range in {
		addr, err := mail.ParseAddress(strings.TrimSpace(r.Email))
		if err != nil {
			continue
		}
		key := strings.ToLower(addr.Address)
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, Recipient{ClientID: r.ClientID, Email: addr.Address})
	}
	return out
}
```

- [ ] **Step 5: Implémenter `store.go`**

```go
package clientnews

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrSendInProgress : violation de l'index unique
// client_newsletter_sends_one_sending_idx (un envoi est déjà `sending`).
var ErrSendInProgress = errors.New("a client newsletter send is already in progress")

// Store isole l'accès Postgres pour pouvoir tester les handlers.
type Store interface {
	ListRecipients(ctx context.Context) ([]Recipient, error)
	CreateSend(ctx context.Context, subject, message, sentBy string, recipientCount int) (string, error)
	UpdateProgress(ctx context.Context, id string, sent, failed int) error
	FinishSend(ctx context.Context, id string, sent, failed int, errMsg string) error
	Unsubscribe(ctx context.Context, clientID string) error
	FailStaleSends(ctx context.Context) (int64, error)
}

type pgStore struct{ pool *pgxpool.Pool }

func NewStore(pool *pgxpool.Pool) Store { return &pgStore{pool: pool} }

func (s *pgStore) ListRecipients(ctx context.Context) ([]Recipient, error) {
	rows, err := s.pool.Query(ctx, `
SELECT id::text, mail
FROM public.client_crm
WHERE newsletter AND coalesce(trim(mail), '') <> ''
ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Recipient
	for rows.Next() {
		var r Recipient
		if err := rows.Scan(&r.ClientID, &r.Email); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *pgStore) CreateSend(ctx context.Context, subject, message, sentBy string, recipientCount int) (string, error) {
	var id string
	err := s.pool.QueryRow(ctx, `
INSERT INTO public.client_newsletter_sends (subject, message, sent_by, status, recipient_count)
VALUES ($1, $2, $3::uuid, 'sending', $4)
RETURNING id::text`, subject, message, sentBy, recipientCount).Scan(&id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return "", ErrSendInProgress
	}
	return id, err
}

func (s *pgStore) UpdateProgress(ctx context.Context, id string, sent, failed int) error {
	_, err := s.pool.Exec(ctx, `
UPDATE public.client_newsletter_sends SET sent_count = $2, failed_count = $3
WHERE id = $1::uuid`, id, sent, failed)
	return err
}

func (s *pgStore) FinishSend(ctx context.Context, id string, sent, failed int, errMsg string) error {
	_, err := s.pool.Exec(ctx, `
UPDATE public.client_newsletter_sends
SET sent_count = $2, failed_count = $3,
    status = CASE WHEN $4 = '' THEN 'done' ELSE 'failed' END,
    error = nullif($4, ''),
    finished_at = now()
WHERE id = $1::uuid`, id, sent, failed, errMsg)
	return err
}

func (s *pgStore) Unsubscribe(ctx context.Context, clientID string) error {
	_, err := s.pool.Exec(ctx, `
UPDATE public.client_crm SET newsletter = false, newsletter_updated_at = now()
WHERE id = $1::uuid AND newsletter`, clientID)
	return err
}

func (s *pgStore) FailStaleSends(ctx context.Context) (int64, error) {
	tag, err := s.pool.Exec(ctx, `
UPDATE public.client_newsletter_sends
SET status = 'failed', error = 'interrompu', finished_at = now()
WHERE status = 'sending'`)
	return tag.RowsAffected(), err
}
```

- [ ] **Step 6: Implémenter `page.go`**

```go
package clientnews

import (
	"fmt"
	"html"
	"net/http"
)

// writePage rend la petite page publique affichée après un clic sur
// « Se désinscrire ».
func writePage(w http.ResponseWriter, status int, title, text string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	fmt.Fprintf(w, `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>%[1]s</title></head>
<body style="margin:0;background:#efefef;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:64px auto;background:#ffffff;border-radius:12px;padding:32px;text-align:center;">
<p style="font-size:20px;font-weight:bold;color:#111827;">%[1]s</p>
<p style="font-size:15px;color:#444444;line-height:1.6;">%[2]s</p>
<p style="font-size:13px;color:#888888;">Nokk_project</p>
</div></body></html>`, html.EscapeString(title), html.EscapeString(text))
}
```

- [ ] **Step 7: Implémenter `service.go`**

```go
package clientnews

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"newsletter-console/internal/subscription"
)

const (
	perMailTimeout = 60 * time.Second
	progressEvery  = 10
)

// Sender est satisfait par *mailer.Mailer.
type Sender interface {
	SendClientNewsletter(ctx context.Context, to, subject, message, unsubURL string) error
}

type Service struct {
	bg        context.Context // durée de vie du service : annulé à l'arrêt
	store     Store
	sender    Sender
	secret    []byte
	baseURL   string
	sendDelay time.Duration
	// emailFrom résout l'adresse de l'appelant pour l'envoi de test
	// (surchargé dans les tests).
	emailFrom func(context.Context) (string, bool)
}

func NewService(bg context.Context, store Store, sender Sender, secret, baseURL string, sendDelayMs int) *Service {
	return &Service{
		bg:        bg,
		store:     store,
		sender:    sender,
		secret:    []byte(secret),
		baseURL:   strings.TrimRight(baseURL, "/"),
		sendDelay: time.Duration(sendDelayMs) * time.Millisecond,
		emailFrom: subscription.EmailFromContext,
	}
}

func (s *Service) unsubURL(token string) string {
	return s.baseURL + "/clients/newsletter/unsubscribe?token=" + url.QueryEscape(token)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Service) recipients(ctx context.Context) ([]Recipient, error) {
	all, err := s.store.ListRecipients(ctx)
	if err != nil {
		return nil, err
	}
	return dedupeRecipients(all), nil
}

// RecipientCountHandler : GET /clients/newsletter/recipients — même calcul
// (filtre + dédoublonnage) que l'envoi réel, pour que la confirmation
// affiche le nombre exact de mails qui partiront.
func (s *Service) RecipientCountHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list, err := s.recipients(r.Context())
		if err != nil {
			slog.Error("clientnews: list recipients failed", "err", err)
			http.Error(w, "Erreur interne.", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"count": len(list)})
	}
}

// SendHandler : POST /clients/newsletter/send — crée la ligne d'historique,
// répond 202 tout de suite et envoie en arrière-plan.
func (s *Service) SendHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		by, _ := subscription.SubjectFromContext(r.Context())
		req, err := parseCompose(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		list, err := s.recipients(r.Context())
		if err != nil {
			slog.Error("clientnews: list recipients failed", "err", err)
			http.Error(w, "Erreur interne.", http.StatusInternalServerError)
			return
		}
		if len(list) == 0 {
			http.Error(w, "Aucun client abonné avec une adresse email.", http.StatusBadRequest)
			return
		}
		id, err := s.store.CreateSend(r.Context(), req.Subject, req.Message, by, len(list))
		if errors.Is(err, ErrSendInProgress) {
			http.Error(w, "Un envoi est déjà en cours.", http.StatusConflict)
			return
		}
		if err != nil {
			slog.Error("clientnews: create send failed", "err", err)
			http.Error(w, "Erreur interne.", http.StatusInternalServerError)
			return
		}
		slog.Info("clientnews: send started", "id", id, "by", by, "recipients", len(list))
		go s.run(id, req, list)
		writeJSON(w, http.StatusAccepted, map[string]any{"id": id, "recipient_count": len(list)})
	}
}

// run envoie à chaque destinataire, met à jour les compteurs toutes les
// progressEvery mails, puis clôt la ligne. Si le service s'arrête en cours
// de route, la ligne finit en `failed` / `interrompu` (ou, si la base n'est
// plus joignable, FailStaleSends la rattrape au prochain démarrage).
func (s *Service) run(id string, req composeRequest, list []Recipient) {
	sent, failed := 0, 0
	for i, rc := range list {
		if s.bg.Err() != nil {
			break
		}
		if i > 0 && s.sendDelay > 0 {
			select {
			case <-s.bg.Done():
			case <-time.After(s.sendDelay):
			}
			if s.bg.Err() != nil {
				break
			}
		}
		ctx, cancel := context.WithTimeout(s.bg, perMailTimeout)
		err := s.sender.SendClientNewsletter(ctx, rc.Email, req.Subject, req.Message, s.unsubURL(SignToken(rc.ClientID, s.secret)))
		cancel()
		if err != nil {
			failed++
			slog.Error("clientnews: send failed", "id", id, "client", rc.ClientID, "err", err)
		} else {
			sent++
		}
		if (i+1)%progressEvery == 0 {
			pctx, pcancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := s.store.UpdateProgress(pctx, id, sent, failed); err != nil {
				slog.Warn("clientnews: progress update failed", "id", id, "err", err)
			}
			pcancel()
		}
	}
	errMsg := ""
	if s.bg.Err() != nil {
		errMsg = "interrompu"
	}
	fctx, fcancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer fcancel()
	if err := s.store.FinishSend(fctx, id, sent, failed, errMsg); err != nil {
		slog.Error("clientnews: finish send failed", "id", id, "err", err)
	}
	slog.Info("clientnews: send finished", "id", id, "sent", sent, "failed", failed, "error", errMsg)
}

// TestHandler : POST /clients/newsletter/test — envoie le mail à l'appelant
// uniquement, avec un lien de désinscription factice. Pas d'historique.
func (s *Service) TestHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := parseCompose(r.Body)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		to, ok := s.emailFrom(r.Context())
		if !ok {
			http.Error(w, "Adresse email introuvable pour votre compte.", http.StatusBadRequest)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), perMailTimeout)
		defer cancel()
		if err := s.sender.SendClientNewsletter(ctx, to, req.Subject, req.Message, s.unsubURL("test")); err != nil {
			slog.Error("clientnews: test send failed", "to", to, "err", err)
			http.Error(w, "Échec de l'envoi du test.", http.StatusBadGateway)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"to": to})
	}
}

// UnsubscribeHandler : GET|POST /clients/newsletter/unsubscribe?token=…
// Publique. GET = clic sur le lien (page HTML) ; POST = désinscription en un
// clic RFC 8058 déclenchée par la messagerie (réponse vide).
func (s *Service) UnsubscribeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isPost := r.Method == http.MethodPost
		token := r.URL.Query().Get("token")

		if token == "test" {
			if isPost {
				w.WriteHeader(http.StatusOK)
				return
			}
			writePage(w, http.StatusOK, "Lien de test", "Ce lien provient d'un mail de test : aucune désinscription n'a été effectuée.")
			return
		}

		clientID, err := VerifyToken(token, s.secret)
		if err != nil {
			if isPost {
				http.Error(w, "invalid token", http.StatusBadRequest)
				return
			}
			writePage(w, http.StatusBadRequest, "Lien invalide", "Ce lien de désinscription est invalide ou incomplet.")
			return
		}
		if err := s.store.Unsubscribe(r.Context(), clientID); err != nil {
			slog.Error("clientnews: unsubscribe failed", "client", clientID, "err", err)
			if isPost {
				http.Error(w, "internal error", http.StatusInternalServerError)
				return
			}
			writePage(w, http.StatusInternalServerError, "Erreur", "Une erreur est survenue, merci de réessayer plus tard.")
			return
		}
		slog.Info("clientnews: unsubscribed", "client", clientID, "one_click", isPost)
		if isPost {
			w.WriteHeader(http.StatusOK)
			return
		}
		writePage(w, http.StatusOK, "Désinscription confirmée", "Vous êtes désinscrit(e) de la newsletter Nokk_project. Vous ne recevrez plus ces mails.")
	}
}
```

Note : dans `run`, le second `break` est dans le `if` qui suit le `select` (pas dans le `select` lui-même) : il sort bien de la boucle `for`. Ne pas le déplacer dans un `case`.

- [ ] **Step 8: Lancer — succès attendu**

Run: `cd "$GO" && go test ./internal/clientnews/ ./internal/subscription/ -v -race && go vet ./...`
Expected: tous les tests PASS, pas de data race, vet sans sortie.

- [ ] **Step 9: Fin de tâche** — lister les fichiers créés/modifiés. Ne pas commiter.

---

### Task 5: Configuration et câblage des routes (GO)

**Files:**
- Modify: `GO/internal/config/config.go`
- Modify: `GO/.env.example`
- Modify: `GO/cmd/server/main.go`

**Interfaces:**
- Consumes: `clientnews.NewStore`, `clientnews.NewService`, méthodes handlers (Tâche 4) ; `*mailer.Mailer` satisfait `clientnews.Sender` (Tâche 2).
- Produces: `Config.ClientUnsubSecret string`, `Config.PublicBaseURL string` ; routes HTTP montées.

- [ ] **Step 1: Config** — dans `config.go`, struct `Config`, ajouter :

```go
	// ClientUnsubSecret : clé HMAC des liens de désinscription de la
	// newsletter clients (internal/clientnews). La changer invalide tous
	// les liens déjà envoyés.
	ClientUnsubSecret string
	// PublicBaseURL : URL publique du service, pour construire ces liens.
	PublicBaseURL string
```

Dans `Load()`, ajouter au littéral `cfg` :

```go
		ClientUnsubSecret:      os.Getenv("CLIENT_UNSUB_SECRET"),
		PublicBaseURL:          strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/"),
```

et après le contrôle de `WebhookSecret` :

```go
	if cfg.ClientUnsubSecret == "" || cfg.PublicBaseURL == "" {
		return nil, fmt.Errorf("CLIENT_UNSUB_SECRET and PUBLIC_BASE_URL are required")
	}
```

- [ ] **Step 2: `.env.example`** — ajouter avant `# Port HTTP` :

```
# Newsletter clients (internal/clientnews)
# Clé HMAC des liens de désinscription — générer avec : openssl rand -hex 32
# La changer invalide tous les liens déjà envoyés.
CLIENT_UNSUB_SECRET=change-me
# URL publique de ce service (sans slash final), utilisée dans les liens de désinscription
PUBLIC_BASE_URL=https://newsletter.example.com
```

- [ ] **Step 3: `main.go`** — ajouter l'import `"newsletter-console/internal/clientnews"`, la constante après `newsletterAdminPermission` :

```go
// clientNewsletterSendPermission gates the client newsletter page and sends
// (see Nokk_project migration 20261014120000_client_newsletter.sql).
const clientNewsletterSendPermission = "newsletter_clients.send"
```

puis, juste après la ligne `mux.Handle("POST /newsletter/upload", ...)` :

```go
	// ── Newsletter clients (internal/clientnews) ───────────────────────────
	// Sujet + message libres envoyés aux clients CRM abonnés
	// (client_crm.newsletter). L'envoi est asynchrone (202) et journalisé
	// dans client_newsletter_sends ; la désinscription est publique (jeton
	// HMAC dans le lien du mail).
	clientStore := clientnews.NewStore(pool)
	if n, err := clientStore.FailStaleSends(ctx); err != nil {
		slog.Warn("clientnews: stale send cleanup failed", "err", err)
	} else if n > 0 {
		slog.Warn("clientnews: interrupted sends marked failed", "count", n)
	}
	clientNews := clientnews.NewService(ctx, clientStore, m, cfg.ClientUnsubSecret, cfg.PublicBaseURL, cfg.SendDelayMs)
	clientSendMW := subscription.RequirePermission(pool, clientNewsletterSendPermission)
	mux.Handle("GET /clients/newsletter/recipients", authMW(clientSendMW(clientNews.RecipientCountHandler())))
	mux.Handle("POST /clients/newsletter/send", authMW(clientSendMW(clientNews.SendHandler())))
	mux.Handle("POST /clients/newsletter/test", authMW(clientSendMW(clientNews.TestHandler())))
	mux.HandleFunc("GET /clients/newsletter/unsubscribe", clientNews.UnsubscribeHandler())
	mux.HandleFunc("POST /clients/newsletter/unsubscribe", clientNews.UnsubscribeHandler())
```

- [ ] **Step 4: Vérifier compilation et tests**

Run: `cd "$GO" && go build ./... && go vet ./... && go test ./...`
Expected: build OK, tous les packages `ok` (y compris `cmd/server` — si `main_test.go` construit une `Config` complète ou appelle `config.Load()`, définir `CLIENT_UNSUB_SECRET`/`PUBLIC_BASE_URL` dans ce test avec `t.Setenv`).

- [ ] **Step 5: Smoke test local (si un `.env` de dev existe)**

Run: `cd "$GO" && set -a && . ./.env && set +a && CLIENT_UNSUB_SECRET=dev PUBLIC_BASE_URL=http://localhost:8080 go run ./cmd/server` puis, dans un autre terminal :
`curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/clients/newsletter/unsubscribe?token=test"` → `200` ;
`curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8080/clients/newsletter/unsubscribe?token=abc.def"` → `400` ;
`curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8080/clients/newsletter/send` → `401`.
Si aucun `.env` de dev n'est disponible, sauter cette étape et le noter dans le rapport.

- [ ] **Step 6: Fin de tâche** — lister les fichiers modifiés. Ne pas commiter.

---

### Task 6: Front — types et service `client-newsletter`

**Files:**
- Create: `FRONT/src/features/client-newsletter/types.ts`
- Create: `FRONT/src/features/client-newsletter/services/clientNewsletterService.ts`
- Create: `FRONT/src/features/client-newsletter/services/clientNewsletterService.test.ts`

**Interfaces:**
- Consumes: contrats HTTP de la Tâche 4 ; table `client_newsletter_sends` (Tâche 1) ; `env.PUBLIC_NEWSLETTER_API_URL`.
- Produces:
  - `type NewsletterDraft = { subject: string; message: string }`
  - `type SendStarted = { id: string; recipient_count: number }`
  - `type ClientNewsletterSendStatus = "sending" | "done" | "failed"`
  - `interface ClientNewsletterSend { id; subject; message; sent_by; status; recipient_count; sent_count; failed_count; error: string | null; created_at; finished_at: string | null; author_name: string | null }`
  - `fetchRecipientCount(signal?: AbortSignal): Promise<number>`
  - `startClientNewsletterSend(draft: NewsletterDraft): Promise<SendStarted>`
  - `sendClientNewsletterTest(draft: NewsletterDraft): Promise<{ to: string }>`
  - `fetchSendHistory(limit?: number): Promise<ClientNewsletterSend[]>`

- [ ] **Step 1: Écrire `types.ts`**

```ts
export interface NewsletterDraft {
    subject: string
    message: string
}

export interface SendStarted {
    id: string
    recipient_count: number
}

export type ClientNewsletterSendStatus = "sending" | "done" | "failed"

/** Ligne de `client_newsletter_sends` + nom de l'auteur (profiles). */
export interface ClientNewsletterSend {
    id: string
    subject: string
    message: string
    sent_by: string
    status: ClientNewsletterSendStatus
    recipient_count: number
    sent_count: number
    failed_count: number
    error: string | null
    created_at: string
    finished_at: string | null
    author_name: string | null
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

```ts
import { beforeEach, expect, rstest, test } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const tables: Record<string, { data: unknown; error: unknown }> = {}
    const calls: { table: string; method: string; args: unknown[] }[] = []
    const from = rstest.fn((table: string) => {
        const builder: Record<string, unknown> = {}
        for (const m of ["select", "order", "limit", "in"]) {
            builder[m] = rstest.fn((...args: unknown[]) => {
                calls.push({ table, method: m, args })
                return builder
            })
        }
        builder.then = (resolve: (v: unknown) => void) => resolve(tables[table])
        return builder
    })
    return { tables, calls, from }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        auth: {
            getSession: async () => ({
                data: { session: { access_token: "tok" } },
            }),
        },
    },
}))

rstest.mock("@/shared/lib/env", () => ({
    env: { PUBLIC_NEWSLETTER_API_URL: "https://api.test" },
}))

const fetchMock = rstest.fn()

beforeEach(() => {
    fetchMock.mockReset()
    mocks.calls.length = 0
    globalThis.fetch = fetchMock as unknown as typeof fetch
})

// Objet minimal plutôt que `new Response` : l'environnement jsdom ne garantit
// pas les globaux fetch de Node.
const response = (status: number, body: string) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    json: async () => JSON.parse(body),
})

test("startClientNewsletterSend poste le brouillon avec le jeton", async () => {
    const { startClientNewsletterSend } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(
        response(202, JSON.stringify({ id: "s1", recipient_count: 3 }))
    )

    const res = await startClientNewsletterSend({ subject: "S", message: "M" })

    expect(res).toEqual({ id: "s1", recipient_count: 3 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.test/clients/newsletter/send")
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer tok")
    expect(JSON.parse(init.body)).toEqual({ subject: "S", message: "M" })
})

test("remonte le message du serveur (409) sans le saut de ligne final", async () => {
    const { startClientNewsletterSend } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(409, "Un envoi est déjà en cours.\n"))

    await expect(
        startClientNewsletterSend({ subject: "S", message: "M" })
    ).rejects.toThrow(/^Un envoi est déjà en cours\.$/)
})

test("message par défaut quand le serveur ne renvoie rien", async () => {
    const { sendClientNewsletterTest } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(502, ""))

    await expect(
        sendClientNewsletterTest({ subject: "S", message: "M" })
    ).rejects.toThrow("Erreur lors de l'envoi du test.")
})

test("fetchRecipientCount lit le compteur serveur", async () => {
    const { fetchRecipientCount } = await import("./clientNewsletterService")
    fetchMock.mockResolvedValue(response(200, JSON.stringify({ count: 42 })))

    expect(await fetchRecipientCount()).toBe(42)
    expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.test/clients/newsletter/recipients"
    )
})

test("fetchSendHistory joint le nom de l'auteur", async () => {
    const { fetchSendHistory } = await import("./clientNewsletterService")
    mocks.tables.client_newsletter_sends = {
        data: [
            { id: "s1", sent_by: "u1", subject: "A" },
            { id: "s2", sent_by: "u2", subject: "B" },
        ],
        error: null,
    }
    mocks.tables.profiles = {
        data: [{ user_id: "u1", full_name: "Noé" }],
        error: null,
    }

    const rows = await fetchSendHistory()

    expect(rows.map(r => r.author_name)).toEqual(["Noé", null])
    expect(
        mocks.calls.find(c => c.table === "profiles" && c.method === "in")?.args
    ).toEqual(["user_id", ["u1", "u2"]])
})

test("fetchSendHistory propage l'erreur Supabase", async () => {
    const { fetchSendHistory } = await import("./clientNewsletterService")
    mocks.tables.client_newsletter_sends = {
        data: null,
        error: { message: "permission denied" },
    }

    await expect(fetchSendHistory()).rejects.toThrow(
        "Erreur lors du chargement de l'historique."
    )
})
```

- [ ] **Step 3: Lancer — échec attendu**

Run: `cd "$FRONT" && npx rstest run src/features/client-newsletter/services/clientNewsletterService.test.ts`
Expected: FAIL — module `./clientNewsletterService` introuvable.

- [ ] **Step 4: Implémenter le service**

```ts
// ── services/clientNewsletterService.ts ──────────────────────────────────────
// Newsletter clients : routes du service Go newsletter-console
// (/clients/newsletter/*, permission newsletter_clients.send) et lecture de
// l'historique `client_newsletter_sends` (écrit par le service Go seul).
//
// `client_newsletter_sends` n'est pas encore dans les types Supabase générés :
// casts `as any` ponctuels, comme arrivage-admin/services/newsletterService.ts.

import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type {
    ClientNewsletterSend,
    NewsletterDraft,
    SendStarted,
} from "@/features/client-newsletter/types"

const NEWSLETTER_API = env.PUBLIC_NEWSLETTER_API_URL ?? ""

async function authHeaders(): Promise<Record<string, string>> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
}

/** Le service Go renvoie des messages français via http.Error (suivis d'un \n). */
async function readJSON<T>(res: Response, fallback: string): Promise<T> {
    if (!res.ok) {
        const msg = (await res.text()).trim()
        throw new Error(msg || fallback)
    }
    return (await res.json()) as T
}

async function postDraft<T>(
    path: string,
    draft: NewsletterDraft,
    fallback: string
): Promise<T> {
    const res = await fetch(`${NEWSLETTER_API}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
        },
        body: JSON.stringify({ subject: draft.subject, message: draft.message }),
    })
    return readJSON<T>(res, fallback)
}

/** Nombre exact de mails qui partiront (filtre + dédoublonnage serveur). */
export async function fetchRecipientCount(signal?: AbortSignal): Promise<number> {
    const res = await fetch(`${NEWSLETTER_API}/clients/newsletter/recipients`, {
        method: "GET",
        headers: await authHeaders(),
        signal,
    })
    const body = await readJSON<{ count: number }>(
        res,
        "Erreur lors du comptage des destinataires."
    )
    return body.count
}

export function startClientNewsletterSend(
    draft: NewsletterDraft
): Promise<SendStarted> {
    return postDraft<SendStarted>(
        "/clients/newsletter/send",
        draft,
        "Erreur lors du lancement de l'envoi."
    )
}

export function sendClientNewsletterTest(
    draft: NewsletterDraft
): Promise<{ to: string }> {
    return postDraft<{ to: string }>(
        "/clients/newsletter/test",
        draft,
        "Erreur lors de l'envoi du test."
    )
}

type SendRow = Omit<ClientNewsletterSend, "author_name">

export async function fetchSendHistory(
    limit = 20
): Promise<ClientNewsletterSend[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("client_newsletter_sends")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)
    if (error) throw new Error("Erreur lors du chargement de l'historique.")
    const rows = (data as SendRow[] | null) ?? []

    const authorIds = [...new Set(rows.map(r => r.sent_by))]
    const names = new Map<string, string | null>()
    if (authorIds.length > 0) {
        const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", authorIds)
        for (const p of profiles ?? []) names.set(p.user_id, p.full_name)
    }

    return rows.map(r => ({ ...r, author_name: names.get(r.sent_by) ?? null }))
}
```

- [ ] **Step 5: Lancer — succès attendu**

Run: `cd "$FRONT" && npx rstest run src/features/client-newsletter/services/clientNewsletterService.test.ts`
Expected: 6 tests PASS. Si `p.user_id` est typé `string | null` par les types générés, remplacer la boucle par `if (p.user_id) names.set(p.user_id, p.full_name)`.

- [ ] **Step 6: Fin de tâche** — lister les fichiers créés. Ne pas commiter.

---

### Task 7: Front — page Newsletter (hooks, composants, route, sidebar)

**Files:**
- Create: `FRONT/src/features/client-newsletter/utils/submitState.ts`
- Create: `FRONT/src/features/client-newsletter/utils/submitState.test.ts`
- Create: `FRONT/src/features/client-newsletter/hooks/data/useNewsletterRecipientCount.ts`
- Create: `FRONT/src/features/client-newsletter/hooks/data/useNewsletterHistory.ts`
- Create: `FRONT/src/features/client-newsletter/hooks/data/useNewsletterSend.ts`
- Create: `FRONT/src/features/client-newsletter/components/ConfirmSendDialog.tsx`
- Create: `FRONT/src/features/client-newsletter/components/NewsletterComposer.tsx`
- Create: `FRONT/src/features/client-newsletter/components/SendHistory.tsx`
- Create: `FRONT/src/features/client-newsletter/routes/ClientNewsletter.tsx`
- Create: `FRONT/src/features/client-newsletter/index.ts`
- Modify: `FRONT/src/app/routes/router.tsx` (après le bloc `/bibliotheque`, ~ligne 548)
- Modify: `FRONT/src/shared/components/layout/menuItems.ts` (après l'entrée `bibliotheque`, ~ligne 177)

**Interfaces:**
- Consumes: tout le service de la Tâche 6.
- Produces:
  - `getSubmitState(input: { subject: string; message: string; recipientCount: number | null; hasActiveSend: boolean; busy: boolean }): { canTest: boolean; canSend: boolean; reason: string | null }`
  - `useNewsletterRecipientCount(): { count: number | null; loading: boolean; reload: () => void }`
  - `useNewsletterHistory(): { sends: ClientNewsletterSend[]; loading: boolean; hasActiveSend: boolean; reload: () => void }`
  - `useNewsletterSend(): { testing: boolean; sending: boolean; sendTest: (d: NewsletterDraft) => Promise<void>; send: (d: NewsletterDraft) => Promise<boolean> }`

- [ ] **Step 1: Écrire le test de `getSubmitState` (échec attendu)**

```ts
import { expect, test } from "@rstest/core"
import { getSubmitState } from "./submitState"

const base = {
    subject: "Nouveautés",
    message: "Bonjour",
    recipientCount: 12,
    hasActiveSend: false,
    busy: false,
}

test("tout est rempli : test et envoi possibles", () => {
    expect(getSubmitState(base)).toEqual({ canTest: true, canSend: true, reason: null })
})

test("sujet ou message vide (espaces compris) : rien n'est possible", () => {
    expect(getSubmitState({ ...base, subject: "   " })).toMatchObject({
        canTest: false,
        canSend: false,
        reason: "Renseignez le sujet et le message.",
    })
    expect(getSubmitState({ ...base, message: "" }).canSend).toBe(false)
})

test("aucun abonné : test possible, envoi impossible", () => {
    expect(getSubmitState({ ...base, recipientCount: 0 })).toEqual({
        canTest: true,
        canSend: false,
        reason: "Aucun client abonné avec une adresse email.",
    })
})

test("compteur pas encore chargé : envoi impossible", () => {
    expect(getSubmitState({ ...base, recipientCount: null }).canSend).toBe(false)
})

test("envoi déjà en cours : test possible, envoi impossible", () => {
    expect(getSubmitState({ ...base, hasActiveSend: true })).toEqual({
        canTest: true,
        canSend: false,
        reason: "Un envoi est en cours.",
    })
})

test("requête en vol : tout est bloqué", () => {
    expect(getSubmitState({ ...base, busy: true })).toMatchObject({
        canTest: false,
        canSend: false,
    })
})

test("sujet trop long : rien n'est possible", () => {
    expect(getSubmitState({ ...base, subject: "a".repeat(201) })).toMatchObject({
        canTest: false,
        canSend: false,
        reason: "Le sujet dépasse 200 caractères.",
    })
})
```

Run: `cd "$FRONT" && npx rstest run src/features/client-newsletter/utils/submitState.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 2: Implémenter `submitState.ts`**

```ts
export const MAX_SUBJECT_LENGTH = 200
export const MAX_MESSAGE_LENGTH = 20000

interface SubmitInput {
    subject: string
    message: string
    recipientCount: number | null
    hasActiveSend: boolean
    busy: boolean
}

interface SubmitState {
    canTest: boolean
    canSend: boolean
    reason: string | null
}

/**
 * Règles d'activation des boutons « M'envoyer un test » / « Envoyer ».
 * Mêmes limites que la validation serveur (internal/clientnews/compose.go).
 */
export function getSubmitState(input: SubmitInput): SubmitState {
    const subject = input.subject.trim()
    const message = input.message.trim()

    const draftError =
        !subject || !message
            ? "Renseignez le sujet et le message."
            : [...subject].length > MAX_SUBJECT_LENGTH
              ? "Le sujet dépasse 200 caractères."
              : [...message].length > MAX_MESSAGE_LENGTH
                ? "Le message dépasse 20 000 caractères."
                : null

    if (draftError) return { canTest: false, canSend: false, reason: draftError }
    if (input.busy) return { canTest: false, canSend: false, reason: null }
    if (input.hasActiveSend)
        return { canTest: true, canSend: false, reason: "Un envoi est en cours." }
    if (input.recipientCount === 0)
        return {
            canTest: true,
            canSend: false,
            reason: "Aucun client abonné avec une adresse email.",
        }
    if (input.recipientCount === null)
        return { canTest: true, canSend: false, reason: null }
    return { canTest: true, canSend: true, reason: null }
}
```

Run: `cd "$FRONT" && npx rstest run src/features/client-newsletter/utils/submitState.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 3: Hooks**

`hooks/data/useNewsletterRecipientCount.ts` :

```ts
import { useCallback, useEffect, useState } from "react"
import { fetchRecipientCount } from "@/features/client-newsletter/services/clientNewsletterService"

export function useNewsletterRecipientCount() {
    const [count, setCount] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [version, setVersion] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        fetchRecipientCount(controller.signal)
            .then(setCount)
            .catch((e: unknown) => {
                if (controller.signal.aborted) return
                console.error("[client-newsletter] comptage", e)
                setCount(null)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [version])

    const reload = useCallback(() => setVersion(v => v + 1), [])
    return { count, loading, reload }
}
```

`hooks/data/useNewsletterHistory.ts` :

```ts
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchSendHistory } from "@/features/client-newsletter/services/clientNewsletterService"
import type { ClientNewsletterSend } from "@/features/client-newsletter/types"

const POLL_MS = 3000

/** Historique des envois ; rafraîchi toutes les 3 s tant qu'un envoi est en cours. */
export function useNewsletterHistory() {
    const [sends, setSends] = useState<ClientNewsletterSend[]>([])
    const [loading, setLoading] = useState(true)

    const reload = useCallback(async () => {
        try {
            setSends(await fetchSendHistory())
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void reload()
    }, [reload])

    const hasActiveSend = sends.some(s => s.status === "sending")

    useEffect(() => {
        if (!hasActiveSend) return
        const id = window.setInterval(() => void reload(), POLL_MS)
        return () => window.clearInterval(id)
    }, [hasActiveSend, reload])

    return { sends, loading, hasActiveSend, reload }
}
```

`hooks/data/useNewsletterSend.ts` :

```ts
import { useState } from "react"
import { toast } from "sonner"
import {
    sendClientNewsletterTest,
    startClientNewsletterSend,
} from "@/features/client-newsletter/services/clientNewsletterService"
import type { NewsletterDraft } from "@/features/client-newsletter/types"

const errorMessage = (e: unknown) =>
    e instanceof Error ? e.message : "Erreur inattendue."

export function useNewsletterSend() {
    const [testing, setTesting] = useState(false)
    const [sending, setSending] = useState(false)

    const sendTest = async (draft: NewsletterDraft) => {
        setTesting(true)
        try {
            const { to } = await sendClientNewsletterTest(draft)
            toast.success(`Test envoyé à ${to}.`)
        } catch (e: unknown) {
            toast.error(errorMessage(e))
        } finally {
            setTesting(false)
        }
    }

    /** Renvoie true si l'envoi a bien démarré (202). */
    const send = async (draft: NewsletterDraft): Promise<boolean> => {
        setSending(true)
        try {
            const { recipient_count } = await startClientNewsletterSend(draft)
            toast.success(
                `Envoi lancé vers ${recipient_count} client${recipient_count > 1 ? "s" : ""}.`
            )
            return true
        } catch (e: unknown) {
            toast.error(errorMessage(e))
            return false
        } finally {
            setSending(false)
        }
    }

    return { testing, sending, sendTest, send }
}
```

- [ ] **Step 4: Composants**

`components/ConfirmSendDialog.tsx` :

```tsx
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"

interface ConfirmSendDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    recipientCount: number
    subject: string
    onConfirm: () => void
}

export function ConfirmSendDialog({
    open,
    onOpenChange,
    recipientCount,
    subject,
    onConfirm,
}: ConfirmSendDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Envoyer la newsletter ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        « {subject} » va être envoyé à{" "}
                        <strong>
                            {recipientCount} client{recipientCount > 1 ? "s" : ""}
                        </strong>
                        . Cette action est irréversible.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm}>Envoyer</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
```

`components/NewsletterComposer.tsx` :

```tsx
import { useState } from "react"
import { Send, FlaskConical, Users } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { ConfirmSendDialog } from "@/features/client-newsletter/components/ConfirmSendDialog"
import { useNewsletterSend } from "@/features/client-newsletter/hooks/data/useNewsletterSend"
import {
    getSubmitState,
    MAX_SUBJECT_LENGTH,
} from "@/features/client-newsletter/utils/submitState"

interface NewsletterComposerProps {
    recipientCount: number | null
    hasActiveSend: boolean
    onSent: () => void
}

export function NewsletterComposer({
    recipientCount,
    hasActiveSend,
    onSent,
}: NewsletterComposerProps) {
    const [subject, setSubject] = useState("")
    const [message, setMessage] = useState("")
    const [confirmOpen, setConfirmOpen] = useState(false)
    const { testing, sending, sendTest, send } = useNewsletterSend()

    const state = getSubmitState({
        subject,
        message,
        recipientCount,
        hasActiveSend,
        busy: testing || sending,
    })
    const draft = { subject: subject.trim(), message: message.trim() }

    const handleConfirm = async () => {
        setConfirmOpen(false)
        if (await send(draft)) {
            setSubject("")
            setMessage("")
            onSent()
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    {recipientCount === null
                        ? "Comptage des abonnés…"
                        : `${recipientCount} client${recipientCount > 1 ? "s" : ""} abonné${recipientCount > 1 ? "s" : ""} recevr${recipientCount > 1 ? "ont" : "a"} ce mail`}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="newsletter-subject">Sujet</Label>
                    <Input
                        id="newsletter-subject"
                        value={subject}
                        maxLength={MAX_SUBJECT_LENGTH}
                        onChange={e => setSubject(e.target.value)}
                        placeholder="Ex. : Nouvel arrivage de vestes vintage"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newsletter-message">Message</Label>
                    <Textarea
                        id="newsletter-message"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={12}
                        placeholder={"Bonjour,\n\n…"}
                    />
                    <p className="text-xs text-muted-foreground">
                        Les retours à la ligne sont conservés. Un lien de
                        désinscription est ajouté automatiquement en bas du mail.
                    </p>
                </div>
                {state.reason && (
                    <p className="text-sm text-muted-foreground">{state.reason}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={!state.canTest}
                        onClick={() => void sendTest(draft)}
                    >
                        <FlaskConical className="h-4 w-4" />
                        {testing ? "Envoi du test…" : "M'envoyer un test"}
                    </Button>
                    <Button
                        disabled={!state.canSend}
                        onClick={() => setConfirmOpen(true)}
                    >
                        <Send className="h-4 w-4" />
                        {sending ? "Lancement…" : "Envoyer"}
                    </Button>
                </div>
            </CardContent>
            <ConfirmSendDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                recipientCount={recipientCount ?? 0}
                subject={draft.subject}
                onConfirm={() => void handleConfirm()}
            />
        </Card>
    )
}
```

`components/SendHistory.tsx` :

```tsx
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/shared/ui/atoms/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import type {
    ClientNewsletterSend,
    ClientNewsletterSendStatus,
} from "@/features/client-newsletter/types"

const STATUS_BADGE: Record<
    ClientNewsletterSendStatus,
    { label: string; variant: "default" | "success" | "destructive" }
> = {
    sending: { label: "En cours", variant: "default" },
    done: { label: "Envoyé", variant: "success" },
    failed: { label: "Échec", variant: "destructive" },
}

interface SendHistoryProps {
    sends: ClientNewsletterSend[]
    loading: boolean
}

export function SendHistory({ sends, loading }: SendHistoryProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Historique des envois</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <Skeleton className="h-24 w-full" />
                ) : sends.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Aucun envoi pour l'instant.
                    </p>
                ) : (
                    <div className="divide-y divide-border rounded-lg border">
                        {sends.map(s => {
                            const badge = STATUS_BADGE[s.status]
                            return (
                                <div
                                    key={s.id}
                                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate font-medium">{s.subject}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {format(new Date(s.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                                            {s.author_name ? ` · ${s.author_name}` : ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground">
                                            {s.sent_count}/{s.recipient_count} envoyés
                                            {s.failed_count > 0 ? ` · ${s.failed_count} échec${s.failed_count > 1 ? "s" : ""}` : ""}
                                        </span>
                                        <Badge variant={badge.variant} title={s.error ?? undefined}>
                                            {badge.label}
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
```

- [ ] **Step 5: Page + index**

`routes/ClientNewsletter.tsx` :

```tsx
import { Mail } from "lucide-react"
import { NewsletterComposer } from "@/features/client-newsletter/components/NewsletterComposer"
import { SendHistory } from "@/features/client-newsletter/components/SendHistory"
import { useNewsletterHistory } from "@/features/client-newsletter/hooks/data/useNewsletterHistory"
import { useNewsletterRecipientCount } from "@/features/client-newsletter/hooks/data/useNewsletterRecipientCount"

/** Page « Newsletter » (catégorie Commercial) : rédaction + historique. */
export default function ClientNewsletter() {
    const { count, reload: reloadCount } = useNewsletterRecipientCount()
    const { sends, loading, hasActiveSend, reload } = useNewsletterHistory()

    return (
        <div className="flex-1 p-4 sm:p-6 space-y-6">
            <header className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Newsletter clients</h1>
                    <p className="text-sm text-muted-foreground">
                        Envoyez un mail à tous les clients abonnés (case « Abonné à
                        la newsletter » sur la fiche client).
                    </p>
                </div>
            </header>
            <NewsletterComposer
                recipientCount={count}
                hasActiveSend={hasActiveSend}
                onSent={() => {
                    void reload()
                    reloadCount()
                }}
            />
            <SendHistory sends={sends} loading={loading} />
        </div>
    )
}
```

`index.ts` :

```ts
export { default as ClientNewsletter } from "./routes/ClientNewsletter"
export type { ClientNewsletterSend, NewsletterDraft } from "./types"
```

- [ ] **Step 6: Route** — dans `src/app/routes/router.tsx`, après le bloc `path: "/bibliotheque"` (qui se termine ~ligne 548), insérer :

```tsx
            {
                path: "/newsletter",
                handle: {
                    featureKey: "client_newsletter",
                    permissionCode: "newsletter_clients.send",
                    requireMfa: true,
                },
                lazy: async () => {
                    const m =
                        await import("@/features/client-newsletter/routes/ClientNewsletter")
                    return { Component: m.default }
                },
            },
```

- [ ] **Step 7: Sidebar** — dans `src/shared/components/layout/menuItems.ts`, après l'entrée `title: "bibliotheque"` (avant `// Catégorie : Entrepôt`) :

```ts
    {
        title: "newsletter",
        displayName: "Newsletter",
        icon: Mail,
        href: "/newsletter",
        permissionCode: "newsletter_clients.send",
        category: "Commercial",
        icon_main: Handshake,
    },
```

(`Mail` est déjà importé en tête du fichier.)

- [ ] **Step 8: Vérifications**

Run: `cd "$FRONT" && npx rstest run src/features/client-newsletter && npm run typecheck && npx eslint src/features/client-newsletter src/app/routes/router.tsx src/shared/components/layout/menuItems.ts`
Expected: tests PASS ; typecheck sans nouvelle erreur (comparer au nombre d'erreurs de `git stash && npm run typecheck` si doute) ; eslint sans erreur sur ces fichiers.

- [ ] **Step 9: Fin de tâche** — lister les fichiers. Ne pas commiter.

---

### Task 8: Front — case « Abonné à la newsletter » sur la fiche client

**Files:**
- Modify: `FRONT/src/features/crm/types/client.ts` (interface `Client`, ~ligne 61)
- Modify: `FRONT/src/features/crm/services/clientService.ts` (après `updateClientRow`, ~ligne 153)
- Modify: `FRONT/src/features/crm/services/clientService.test.ts`
- Create: `FRONT/src/features/crm/hooks/data/useClientNewsletterOptIn.ts`
- Create: `FRONT/src/features/crm/components/Client/NewsletterOptIn.tsx`
- Modify: `FRONT/src/features/crm/components/Client/Fiche_split/colonneg.tsx` (composant `ClientInfo`, ~ligne 1430)

**Interfaces:**
- Consumes: colonnes `newsletter`, `newsletter_updated_at` (Tâche 1).
- Produces: `updateClientNewsletter(id: string, value: boolean): Promise<string>` (renvoie le nouveau `newsletter_updated_at`) ; `useClientNewsletterOptIn(client)` → `{ checked: boolean; updatedAt: string | null; saving: boolean; toggle: (value: boolean) => Promise<void> }` ; `<NewsletterOptIn client={...} />`.

- [ ] **Step 1: Test qui échoue** — dans `clientService.test.ts`, ajouter `"update"` à la liste des méthodes chaînables du builder mocké (`for (const m of ["order", "range", "or", "eq", "limit", "lt", "update"])`), puis ajouter à la fin :

```ts
test("updateClientNewsletter : 0 ligne modifiée ⇒ erreur (RLS silencieuse)", async () => {
    const { updateClientNewsletter } = await import("./clientService")
    mocks.setResponses([{ data: [], error: null }])

    await expect(updateClientNewsletter("c1", true)).rejects.toThrow(
        "Mise à jour refusée"
    )
})

test("updateClientNewsletter renvoie la date de bascule", async () => {
    const { updateClientNewsletter } = await import("./clientService")
    mocks.setResponses([
        {
            data: [{ id: "c1", newsletter_updated_at: "2026-10-14T10:00:00Z" }],
            error: null,
        },
    ])

    await expect(updateClientNewsletter("c1", true)).resolves.toBe(
        "2026-10-14T10:00:00Z"
    )
})
```

Note : le builder mocké sert les réponses selon `selects.length` ; `updateClientNewsletter` appelle `.select(...)` une fois, donc la première réponse est servie.

Run: `cd "$FRONT" && npx rstest run src/features/crm/services/clientService.test.ts`
Expected: FAIL — `updateClientNewsletter` n'existe pas.

- [ ] **Step 2: Implémenter dans `clientService.ts`** (après `updateClientRow`)

```ts
/**
 * Bascule l'opt-in newsletter d'un client et horodate le consentement.
 * `newsletter` / `newsletter_updated_at` (migration 20261014120000) ne sont
 * pas encore dans les types générés : cast ponctuel. Une RLS qui bloque
 * l'UPDATE ne renvoie pas d'erreur, juste 0 ligne — traité comme un échec
 * (même garde-fou que updateSubscriberCrmStat).
 */
export async function updateClientNewsletter(
    id: string,
    value: boolean
): Promise<string> {
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("client_crm")
        .update({ newsletter: value, newsletter_updated_at: now })
        .eq("id", id)
        .select("id, newsletter_updated_at")
    if (error) throw new Error("Erreur lors de la mise à jour de l'abonnement.")
    if (!data || data.length === 0)
        throw new Error(
            "Mise à jour refusée (droits insuffisants ou client introuvable)."
        )
    return (data[0].newsletter_updated_at as string | null) ?? now
}
```

Run: `cd "$FRONT" && npx rstest run src/features/crm/services/clientService.test.ts`
Expected: PASS (tests existants compris).

- [ ] **Step 3: Type `Client`** — dans `src/features/crm/types/client.ts`, interface `Client`, après `numero_TVA` :

```ts
    /** Opt-in newsletter clients (false par défaut). */
    newsletter?: boolean
    /** Dernière bascule de l'opt-in (consentement / désinscription). */
    newsletter_updated_at?: string | null
```

- [ ] **Step 4: Hook `useClientNewsletterOptIn.ts`**

```ts
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { updateClientNewsletter } from "@/features/crm/services/clientService"
import type { Client } from "@/features/crm/types/client"

/** Opt-in newsletter d'un client, avec mise à jour optimiste + rollback. */
export function useClientNewsletterOptIn(client: Client | null | undefined) {
    const [checked, setChecked] = useState(!!client?.newsletter)
    const [updatedAt, setUpdatedAt] = useState<string | null>(
        client?.newsletter_updated_at ?? null
    )
    const [saving, setSaving] = useState(false)

    // Resynchronise quand la fiche affichée change ou est rechargée.
    useEffect(() => {
        setChecked(!!client?.newsletter)
        setUpdatedAt(client?.newsletter_updated_at ?? null)
    }, [client?.id, client?.newsletter, client?.newsletter_updated_at])

    const toggle = async (value: boolean) => {
        if (!client?.id) return
        const previous = checked
        setChecked(value)
        setSaving(true)
        try {
            setUpdatedAt(await updateClientNewsletter(client.id, value))
            toast.success(value ? "Client abonné à la newsletter." : "Client désabonné de la newsletter.")
        } catch (e: unknown) {
            setChecked(previous)
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            setSaving(false)
        }
    }

    return { checked, updatedAt, saving, toggle }
}
```

- [ ] **Step 5: Composant `NewsletterOptIn.tsx`**

```tsx
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Switch } from "@/shared/ui/atoms/switch"
import { Label } from "@/shared/ui/atoms/label"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { useClientNewsletterOptIn } from "@/features/crm/hooks/data/useClientNewsletterOptIn"
import type { Client } from "@/features/crm/types/client"
import { cn } from "@/shared/lib/utils"

interface NewsletterOptInProps {
    client: Client | null | undefined
    className?: string
}

/** Case « Abonné à la newsletter » de la fiche client. */
export function NewsletterOptIn({ client, className }: NewsletterOptInProps) {
    const { checked, updatedAt, saving, toggle } = useClientNewsletterOptIn(client)
    const hasMail = !!client?.mail?.trim()
    const id = `newsletter-optin-${client?.id ?? "none"}`

    const control = (
        <div className="flex items-center gap-2">
            <Switch
                id={id}
                checked={checked}
                disabled={!hasMail || saving || !client?.id}
                onCheckedChange={v => void toggle(v)}
            />
            <Label htmlFor={id} className="text-sm font-medium">
                Abonné à la newsletter
            </Label>
        </div>
    )

    return (
        <div
            className={cn(
                "flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2",
                className
            )}
        >
            {hasMail ? (
                control
            ) : (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div>{control}</div>
                    </TooltipTrigger>
                    <TooltipContent>Ajoutez un email pour abonner ce client</TooltipContent>
                </Tooltip>
            )}
            {updatedAt && (
                <span className="text-xs text-muted-foreground">
                    modifié le {format(new Date(updatedAt), "dd/MM/yyyy", { locale: fr })}
                </span>
            )}
        </div>
    )
}
```

Vérifier le chemin de `cn` : `grep -n "import { cn }" src/features/crm/components/Client/Fiche_split/colonneg.tsx` et utiliser le même import.

- [ ] **Step 6: Insertion dans `colonneg.tsx`** — ajouter l'import en tête :

```tsx
import { NewsletterOptIn } from "@/features/crm/components/Client/NewsletterOptIn"
```

et, dans `ClientInfo`, juste après le bloc `{customer?.mail && ( <Button … copyRebookLink … )}` (avant la fermeture `</div>` de la grille, ~ligne 1432), une seule ligne :

```tsx
                    <NewsletterOptIn client={customer} className="col-span-2" />
```

- [ ] **Step 7: Vérifier que `newsletter` arrive bien dans `customer`**

La fiche charge la ligne complète via `fetchOneClientRow` (`select("*, …")`) : `newsletter` y est inclus automatiquement. Vérifier qu'aucun mapping intermédiaire ne filtre les champs :
Run: `cd "$FRONT" && grep -n "fetchOneClient\b\|const fetchOneClient" src/features/crm/hooks/CRM_hook/use_client.tsx | head`
Lire la fonction : si elle reconstruit un objet `Client` champ par champ, y ajouter `newsletter` et `newsletter_updated_at`.

- [ ] **Step 8: Vérifications**

Run: `cd "$FRONT" && npx rstest run src/features/crm && npm run typecheck && npm run lint`
Expected: tests CRM PASS ; typecheck et lint sans hausse du nombre d'erreurs.

- [ ] **Step 9: Fin de tâche** — lister les fichiers. Ne pas commiter.

---

### Task 9: Vérification de bout en bout et suivi

**Files:**
- Modify (si concerné) : `FRONT/docs/PLAN_ASSAINISSEMENT.md` §10

- [ ] **Step 1: Gates complètes**

Run: `cd "$GO" && go vet ./... && go test ./... -race`
Run: `cd "$FRONT" && npm run lint && npm run typecheck && npx rstest run src/features/client-newsletter src/features/crm`
Expected: tout vert, aucune hausse du ratchet.

- [ ] **Step 2: PLAN_ASSAINISSEMENT** — `grep -n "colonneg\|client_crm\|newsletter" docs/PLAN_ASSAINISSEMENT.md`. Si `colonneg.tsx` y figure comme dette active, ajouter une ligne au tableau §10 : « 2026-10-14 — ajout de `NewsletterOptIn` par extraction (1 ligne dans colonneg.tsx, pas d'extension du fichier) ».

- [ ] **Step 3: Recette manuelle — avec Alex** (après déploiement Go + variables `CLIENT_UNSUB_SECRET`/`PUBLIC_BASE_URL`, migration appliquée, permission attribuée à son rôle)

1. Sidebar → Commercial → « Newsletter » visible ; invisible pour un compte sans la permission.
2. Compteur = 0 → bouton « Envoyer » désactivé avec le message « Aucun client abonné… ».
3. Fiche d'un client de test (avec l'adresse de Alex) → cocher « Abonné à la newsletter » → toast, date affichée ; recharger la fiche → toujours coché.
4. Fiche d'un client sans email → switch désactivé + tooltip.
5. Page Newsletter → compteur = 1 → « M'envoyer un test » avec un message contenant `<b>test</b> & é` et deux lignes → mail reçu, texte affiché littéralement, sauts de ligne conservés, lien « Se désinscrire » → page « Lien de test ».
6. « Envoyer » → modale « 1 client » → confirmer → historique « En cours » puis « Envoyé 1/1 ».
7. Recliquer « Envoyer » pendant un envoi en cours (avec plusieurs abonnés de test) → bouton désactivé ; via un 2ᵉ onglet → toast « Un envoi est déjà en cours. ».
8. Dans le mail reçu, cliquer « Se désinscrire » → page « Désinscription confirmée » ; la fiche client est décochée avec la date du jour ; recliquer le lien → même page.
9. Vérifier dans Gmail que le bouton natif « Se désinscrire » apparaît (peut nécessiter quelques envois / réputation du domaine — non bloquant).

- [ ] **Step 4: Rapport final** — lister tous les fichiers modifiés dans les deux repos et proposer à Alex les messages de commit (un par repo). **Ne commiter qu'après son accord.**
