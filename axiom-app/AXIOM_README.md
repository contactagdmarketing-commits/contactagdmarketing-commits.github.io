# AXIOM Native Integration - Documentation

## Vue d'ensemble

AXIOM Native Integration est une plateforme web complète de profilage et matching de candidats pour Elga Energy. Elle remplace le processus manuel en plusieurs étapes par une expérience de chat intelligente et fluide directement intégrée sur le site.

## Architecture

### Frontend (React + Tailwind CSS)
- **AxiomPage.tsx** : Page principale avec formulaire d'initialisation
- **ChatBox.tsx** : Composant de chat interactif avec streaming des réponses
- **useBehaviorTracking.ts** : Hook pour tracker les comportements utilisateur

### Backend (Express + tRPC)
- **server/routers/axiom.ts** : Procédures tRPC pour gérer les sessions et conversations
- **server/routers/tracking.ts** : Procédures pour tracker les comportements
- **server/db.ts** : Helpers de base de données

### Base de données (MySQL)
- **candidateSessions** : Sessions des candidats avec état et résultats
- **conversationMessages** : Historique des conversations
- **behaviorTracking** : Événements de tracking utilisateur
- **recruiterNotifications** : Notifications pour les recruteurs

## Flux utilisateur

### Phase 1 : Questionnaire AXIOM
1. L'utilisateur arrive sur `/axiom`
2. Il entre son email et nom (optionnel)
3. Une session est créée et l'historique est chargé
4. Le questionnaire AXIOM commence avec 9 blocs thématiques
5. À chaque bloc, l'utilisateur répond et reçoit une réponse générée par GPT-4
6. Après le bloc 9, une synthèse est générée automatiquement

### Phase 2 : Matching
1. Une fois la synthèse générée, le système passe en phase "matching"
2. Un résultat de matching est généré en comparant le profil avec les critères du poste
3. Le candidat voit le résultat du matching
4. Il peut envoyer un feedback

### Phase 3 : Suivi
1. Une notification est créée pour le recruteur
2. Les données sont sauvegardées pour analyse ultérieure
3. Le candidat peut télécharger son profil

## Configuration

### Variables d'environnement requises
- `OPENAI_API_KEY` : Clé API OpenAI pour générer les réponses AXIOM
- `DATABASE_URL` : Connexion à la base de données MySQL
- `JWT_SECRET` : Secret pour les sessions
- Autres variables système (injectées automatiquement)

### Installation

```bash
# Installer les dépendances
pnpm install

# Pousser les migrations de base de données
pnpm db:push

# Démarrer le serveur de développement
pnpm dev

# Exécuter les tests
pnpm test
```

## Utilisation

### Accéder à la plateforme
1. Naviguer vers `/axiom` sur le site
2. Entrer son email et nom
3. Commencer le questionnaire

### Restaurer une session
- Utiliser l'URL avec le paramètre `sessionId` : `/axiom?sessionId=xxx`

### Tester l'API
Les procédures tRPC peuvent être testées via :
- `trpc.axiom.initSession` : Initialiser une session
- `trpc.axiom.getSession` : Récupérer les données d'une session
- `trpc.axiom.sendMessage` : Envoyer un message
- `trpc.axiom.nextBloc` : Passer au bloc suivant
- `trpc.axiom.generateSynthesis` : Générer la synthèse
- `trpc.tracking.trackBehavior` : Tracker un événement

## Prompts AXIOM

Les prompts sont définis dans `shared/prompts.ts` :
- **AXIOM_SYSTEM_PROMPT** : Instructions système pour le modèle
- **AXIOM_INITIAL_MESSAGE** : Message d'accueil
- **AXIOM_BLOC_X_START** : Prompts pour chaque bloc (1-9)
- **AXIOM_SYNTHESIS_PROMPT** : Prompt pour générer la synthèse
- **MATCHING_SYSTEM_PROMPT** : Instructions pour le matching
- **MATCHING_PROMPT** : Prompt pour générer le matching

## Tracking comportemental

Les événements trackés incluent :
- `page_view` : Visite de la page
- `scroll` : Profondeur de scroll
- `message_sent` : Message envoyé
- `bloc_completed` : Bloc complété
- `page_left` : Utilisateur quitte la page
- `time_spent` : Temps passé

## Notifications

Les notifications sont créées automatiquement quand :
- Un candidat complète son profil AXIOM
- Un matching est généré

Les notifications sont stockées dans `recruiterNotifications` avec statut "pending", "sent", ou "failed".

## Performance et optimisation

- Les messages sont sauvegardés en base de données pour persistance
- Le streaming des réponses OpenAI est géré côté backend
- Les sessions sont identifiées par un nanoid unique
- Le tracking est asynchrone et ne bloque pas l'UX

## Sécurité

- Les sessions sont identifiées par un nanoid aléatoire
- Les emails sont validés côté serveur
- Les appels à l'API OpenAI sont faits côté serveur (clé API protégée)
- Les données sensibles ne sont pas exposées au client

## Prochaines étapes

### À implémenter
1. **Système de notifications email** : Envoyer les notifications aux recruteurs
2. **Dashboard recruteur** : Interface pour visualiser les candidats et leurs profils
3. **Export des résultats** : PDF avec profil et matching
4. **Analytics** : Dashboard avec statistiques d'engagement
5. **Intégration ATS** : Exporter les résultats vers un système ATS

### Améliorations possibles
1. Ajouter des questions supplémentaires ou personnalisées
2. Implémenter un système de scoring plus sophistiqué
3. Ajouter des tests de compétences intégrés
4. Créer des variantes du questionnaire pour différents postes
5. Ajouter le support multilingue

## Support et maintenance

Pour toute question ou problème :
1. Vérifier les logs du serveur : `.manus-logs/devserver.log`
2. Vérifier les logs du navigateur : `.manus-logs/browserConsole.log`
3. Exécuter les tests : `pnpm test`
4. Vérifier la santé du serveur : `pnpm check`

## Déploiement

La plateforme est prête pour être publiée via le bouton "Publish" dans l'interface Manus. Assurez-vous que :
1. Tous les tests passent
2. La base de données est configurée
3. Les variables d'environnement sont définies
4. Un checkpoint a été créé
