# Guide de démarrage rapide - AXIOM

## 🚀 Démarrer l'application AXIOM en local

### Étape 1 : Installer les dépendances (si pas déjà fait)
```bash
cd axiom-app
pnpm install
```

### Étape 2 : Configurer les variables d'environnement

Créez un fichier `.env` à la racine de `axiom-app/` avec au minimum :

```env
NODE_ENV=development
```

#### Option A : Mode Mock (GRATUIT - pour tester sans payer)

Pour tester l'application **sans appeler l'API OpenAI** (et donc sans payer de jetons), activez le mode mock :

```env
NODE_ENV=development
MOCK_LLM=true
```

Le mode mock génère des réponses simulées réalistes sans faire d'appels API réels. **Parfait pour le développement et les tests !**

#### Option B : Mode Production (nécessite une clé API OpenAI)

Si vous voulez utiliser l'API OpenAI réelle (nécessite un compte payant) :

```env
NODE_ENV=development
OPENAI_API_KEY=votre_clé_openai
```

**Note** : Pour tester rapidement sans base de données, vous pouvez laisser `DATABASE_URL` vide. L'application utilisera un stockage en mémoire (mock) pour le développement.

Vous pouvez copier le fichier `.env.example` comme point de départ :
```bash
cp .env.example .env
# Puis éditez .env pour ajouter votre clé API OpenAI
```

### Étape 3 : Démarrer le serveur

```bash
cd axiom-app
NODE_ENV=development pnpm dev
```

Le serveur devrait démarrer sur `http://localhost:3000`

### Étape 4 : Accéder à AXIOM

1. Ouvrez votre navigateur
2. Allez sur `http://localhost:3000/axiom`
3. Vous devriez voir le formulaire d'initialisation AXIOM

### Étape 5 : Tester depuis candidats.html

1. Ouvrez `candidats.html` dans votre navigateur (via un serveur local ou directement)
2. Cliquez sur le bouton "Démarrer AXIOM" à l'étape 2
3. Vous devriez être redirigé vers `http://localhost:3000/axiom`

## 🔧 Dépannage

### Erreur "URI malformed"
✅ **Corrigé** : Le code a été mis à jour pour gérer automatiquement les URLs mal formées.

### Erreur "Cannot find module"
```bash
cd axiom-app
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Le serveur ne démarre pas
1. Vérifiez que le port 3000 n'est pas déjà utilisé
2. Vérifiez que Node.js est installé : `node --version`
3. Vérifiez que pnpm est installé : `pnpm --version`

### Erreur de connexion à la base de données
- Si vous n'avez pas de base de données, certaines fonctionnalités ne fonctionneront pas
- Pour un test rapide, vous pouvez laisser `DATABASE_URL` vide

### Éviter les coûts API OpenAI en développement
- **Utilisez le mode mock** : Ajoutez `MOCK_LLM=true` dans votre `.env`
- Le mode mock génère des réponses simulées sans appeler l'API
- **Gratuit** et parfait pour tester l'interface et le flux utilisateur

## 📝 Notes importantes

- Le serveur doit être démarré **avant** de cliquer sur le bouton dans `candidats.html`
- En développement, le serveur utilise Vite avec hot-reload
- Les logs sont disponibles dans la console du terminal où vous avez lancé `pnpm dev`
