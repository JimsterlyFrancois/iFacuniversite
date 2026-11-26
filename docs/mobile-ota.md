# Mises à jour OTA iFac Université

## Principe

iFac utilise `@capawesome/capacitor-live-update` pour recevoir à distance les mises à jour de l'interface Android. Les bundles sont générés lors du build Vercel de production et servis depuis le domaine public iFac. Aucun compte Capawesome Cloud n'est nécessaire.

Au lancement, l'application confirme le bon démarrage du bundle courant, vérifie le manifeste de production, contrôle la compatibilité native, puis télécharge en arrière-plan un bundle ZIP signé. Le bundle est programmé pour le prochain lancement : l'application n'est pas rechargée au milieu d'une session.

## Première installation OTA

L'APK actuellement installé ne contient pas encore le plugin natif. Une mise à jour Android initiale est donc indispensable pour installer le composant OTA. Après cette première mise à jour, les modifications compatibles de l'interface (HTML, CSS, JavaScript et ressources web) peuvent être distribuées sans réinstallation de l'APK.

## Sécurité

- Le SHA-256 du ZIP est vérifié au téléchargement.
- La signature RSA du bundle est validée par la clé publique intégrée à `capacitor.config.json`.
- La clé privée reste dans la variable Vercel sensible `OTA_SIGNING_PRIVATE_KEY`, cible Production uniquement. Elle n'est jamais stockée dans Git.
- Le manifeste est servi sans cache et les ZIP sont versionnés par commit.
- Un bundle qui ne confirme pas son démarrage dans le délai de sécurité revient au bundle natif de référence.

## Limites

OTA ne peut pas ajouter ou mettre à jour des plugins Capacitor, modifier le code Android natif, les permissions, le manifeste Android ou la configuration de signature. Ces changements exigent toujours un nouvel APK/AAB.

La constante `NATIVE_COMPATIBILITY` doit être modifiée dans `client/src/otaUpdates.js` et `scripts/build-ota-release.mjs` lorsqu'un changement natif rend les anciens bundles incompatibles. Le même identifiant doit être utilisé des deux côtés.

## Publication

Le build Vercel de production exécute `scripts/build-ota-release.mjs` après Vite. Les déploiements Preview ne publient jamais de manifeste OTA. Les appareils Android vérifient les mises à jour au lancement et à la reprise de l'application, au maximum une fois toutes les 15 minutes.
