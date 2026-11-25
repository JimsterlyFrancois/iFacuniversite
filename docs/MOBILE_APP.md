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

Cet APK sert uniquement aux tests techniques. Il ne remplace pas une version de diffusion.

Le workflow `Android signed release` prépare une APK signée installable normalement ainsi qu’un Android App Bundle (AAB). Il se lance manuellement ou lorsqu’un tag de version `v*` est poussé. Il exige une clé permanente, à conserver hors du dépôt et à sauvegarder en lieu sûr, ainsi que les quatre secrets GitHub suivants : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD`. Ne changez pas de clé entre deux versions : Android n’acceptera pas une mise à jour signée avec une autre clé.

Pour préparer la clé une seule fois dans le terminal Linux :
```sh
keytool -genkeypair -v -keystore ifac-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias ifac-universite
base64 -w 0 ifac-release-key.jks > ifac-release-key.base64
```
Conservez le fichier JKS et ses mots de passe dans un gestionnaire sûr. Copiez le contenu du fichier Base64 dans le secret `ANDROID_KEYSTORE_BASE64`, puis ajoutez les trois autres valeurs dans GitHub → Settings → Secrets and variables → Actions. Ne placez jamais le JKS, le Base64 ou les mots de passe dans le dépôt ni dans un commit.

Tant que ces secrets ne sont pas configurés, une version signée ne peut pas être produite de manière sûre.

## iOS

Le paquet Capacitor iOS est installé et l'identité de l'application est partagée. La génération et la compilation du projet iOS nécessitent un environnement macOS avec Xcode. Cette étape sera ajoutée séparément, sans modifier le pipeline Android.

## API, comptes et fichiers

- Supabase fournit la base PostgreSQL de l'application.
- Supabase Auth reste le fournisseur d'identité existant.
- Supabase Storage conserve les documents et fichiers privés.
- Les appels API mobiles utilisent le domaine de production configuré au moment du build.

Les listes publiques utilisées dans l’inscription étudiante et les demandes de responsables/professeurs utilisent un cache local : l’application affiche immédiatement la dernière liste connue, puis resynchronise la liste principale lorsque l’utilisateur revient au premier plan, au plus une fois toutes les cinq minutes. Les listes dépendantes (facultés, options, niveaux et cours) sont chargées à la demande et réutilisent leur cache par parcours sélectionné. Les documents privés ne sont pas mis en cache hors ligne et les notifications push natives ne sont pas encore implémentées.
