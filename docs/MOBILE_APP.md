# iFac Université — application mobile

La version mobile utilise Capacitor pour embarquer le client React/Vite dans une application Android ou iOS. Le site Web reste construit et publié séparément par Vercel.

## Identité et configuration

- Identifiant natif : ht.edu.ifac.universite
- Nom : iFac Université
- Dossier Web : dist
- Le bundle mobile utilise VITE_API_BASE_URL pour joindre l’API Express hébergée.
- Les builds Web normaux laissent VITE_API_BASE_URL vide afin de conserver les appels relatifs /api/v1.

Le serveur autorise les origines natives Capacitor, les origines locales Vite et les origines de production définies par la configuration.

## Services de données et d’identité

Les responsabilités des services sont séparées :

- **Neon PostgreSQL** contient les données applicatives : profils iFac, établissements, facultés, options, niveaux, rôles, affectations, matières, cours, documents et métadonnées, annonces, groupes, messages et journaux.
- **Supabase Auth** gère les identités externes, la confirmation des adresses e-mail et les opérations d’authentification.
- **Supabase Storage** conserve les fichiers privés, notamment les documents et les images d’annonces.
- **Vercel** héberge le site Web et les routes API utilisées par les applications.

La documentation serveur de référence est server/CONFIGURATION.md. Neon et Supabase ne doivent pas être confondus : Supabase Auth et Storage sont utilisés par l’application, mais les données PostgreSQL applicatives sont stockées dans Neon.

## Cache des catalogues et documents hors connexion

Les listes publiques utilisées dans l’inscription étudiante et les demandes de responsables/professeurs utilisent un cache local : l’application peut afficher la dernière liste connue, puis resynchroniser la liste principale lorsque l’utilisateur revient au premier plan. Les listes dépendantes (facultés, options, niveaux et cours) sont chargées à la demande et réutilisent leur cache selon le parcours sélectionné.

Les documents privés peuvent être enregistrés dans le cache natif de l’application (Android/iOS) et rouverts hors connexion. Le cache porte sur les documents explicitement enregistrés ; il ne constitue pas une synchronisation hors ligne complète de tous les profils, messages, annonces et services. Le système d’exploitation peut supprimer les fichiers du cache si l’espace de stockage manque.

Le site Web ne propose pas le même mécanisme natif de conservation hors connexion.

## Sessions et confidentialité

La session et l’adresse e-mail du compte sont conservées dans le stockage sécurisé natif (Keychain iOS / Android Keystore). Le mot de passe n’est jamais mémorisé. La session Web reste limitée à sessionStorage.

Les fichiers privés sont accessibles à travers les routes et contrôles de l’application. Les secrets de service restent côté serveur et ne doivent jamais être intégrés dans le code du navigateur ou de l’application.

## Développement Android

Prérequis : Node.js 22+, Java 21 et Android SDK.

    npm install
    npm run build
    npx cap add android
    npx cap sync android
    npx cap open android

Après les modifications de l’interface, exécuter npm run build puis npx cap sync android.

## APK de test et version signée

Le workflow GitHub Actions « Android debug APK » construit un APK de débogage et le publie comme artefact téléchargeable. Il sert aux tests techniques et ne remplace pas une version de diffusion.

Le workflow « Android signed release » prépare un APK signé installable normalement ainsi qu’un Android App Bundle (AAB). La diffusion signée exige une clé permanente et les secrets de signature Android configurés dans GitHub Actions. Ne changez pas de clé entre deux versions : Android n’acceptera pas une mise à jour signée avec une autre clé.

Conservez le fichier de signature et ses mots de passe en lieu sûr. Ne placez jamais le keystore, son contenu Base64 ni ses mots de passe dans le dépôt ou dans un commit.

## Mises à jour OTA Android

Le projet utilise Capawesome Live Update pour distribuer à distance les bundles Web compatibles. Après installation d’un APK qui contient le composant natif Live Update, les changements compatibles de l’interface (HTML, CSS, JavaScript et ressources Web) peuvent être installés sans réinstaller l’APK.

Les bundles de production sont signés. La clé privée de signature doit rester dans les variables sensibles de Vercel ; seule la clé publique est embarquée dans la configuration native.

Une mise à jour OTA ne peut pas ajouter ou mettre à jour un plugin natif, modifier les permissions Android, le manifeste ou le code Android natif. Ces changements nécessitent un nouvel APK/AAB. Un appareil qui ne possède pas encore le composant OTA doit d’abord installer une version native qui l’intègre.

Le bundle téléchargé est programmé pour un lancement ultérieur afin de ne pas interrompre une session. Les détails sont décrits dans mobile-ota.md.

## iOS

Le paquet Capacitor iOS et l’identité de l’application sont présents dans le projet. La génération d’un paquet iOS et sa distribution exigent un environnement macOS avec Xcode ainsi qu’une configuration de signature propre à Apple. La présence des dépendances ne signifie pas qu’une version iOS est déjà publiée.

## Notifications

Les notifications affichées dans l’application font partie des fonctionnalités Web/API d’iFac. Les notifications push natives Android/iOS ne sont pas encore implémentées dans la version documentée.

## Limites à garder en tête

- Le cache de documents natif ne signifie pas que toute l’application fonctionne hors connexion.
- Les mises à jour OTA ne remplacent pas les compilations nécessaires aux changements natifs.
- Les notifications intégrées à iFac ne sont pas la même chose que les notifications push du téléphone.
- Les paiements en ligne ne sont pas activés par la simple présence de forfaits, abonnements ou factures dans la console générale.
