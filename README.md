# GRRRR — App mobile de rencontre pour animaux (React Native / Expo)

Prototype fonctionnel en React Native + TypeScript, basé sur Expo, reprenant
l'expérience décrite dans le brief produit : Splash → Onboarding → Discover
(swipe + slider FRIEND↔HOT) → Match → Chat → Explore → My Pet.

## Lancer le projet

```bash
npm install
npx expo start
```

Puis scanner le QR code avec l'app **Expo Go** (iOS/Android), ou lancer un
simulateur :

```bash
npm run ios       # simulateur iOS (macOS uniquement)
npm run android   # émulateur Android
```

## Supabase et authentification

Créer un fichier `.env` à la racine avec les clés du projet Supabase :

```env
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

Exécuter ensuite `supabase/schema.sql` dans l'éditeur SQL Supabase. Le script
crée la table `profiles`, ses contraintes et les policies RLS qui limitent
chaque profil à son propriétaire. Sans ces variables, l'application reste
utilisable en mode démo et le profil reste éditable localement.

## Logos du bouton Like

Ajouter les deux images fournies dans `assets/` avec ces noms :

```text
assets/logo-round.png   # image 2, logo rond affiché sur le bouton
assets/logo-broken.png  # version cassée affichée pendant 1 seconde au clic
```

Le bouton est déjà animé dans `src/components/LikeButton.tsx` et utilise un
fallback emoji tant que les fichiers image ne sont pas encore ajoutés.

## Structure

```
GRRRR/
├── App.tsx                     # point d'entrée : Splash -> Onboarding -> Navigation
├── app.json / babel.config.js / tsconfig.json
└── src/
    ├── theme/theme.ts          # couleurs, polices (Baloo 2 + Inter), rayons
    ├── data/mockPets.ts        # profil "Rocky" (moi) + 6 profils mock + races compatibles
    ├── utils/matching.ts       # moteur de score de compatibilité pondéré
    ├── context/AppState.tsx    # état global : mode slider, matches, chats
    ├── navigation/
    │   ├── RootNavigator.tsx   # Stack racine (Tabs + écran de chat)
    │   └── MainTabs.tsx        # 5 onglets : Discover, Matches, Chat, Explore, My Pet
    ├── components/
    │   ├── Header.tsx
    │   ├── SwipeCard.tsx       # carte draggable (PanResponder + Animated)
    │   ├── ModeSlider.tsx      # slider animé FRIEND ↔ HOT
    │   └── MatchModal.tsx      # écran "It's a Match!" + confettis
    └── screens/
        ├── SplashScreen.tsx
        ├── OnboardingScreen.tsx    # 4 écrans (Welcome, Profil, Mode, Get Started)
        ├── DiscoverScreen.tsx
        ├── MatchesScreen.tsx
        ├── ChatListScreen.tsx
        ├── ChatThreadScreen.tsx
        ├── ExploreScreen.tsx
        └── MyPetScreen.tsx
```

## Ce qui est implémenté

- **Splash screen** : patte animée, logo, dégradé de marque, disparition auto (~1.7s)
- **Onboarding** : 4 écrans swipables avec dots, bouton "Passer", aperçu du slider FRIEND↔HOT
- **Discover** : pile de cartes draggables (glisser pour liker/passer), boutons ✕ / ⭐ / ❤️,
  score de compatibilité affiché et recalculé en direct
- **Slider FRIEND ↔ HOT** : drag tactile, dégradé de couleur dynamique, ré-évalue les scores
- **Moteur de matching** (`src/utils/matching.ts`) : race 30% · distance 20% · âge 15% ·
  énergie 15% · sexe 10% · mode Friend/Love 10%, avec les raisons de compatibilité ("Why?")
- **Match réciproque** : modale avec confettis animés et photos qui se rapprochent
- **Chat** : liste de conversations + écran de discussion avec réponses simulées
- **Explore** : grille des profils triés par compatibilité
- **My Pet** : profil avancé éditable (nom, race, ville, bio, énergie et intention),
  sauvegardé dans Supabase pour les comptes connectés

## Prochaines étapes suggérées

- Remplacer `src/data/mockPets.ts` par de vrais appels API (backend + PostgreSQL,
  cf. section 23 de la spec produit)
- OAuth, upload de photos vers un stockage cloud et création guidée du profil
- Filtres avancés (distance, race, âge, taille, énergie…)
- Notifications push pour les nouveaux matchs et messages
