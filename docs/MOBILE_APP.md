# iFac Université — application mobile

La version mobile utilise Capacitor pour embarquer le bundle React/Vite existant dans une application Android ou iOS. Le site Web continue d'être construit et publié séparément par Vercel.

## Configuration

- Identifiant natif : `ht.edu.ifac.universite`
- Nom : `iFac Université`
- Dossier Web : `dist`
- Le bundle mobile utilise `VITE_API_BASE_URL` pour joindre l'API Express hébergée.
- Les builds Web normaux laissent `VITE_API_BASE_URL` vide afin de conserver les appels relatifs `/api/v1`.

Le serveur autorise uniquement les origines natives Capacitor (`https://localhost` et `capacitor://localhost`), les origines locales Vite et l'origine définie par `APP_BASE_URL` ou `CORS_ALLOWED_ORIGINS`.

## Développement Android

Prérequis : Node.js 22+, Java 21 et Android SDK.

```sh
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

Après les modifications de l'interface, exécuter `npm run build` puis `npx cap sync android`.

## APK de test dans le cloud

Le workflow GitHub Actions `Android debug APK` construit un APK de débogage et le publie comme artefact téléchargeable. Il peut être lancé manuellement depuis Actions ou automatiquement pour une Pull Request qui modifie les fichiers mobiles.

Cet APK sert aux tests. Une publication Google Play nécessitera ultérieurement une version Android signée (AAB) et une clé de signature conservée dans des secrets GitHub.

## iOS

Le paquet Capacitor iOS est installé et l'identité de l'application est partagée. La génération et la compilation du projet iOS nécessitent un environnement macOS avec Xcode. Cette étape sera ajoutée séparément, sans modifier le pipeline Android.

## API, comptes et fichiers

- Neon reste la base PostgreSQL de l'application.
- Supabase Auth reste le fournisseur d'identité existant.
- Supabase Storage conserve les documents et fichiers privés.
- Les appels API mobiles utilisent le domaine de production configuré au moment du build.

Le cache hors ligne des documents et les notifications push natives ne sont pas encore implémentés dans cette première intégration.
