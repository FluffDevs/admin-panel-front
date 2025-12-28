# S3 Presign Endpoint — Usage

Ce petit document explique comment tester l'endpoint `/api/s3/presign` et l'uploader côté client.

Variables d'environnement requises:

- `COGNITO_ISSUER` — l'URL issuer Cognito (ex: `https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_xxx`)
- `AWS_REGION` — région du bucket (ex: `eu-west-1`)
- `S3_BUCKET` — nom du bucket S3
- Les variables `AWS_ACCESS_KEY_ID` et `AWS_SECRET_ACCESS_KEY` ne sont nécessaires que si vous voulez que le serveur génère les URLs (présentement le serveur utilise ses propres clés pour signer).

Pour l'usage côté client avec `react-oidc-context`, exposez aussi ces variables publiques (préfixées `NEXT_PUBLIC_`):

- `NEXT_PUBLIC_COGNITO_ISSUER` — identique à `COGNITO_ISSUER` mais exposée au client
- `NEXT_PUBLIC_COGNITO_CLIENT_ID` — l'ID du client Cognito

Endpoint:

- POST /api/s3/presign
  - Headers: `Authorization: Bearer <ID|Access token>`
  - Body JSON: `{ "key": "uploads/foo.mp3", "operation": "upload", "contentType": "audio/mpeg" }`
  - Réponses:
    - 200: `{ url, method: 'PUT'|'GET', key }` — `url` est l'URL présignée
    - 401/403/4xx: erreur

Client example:

1. Récupérez un token (ID ou Access token) après connexion via Cognito.
2. Appelez POST `/api/s3/presign` avec le header `Authorization: Bearer <token>` et body `{ key, operation: 'upload', contentType }`.
3. Faites un PUT HTTP direct vers `url` retournée (avec Content-Type correct) pour uploader le fichier.

Notes de sécurité:

- En production, vérifiez bien l'audience (`aud`) et autres claims du token.
- Préférez déléguer les opérations S3 via des presigned URLs ou via un rôle d'identité (Cognito Identity Pool) plutôt que d'exposer des clés serveur dans le front.
