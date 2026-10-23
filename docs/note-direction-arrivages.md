# Note à l'intention de la direction
## Déploiement du tableau de suivi des arrivages — Module Stock

**Date :** Juillet 2026  
**Objet :** Présentation de la solution, plan de déploiement et conduite du changement

### Table de version

| Version | Date | Auteur | Résumé |
|---------|------|--------|--------|
| 1.2 | Juillet 2026 | Ethan H. · équipe tech | Déplacement de l'import de packing list en section "Prochaines évolutions" (non déployé en prod à ce jour — vérifié : permission absente de prod/preprod, branche `features/arrivages-packing` non mergée) |
| 1.1 | Juillet 2026 | Ethan H. · équipe tech | Correction §2.4 (retrait de la ligne "Suppression", non représentative des permissions réelles) et §2.5 (reformulation "import de packing list" pour exactitude), ajout de renvois explicites vers la doc technique et le guide utilisateur |
| 1.0 | Juillet 2026 | Ethan H. · équipe tech | Version initiale |

Documents associés : [Documentation technique — Tableau des arrivages](./flow-limited-technical.md) · [Guide utilisateur — Tableau des arrivages](./flow-limited-user-guide.html)

---

## 1. La problématique

### 1.1 Contexte opérationnel

Le suivi des arrivages de conteneurs import repose aujourd'hui sur des pratiques hétérogènes : tableurs Excel partagés, échanges par e-mail, notes internes. Cette pratique demande un entretien manuel quotidien par un point d'entrée unique qui s'occupe de tout.

### 1.2 Les frictions identifiées

**Visibilité fragmentée**  
Aucun point de centralisation n'existe pour savoir, en temps réel, quels conteneurs sont en transit, lesquels arrivent cette semaine, et lesquels sont en attente d'une facture fournisseur. L'information est détenue par les individus, pas par le système.

**Risque facture manquante**  
La réception d'un conteneur sans facture fournisseur associée crée des blocages comptables et douaniers. Ce risque n'était pas traçable ni alerté automatiquement.

<!-- **Absence de traçabilité**  
Il était impossible de reconstituer l'historique d'un conteneur (dates de départ, arrivée au port, déchargement prévu, poids, quantité) sans solliciter manuellement les équipes concernées. -->

<!-- **Double saisie et perte de temps**  
Les informations saisies dans des outils annexes devaient être re-saisies ou adaptées à chaque échange (direction, logistique, comptabilité). -->

---

## 2. La solution déployée

### 2.1 Un tableau de bord centralisé

Le **Tableau des arrivages** est désormais intégré à la Console, dans le module Stock. Il offre une vision unifiée de tous les conteneurs import, accessible depuis un seul endroit, en temps réel.

Chaque arrivage regroupe l'ensemble des informations logistiques sur une seule ligne :

| Information | Détail |
|-------------|--------|
| Fournisseur | Nom + localisation |
| Statut | Planifié → En transit → Reçu |
| Dates clés | Départ, arrivée Le Havre, déchargement prévu (jour, date et heure) |
| Facturation | Date de facture avec alerte si manquante |
| Logistique | Mode de transport, N° conteneur BIC, N° interne |
| Poids & quantité | En kg et en unités |
| Notes | Commentaire libre par arrivage |

### 2.2 Les alertes automatiques

Deux mécanismes d'alerte visuels ont été intégrés pour prévenir proactivement les équipes :

**Alerte imminence (fond ambre)** — Les 5 prochains déchargements sont mis en avant automatiquement dans le tableau, permettant d'anticiper les ressources nécessaires à la réception.

**Alerte facture manquante (fond rouge)** — Dès qu'un arrivage se trouve à 7 jours ou moins de son déchargement prévu sans qu'une date de facture soit renseignée, la ligne passe en rouge. L'équipe sait immédiatement où agir.

### 2.3 L'export Excel intégré

Un export Excel complet ou par période est disponible directement depuis le tableau. Le fichier généré reproduit la structure du tableau avec une mise en forme professionnelle (en-têtes colorés, totaux mensuels, autofiltre). Il remplace les exports manuels précédents et garantit une cohérence des données à chaque extraction.

### 2.4 Le contrôle des accès

Chaque action est contrôlée par un système de permissions :
- **Lecture** : accessible à tous les utilisateurs du module Stock
- **Création** : réservée aux profils habilités à saisir de nouveaux arrivages
- **Modification** : réservée aux profils pouvant mettre à jour les données
- **Export** : contrôlé séparément, avec une granularité par colonne pour les données sensibles

*Détail des permissions techniques : voir la doc technique, §5.*

### 2.5 La newsletter automatique

Les personnes intéressées (direction, commercial, logistique...) peuvent s'abonner pour recevoir, par e-mail et selon les colonnes de leur choix, un état à jour du tableau des arrivages — sans avoir besoin de se connecter à la Console. Dès qu'un arrivage est ajouté, modifié ou supprimé, l'envoi se déclenche automatiquement (avec un court délai pour regrouper les changements rapprochés). C'est un canal d'information supplémentaire, en complément du tableau et de l'export Excel.

L'abonnement et la page d'administration des abonnés sont en production. Le renvoi manuel d'une newsletter par un administrateur est en revanche encore en préproduction, pas encore accessible en prod.

*Détail technique : voir la doc technique, §3.7.*

---

## 3. Plan de déploiement

### Phase 1 — Déploiement silencieux ✅ (réalisé)

Le tableau est déjà actif en production dans la Console. Il est visible par tous les utilisateurs disposant d'un accès au module Stock. Cette phase a permis de stabiliser le système avant communication officielle.

### Phase 2 — Formation des équipes pilotes (à planifier)

**Cible :** équipes commerciale, direction et marketing.
**Format recommandé :** session de 30 minutes en présentiel ou visioconférence  
**Support :** [Guide utilisateur — Tableau des arrivages](./flow-limited-user-guide.html), joint à cette note (format PDF imprimable)  
**Contenu :**
- Lecture du tableau et navigation par mois
- Comprendre les alertes (ambre / rouge) et savoir y répondre
- Réaliser un export Excel
- Découvrir l'accès au wiki interne de la Console, où sont centralisées la documentation et les procédures

### Phase 3 — Ouverture à l'ensemble des utilisateurs concernés

Après validation par les équipes pilotes, les accès seront étendus aux profils identifiés. Les droits de création et de modification seront attribués au cas par cas par l'administrateur selon les responsabilités de chacun.

### Phase 4 — Décommissionnement des outils parallèles

Une fois le tableau adopté et les équipes à l'aise, les tableurs Excel et canaux de communication informels utilisés pour ce suivi pourront être progressivement abandonnés au profit de la Console.

---

## 4. Conduite du changement

### 4.1 Ce qui ne change pas

- Le travail de fond reste identique : les équipes continuent de recevoir les mêmes informations des fournisseurs.
- L'export Excel est toujours disponible pour les utilisateurs qui en ont besoin ponctuellement.
- Aucune donnée existante n'est perdue.

### 4.2 Ce qui change

- La saisie se fait désormais dans la Console, et non plus dans des fichiers locaux.
- Les alertes rendent la surveillance passive : plus besoin de vérifier manuellement chaque semaine les déchargements à venir ou les factures en retard.
- La newsletter automatique permet même de suivre l'essentiel sans se connecter à la Console, pour qui le souhaite.
- Le tableau devient la source de vérité unique pour les arrivages.

### 4.3 Accompagnement prévu

| Étape | Livrable |
|-------|----------|
| Documentation utilisateur | Guide PDF joint (10 sections, FAQ incluse) |
| Documentation technique | Document de référence pour l'équipe IT |
| Support post-déploiement | Période de disponibilité accrue de l'équipe projet les 2 premières semaines |
| Retours utilisateurs | Collecte des retours à J+15 pour ajustements éventuels |

### 4.4 Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Résistance à l'adoption | Formation présentielle + guide illustré disponible à tout moment |
| Saisie incomplète ou oubliée | Alertes visuelles immédiates dans le tableau (rouge / ambre) |
| Perte de données lors de la transition | Les anciens fichiers restent accessibles en parallèle pendant la période de bascule |
| Droits d'accès mal configurés | Revue des profils à effectuer avant ouverture large (Phase 3) |

---

## 5. Prochaines évolutions

### 5.1 L'import de packing lists (en développement)

Une fonctionnalité permettrait d'importer directement les listes de colisage (« packing lists ») transmises par les fournisseurs pour compléter un arrivage déjà créé dans le tableau, avec reconnaissance automatique des catégories de marchandises. **Cette fonctionnalité est en cours de développement et n'est pas déployée à ce jour** (branche de développement non mergée en production). Une communication spécifique sera faite à sa mise en production.

*Détail technique : voir la doc technique, §3.6.*

---

## 6. Ce que nous demandons à la direction

1. **Valider le calendrier** de déploiement des phases 2 et 3.
2. **Désigner les référents** par équipe qui seront formés en premier et serviront de relais.
3. **Communiquer en interne** l'adoption du tableau comme outil officiel de suivi des arrivages, pour donner le signal clair que les pratiques parallèles ont vocation à s'arrêter.

---

## 7. Validation

| Rôle | Nom | Statut |
|------|-----|--------|
| Auteur | Ethan H. · équipe tech | Rédigé |
| Relecteur | *à désigner* | En attente de relecture |

---

*Document préparé par Ethan H. · équipe tech · Juillet 2026*
