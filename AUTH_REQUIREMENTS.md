# iFacuniversite — exigences d’inscription et de connexion

## Périmètre initial
- L’UPNCH est la seule université activée au lancement.
- Les données de facultés, écoles, options et niveaux doivent être structurées de façon à permettre l’ajout d’autres universités publiques haïtiennes plus tard.
- Les niveaux sont affichés sous la forme « 1re année (L1) », « 2e année (L2) », « 3e année (L3) » et « 4e année (L4) ».

## Inscription
Champs requis : nom, prénom, adresse e-mail valide, faculté/école, niveau, mot de passe et confirmation du mot de passe. L’option est requise lorsqu’elle existe pour la faculté ou l’école choisie. Le choix de la faculté filtre les options disponibles.
Le mot de passe doit être affichable/masquable et avoir au moins 8 caractères. La confirmation doit correspondre au mot de passe.

## Connexion
Champs requis : adresse e-mail et mot de passe. Le mot de passe doit pouvoir être affiché ou masqué. Prévoir un vrai flux de récupération du mot de passe.

## Activation et e-mail
L’inscription réelle doit créer un compte non activé et envoyer un lien à durée limitée. Le compte ne doit être activé qu’après validation du jeton côté serveur. Prévoir la limitation de fréquence, les réponses anti-énumération d’adresses, l’expiration et l’usage unique des jetons.

## Interface
- Image d’ambiance universitaire avec texte alternatif.
- Animations légères uniquement; respecter prefers-reduced-motion.
- Mise en page responsive, messages d’erreur lisibles et navigation clavier.
- Ne pas ajouter de faux témoignages, logos partenaires ou affirmations de sécurité non vérifiées.

## État technique — important
La branche contient l’interface et les contrôles côté navigateur. Les routes d’inscription/connexion, le stockage sécurisé des mots de passe, la base de données, l’envoi réel d’e-mails, la confirmation d’adresse et la récupération du mot de passe ne sont pas encore reliés. Les messages de l’interface indiquent cette limite. Ne pas collecter de véritables comptes étudiants et ne pas fusionner vers main avant la mise en place et la vérification de ces fonctions côté serveur.
