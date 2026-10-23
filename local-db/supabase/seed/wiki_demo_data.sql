-- ============================================================
-- Données fictives — Wiki (démo / tests fonctionnels)
--
-- Couvre :
--   - arborescence de catégories sur 3 niveaux (arbre, fil d'Ariane, comptage)
--   - articles publiés ET brouillons (badge « Brouillon », filtrage RLS)
--   - sections texte (markdown : titres, listes, code, tableau, citation, lien)
--   - sections image (URL externe placehold.co — aucun upload requis)
--   - un article « non classé » (category_id NULL)
--
-- Idempotent : on supprime d'abord les lignes de démo par leurs UUID fixes,
-- puis on réinsère. À exécuter via le SQL Editor Supabase (ou psql).
--
-- ⚠️  RLS : ce script écrit directement en base. Le SQL Editor Supabase et
--     psql (rôle service) contournent la RLS. Aucune permission requise ici.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Nettoyage (réexécution sûre)
-- ------------------------------------------------------------
DELETE FROM public.wiki_articles
WHERE id::text LIKE 'b0000000-0000-0000-0000-%';

DELETE FROM public.wiki_categories
WHERE id::text LIKE 'a0000000-0000-0000-0000-%';

-- ------------------------------------------------------------
-- Catégories (parents avant enfants)
-- ------------------------------------------------------------
INSERT INTO public.wiki_categories (id, parent_id, name, position) VALUES
    -- Racines
    ('a0000000-0000-0000-0000-000000000001', NULL, 'Accueil & Intégration', 0),
    ('a0000000-0000-0000-0000-000000000002', NULL, 'Procédures',            1),
    ('a0000000-0000-0000-0000-000000000003', NULL, 'Produit',               2),
    ('a0000000-0000-0000-0000-000000000004', NULL, 'FAQ',                   3),
    -- Niveau 2
    ('a0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'Premiers pas',   0),
    ('a0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000001', 'Outils internes', 1),
    ('a0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000002', 'Ressources humaines', 0),
    ('a0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000002', 'Sécurité',        1),
    ('a0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000003', 'Console',         0),
    ('a0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000003', 'API & Intégrations', 1),
    -- Niveau 3
    ('a0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000022', 'Mots de passe & MFA', 0);

-- ------------------------------------------------------------
-- Articles
-- ------------------------------------------------------------

-- A1 · Premiers pas ------------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011',
 'Bienvenue chez Nokk_project', 'bienvenue-chez-nokk_project', 'published', 0,
 $s$[
   {"id":"s1","type":"text","title":"Bienvenue 👋","content":"# Bienvenue chez Nokk_project\n\nNous sommes ravis de vous compter parmi nous. Ce wiki centralise **toutes les procédures internes**, les guides outils et la FAQ.\n\n> Prenez le temps de parcourir la section *Accueil & Intégration* durant votre première semaine."},
   {"id":"s2","type":"image","url":"https://placehold.co/1200x480/0f766e/ffffff?text=Nokk_project","caption":"L'équipe au complet"},
   {"id":"s3","type":"text","title":"Vos premiers jours","content":"Voici les étapes clés :\n\n1. Récupérer vos accès auprès du service IT\n2. Configurer votre poste de travail\n3. Rejoindre les canaux de communication\n4. Planifier un point avec votre manager\n\nBesoin d'aide ? Écrivez à `support@nokk-project.internal`."}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000011',
 'Configurer son poste de travail', 'configurer-son-poste', 'published', 1,
 $s$[
   {"id":"s1","type":"text","content":"## Prérequis\n\nAvant de commencer, assurez-vous d'avoir reçu vos identifiants SSO.\n\n- Navigateur à jour (Chrome / Firefox)\n- Gestionnaire de mots de passe installé\n- Accès VPN validé"},
   {"id":"s2","type":"text","title":"Installation des outils","content":"Installez les outils standards :\n\n```bash\n# macOS\nbrew install --cask slack notion figma\n```\n\nPuis connectez-vous avec votre compte **@nokk_project**."}
 ]$s$::jsonb);

-- A2 · Outils internes ---------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000012',
 'Accéder à la Console', 'acceder-a-la-console', 'published', 0,
 $s$[
   {"id":"s1","type":"text","content":"La **Console** est l'outil central de pilotage. Connectez-vous sur [console.nokk-project.internal](https://example.com) avec votre SSO.\n\nVos accès dépendent de votre rôle et de votre service."}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000012',
 'Messagerie et calendrier', 'messagerie-et-calendrier', 'draft', 1,
 $s$[
   {"id":"s1","type":"text","content":"> 🚧 Article en cours de rédaction.\n\nProcédure de connexion Outlook / Google à compléter."}
 ]$s$::jsonb);

-- B1 · Ressources humaines -----------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000021',
 'Demander un congé', 'demander-un-conge', 'published', 0,
 $s$[
   {"id":"s1","type":"text","title":"Délais de prévenance","content":"Respectez les délais suivants selon la durée :\n\n| Durée du congé | Prévenance minimale |\n| --- | --- |\n| 1 à 2 jours | 1 semaine |\n| 3 à 5 jours | 2 semaines |\n| Plus d'une semaine | 1 mois |\n\nLes demandes se font depuis la Console, onglet **RH › Congés**."},
   {"id":"s2","type":"text","content":"La validation est faite par votre **manager** puis par les **RH**. Vous recevez une notification à chaque étape."}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000021',
 'Note de frais', 'note-de-frais', 'published', 1,
 $s$[
   {"id":"s1","type":"text","content":"## Remboursement\n\n1. Scannez vos justificatifs\n2. Créez la note dans **RH › Notes de frais**\n3. Joignez les pièces (PDF ou photo)\n4. Soumettez avant le **5 du mois**\n\nLes remboursements sont versés avec la paie du mois suivant."}
 ]$s$::jsonb);

-- B2 · Sécurité ----------------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000022',
 'Politique de sécurité', 'politique-de-securite', 'published', 0,
 $s$[
   {"id":"s1","type":"text","content":"# Politique de sécurité\n\nLa sécurité est l'affaire de tous.\n\n> **Règle d'or :** ne partagez jamais vos identifiants, même avec un collègue de confiance.\n\n## Principes\n\n- Verrouillez votre session en quittant votre poste\n- Signalez tout e-mail suspect à `security@nokk-project.internal`\n- Utilisez exclusivement le gestionnaire de mots de passe officiel"}
 ]$s$::jsonb);

-- B2a · Mots de passe & MFA (niveau 3) -----------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000221',
 'Activer la double authentification (MFA)', 'activer-mfa', 'published', 0,
 $s$[
   {"id":"s1","type":"text","title":"Pourquoi le MFA ?","content":"Le **MFA** ajoute une seconde preuve d'identité en plus du mot de passe. Il est **obligatoire** pour tous les comptes."},
   {"id":"s2","type":"image","url":"https://placehold.co/1000x420/1e293b/ffffff?text=Scanner+le+QR+code","caption":"Étape 2 : scan du QR code dans l'app d'authentification"},
   {"id":"s3","type":"text","title":"Étapes","content":"1. Ouvrez **Profil › Sécurité**\n2. Cliquez sur *Activer le MFA*\n3. Scannez le QR code avec votre application (Authy, Google Authenticator…)\n4. Saisissez le code à 6 chiffres pour confirmer\n5. Conservez vos **codes de secours** en lieu sûr"}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000221',
 'Gérer ses mots de passe', 'gerer-ses-mots-de-passe', 'draft', 1,
 $s$[
   {"id":"s1","type":"text","content":"> 🚧 Brouillon.\n\nRecommandations sur la longueur, l'unicité et la rotation des mots de passe — à finaliser."}
 ]$s$::jsonb);

-- C1 · Console -----------------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000031',
 'Vue d''ensemble de la Console', 'vue-ensemble-console', 'published', 0,
 $s$[
   {"id":"s1","type":"text","content":"La Console regroupe tous les modules métier : **Stock**, **CRM**, **RH**, **Veille** et le **Wiki**.\n\nLa navigation latérale s'adapte automatiquement à vos permissions."},
   {"id":"s2","type":"image","url":"https://placehold.co/1200x560/0f766e/ffffff?text=Console+Overview","caption":"Tableau de bord principal"}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000031',
 'Gérer le wiki', 'gerer-le-wiki', 'published', 1,
 $s$[
   {"id":"s1","type":"text","title":"Mode Gestion","content":"Les utilisateurs disposant de la permission `wiki.manage` voient un interrupteur **Consultation / Gestion** dans la barre d'outils.\n\n- **Consultation** : lecture + édition au fil de l'eau (bouton *Modifier*, *Nouvel article*)\n- **Gestion** : table complète des articles et gestion des catégories"},
   {"id":"s2","type":"text","title":"Brouillons","content":"Un article en **brouillon** n'est visible que des gestionnaires (badge orange). Publiez-le pour le rendre visible à tous."}
 ]$s$::jsonb);

-- C2 · API & Intégrations ------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000032',
 'Authentification API', 'authentification-api', 'published', 0,
 $s$[
   {"id":"s1","type":"text","content":"## Jeton d'accès\n\nAuthentifiez vos requêtes avec un en-tête `Authorization` :\n\n```http\nGET /api/v1/me HTTP/1.1\nHost: api.nokk-project.internal\nAuthorization: Bearer VOTRE_JETON\n```\n\nLes jetons se créent depuis **Profil › API**. Ne les commitez jamais dans un dépôt."}
 ]$s$::jsonb),

('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000032',
 'Webhooks', 'webhooks', 'draft', 1,
 $s$[
   {"id":"s1","type":"text","content":"> 🚧 Brouillon.\n\nExemple de payload reçu :\n\n```json\n{\n  \"event\": \"article.published\",\n  \"id\": \"abc-123\"\n}\n```\n\nDocumentation de signature HMAC à compléter."}
 ]$s$::jsonb);

-- D · FAQ ----------------------------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000014', 'a0000000-0000-0000-0000-000000000004',
 'Questions fréquentes', 'questions-frequentes', 'published', 0,
 $s$[
   {"id":"s1","type":"text","title":"J'ai oublié mon mot de passe","content":"Utilisez le lien **Mot de passe oublié** sur la page de connexion. Un e-mail de réinitialisation vous est envoyé."},
   {"id":"s2","type":"text","title":"Je ne vois pas un module","content":"L'affichage dépend de vos **permissions**. Contactez votre manager ou les RH pour une demande d'accès."},
   {"id":"s3","type":"text","title":"Comment proposer une correction au wiki ?","content":"Si vous avez le rôle gestionnaire, modifiez directement l'article. Sinon, signalez l'erreur à l'équipe Documentation."}
 ]$s$::jsonb);

-- Non classé (category_id NULL) ------------------------------
INSERT INTO public.wiki_articles (id, category_id, title, slug, status, position, sections) VALUES
('b0000000-0000-0000-0000-000000000015', NULL,
 'Article de test non classé', 'article-test-non-classe', 'draft', 0,
 $s$[
   {"id":"s1","type":"text","content":"Cet article n'a **aucune catégorie** : il sert à vérifier l'affichage à la racine et le statut brouillon.\n\nContenu *lorem ipsum* volontairement court."}
 ]$s$::jsonb);

COMMIT;

-- ------------------------------------------------------------
-- Vérification rapide (optionnel)
-- ------------------------------------------------------------
-- SELECT status, count(*) FROM public.wiki_articles
--   WHERE id::text LIKE 'b0000000-%' GROUP BY status;    -- 11 published / 4 draft
-- SELECT count(*) FROM public.wiki_categories
--   WHERE id::text LIKE 'a0000000-%';                    -- 11 catégories
