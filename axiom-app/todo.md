# AXIOM Native Integration - TODO

## Phase 1 : Architecture et Prompts
- [x] Préparer et intégrer les prompts AXIOM complets
- [x] Concevoir le schéma de base de données pour les conversations et profils
- [ ] Configurer les secrets OpenAI API

## Phase 2 : Backend
- [x] Créer les tables Drizzle pour conversations, sessions candidats et résultats
- [x] Implémenter la procédure tRPC pour l'appel API OpenAI avec streaming
- [x] Créer les helpers pour gérer l'historique des conversations
- [x] Implémenter la logique de transition AXIOM → Matching
- [x] Ajouter les procédures pour sauvegarder les résultats de matching

## Phase 3 : Interface Chat
- [x] Créer le composant ChatBox avec streaming des réponses
- [x] Implémenter la gestion des phases (AXIOM vs Matching)
- [x] Ajouter la persistance de la progression (localStorage + DB)
- [x] Créer l'interface de résultats du matching
- [x] Implémenter le formulaire de feedback candidat

## Phase 4 : Tracking et Notifications
- [x] Implémenter le système de tracking comportemental (scroll, temps, abandon)
- [ ] Créer le système de notifications email au recruteur
- [x] Ajouter les événements de tracking dans la base de données

## Phase 5 : Tests et Optimisation
- [x] Écrire les tests unitaires pour les procédures tRPC
- [x] Tester le streaming et la gestion des erreurs
- [ ] Optimiser les performances et l'UX
- [x] Valider l'intégration complète

## Phase 6 : Livraison
- [ ] Documenter l'architecture et l'utilisation
- [ ] Préparer les instructions de déploiement
- [ ] Créer un checkpoint final
