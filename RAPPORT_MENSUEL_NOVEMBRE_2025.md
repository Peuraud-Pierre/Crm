# Rapport Mensuel d'Avancement - Novembre 2025

**Projet :** Nokk_project
**Date :** 1er Décembre 2025

## 📄 Synthèse Exécutive

Ce mois de novembre a été particulièrement intense et productif. Au-delà des améliorations visuelles, nous avons déployé des modules métiers complets (Logistique, CRM avancé) et refondu l'architecture technique pour supporter la montée en charge. L'application est désormais plus rapide, plus sécurisée et offre de nouveaux outils de collaboration en temps réel.

---

## 🚀 Nouveaux Modules Métiers

### 1. Logistique & Gestion des Stocks (Nouveau Module "Sorters")

Un pan entier de l'application a été développé pour la gestion opérationnelle :

-   **Flux de Tri & Assignation :** Nouvelle interface pour trier et assigner les marchandises ("Balles") aux services concernés.
-   **Gestion des Balles :** Outils de création, suppression et modification des lots de marchandises.
-   **Rapports de Marchandise :** Vues détaillées pour suivre l'état des stocks et des assignations.
-   **Code Couleur par Service :** Identification visuelle immédiate des services pour éviter les erreurs de tri.

### 2. CRM & Commercial (Évolutions Majeures)

Le module commercial a été enrichi pour devenir un véritable outil de pilotage :

-   **Gestion des Tâches :** Nouvelle section dédiée au suivi des tâches commerciales directement dans le CRM.
-   **Assistant de Création Client :** Nouveau formulaire ("Wizard") pour simplifier et fiabiliser la création de fiches clients.
-   **Pipeline de Vente :** Ajustement des étapes du pipeline pour coller à la réalité du terrain.

### 3. Communication & Collaboration

-   **Chat Intégré :** Lancement du nouveau système de messagerie interne centralisé.
-   **Temps Réel (Websockets) :** Les mises à jour (nouveaux clients, messages, tris) s'affichent désormais instantanément sans avoir à rafraîchir la page.
-   **Nouveau Calendrier :** Vue agenda refondue pour une meilleure lisibilité des événements et tâches.

---

## 🎨 Expérience Utilisateur & Interface

### 1. Modernisation Visuelle

-   **Mode Sombre (Dark Mode) :** Option très attendue pour réduire la fatigue visuelle.
-   **Nouvelle Navigation (Sidebar) :** Menu latéral repensé pour un accès plus rapide aux rubriques clés.
-   **Interface Adaptative :** Optimisation complète pour l'usage sur tablettes et petits écrans.

### 2. Gestion de Contenu

-   **Générateur de Contenu :** Refonte complète du moteur de génération pour plus de stabilité.
-   **Prévisualisation :** Amélioration des grilles de prévisualisation des contenus.

---

## 🛡️ Sécurité & Infrastructure Technique

### 1. Sécurité Renforcée (Authentification)

-   **Double Authentification (MFA) :** Mise en place d'un système robuste de validation en deux étapes.
-   **Protection Captcha :** Ajout de sécurités contre les tentatives de connexion automatisées.
-   **Gestion des Permissions :** Affinage des droits d'accès (qui peut voir/modifier quoi) notamment pour les tâches et les projets.

### 2. Performance & Architecture (Le "Moteur")

-   **Vitesse de Chargement :** Mise en place du "Lazy Loading" (chargement progressif) pour que l'application démarre beaucoup plus vite.
-   **Migration Technique (Rsbuild) :** Modernisation des outils de compilation pour des mises à jour plus rapides et une meilleure stabilité.
-   **Architecture "Propre" :** Grand nettoyage du code (Refactoring) sur la gestion des utilisateurs et de l'authentification pour faciliter les futures évolutions.
-   **Journal des Modifications (Changelog) :** Système automatisé pour suivre les versions et les changements de l'application.

---

## 📊 Données Clés & Adoption CRM (Novembre 2025)

Les chiffres du mois témoignent d'une accélération spectaculaire de l'usage de la plateforme, portée par le nouveau module CRM.

### 1. Synthèse & Dynamique

-   **Croissance d'usage :** +557,7 % 🔥 par rapport à octobre.
-   **Volume d'activité :** 171 mises à jour en novembre (contre 26 en octobre).
-   **Adoption :** Le CRM est devenu un outil opérationnel central, avec une activité très concentrée sur la deuxième quinzaine du mois.

### 2. Pic d'Activité (La "Semaine de Feu")

Une intensification majeure a été observée à partir du 17 novembre :

-   **Journée record :** Le 17 novembre a enregistré 51 mises à jour en une seule journée.
-   **Semaine clé :** La semaine du 17 novembre représente à elle seule **69 % de toute l'activité du mois** (118 mises à jour).

### 3. Champions de l'Utilisation

L'activité est actuellement portée par deux utilisateurs "Power Users" qui représentent 100% des mises à jour CRM :

-   **Marceau Gazengel :** 99 mises à jour.
-   **Antoine Geffroy :** 72 mises à jour.
-   _Note : Ces utilisateurs sont restés actifs jusqu'au début du mois de décembre, confirmant une adoption durable._

### 4. Axes d'Amélioration Identifiés

-   **Qualification des Données :** 166 fiches n'ont pas encore de société renseignée. Un effort de qualification sera nécessaire.
-   **Activation Client :** 30 clients n'ont pas été mis à jour en novembre. Une action de "remise à jour / nettoyage" pourrait être envisagée.

---

## 🎯 Prochaines Étapes Prioritaires

Pour décembre, l'objectif est de consolider ces nombreux ajouts :

1.  **Stabilisation :** Surveillance des nouveaux modules (Logistique & Chat) en production.
2.  **Optimisation Continue :** Ajustements basés sur les premiers retours utilisateurs concernant le nouveau CRM.
3.  **Préparation 2026 :** Planification des prochaines briques fonctionnelles majeures.
