# Intégration AXIOM Native Integration

## Structure

Le repository contient maintenant deux parties :

### 1. Site web statique (racine)
- `candidats.html` : Page d'accueil des candidats (existante)
- `index.html`, `actu.html`, etc. : Pages du site Elga Energy
- `assets/` : Images, logos, vidéos

### 2. Plateforme AXIOM (dossier `axiom-app/`)
- Application Node.js + React complète
- Interface de chat native intégrée à l'API OpenAI
- Base de données MySQL
- Tous les tests et la documentation

## Installation et déploiement

### Option 1 : Déploiement sur Manus (Recommandé)
La plateforme AXIOM est déjà déployée sur Manus et accessible via :
- URL : https://3000-iarv8cewnrhgf63blt2ts-301cacd5.us2.manus.computer
- Route : `/axiom`

### Option 2 : Déploiement local
```bash
cd axiom-app
pnpm install
pnpm dev
```

### Option 3 : Déploiement en production
```bash
cd axiom-app
pnpm build
pnpm start
```

## Configuration requise

Pour que la plateforme AXIOM fonctionne, vous devez configurer :

1. **Clé API OpenAI** : `OPENAI_API_KEY`
   - Obtenir sur https://platform.openai.com/api-keys
   - Ajouter à vos variables d'environnement

2. **Base de données MySQL** : `DATABASE_URL`
   - Format : `mysql://user:password@host:port/database`

3. **Autres secrets** : Voir `axiom-app/AXIOM_README.md`

## Intégration avec le site existant

Pour ajouter un lien vers AXIOM sur votre page `candidats.html` :

```html
<!-- Ajouter ce bouton dans candidats.html -->
<a href="/axiom" class="btn btn-primary">
  Commencer le profil AXIOM
</a>
```

## Architecture

```
BON-SITE-ELGA-ENERGY/
├── candidats.html          (Page d'accueil candidats)
├── index.html              (Page d'accueil)
├── assets/                 (Images, logos, vidéos)
├── axiom-app/              (Plateforme AXIOM complète)
│   ├── client/             (Interface React)
│   ├── server/             (Backend Express + tRPC)
│   ├── drizzle/            (Schéma base de données)
│   ├── package.json        (Dépendances)
│   └── AXIOM_README.md     (Documentation)
└── AXIOM_INTEGRATION.md    (Ce fichier)
```

## Flux utilisateur

1. Candidat arrive sur `www.elgaenergy.com/candidats.html`
2. Clique sur "Commencer le profil AXIOM"
3. Est redirigé vers `/axiom` (plateforme AXIOM)
4. Remplit le questionnaire AXIOM en 9 blocs
5. Reçoit les résultats de matching
6. Les données sont sauvegardées en base de données

## Prochaines étapes

1. **Configurer les secrets** : Ajouter `OPENAI_API_KEY` et `DATABASE_URL`
2. **Tester l'intégration** : Vérifier que la plateforme fonctionne
3. **Ajouter le lien** : Mettre à jour `candidats.html` avec le lien vers `/axiom`
4. **Configurer les notifications** : Mettre en place l'envoi d'emails aux recruteurs
5. **Créer un dashboard** : Interface pour que les recruteurs voient les candidats

## Support

Pour plus d'informations, consultez :
- `axiom-app/AXIOM_README.md` : Documentation technique complète
- `axiom-app/todo.md` : Liste des tâches et statut

## Notes importantes

- La plateforme AXIOM est une application complète et indépendante
- Elle peut être déployée sur un serveur séparé si nécessaire
- Les données sont sauvegardées en base de données MySQL
- L'API OpenAI est appelée côté serveur (clé API protégée)
