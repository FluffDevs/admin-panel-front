import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from 'react-oidc-context';

// Remplacez les placeholders par vos valeurs Cognito
const cognitoAuthConfig = {
  // Pour Cognito OIDC l'authority est typiquement https://<votre-domaine>.auth.<region>.amazoncognito.com
  authority: 'https://YOUR_COGNITO_DOMAIN',
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: window.location.origin + '/callback', // ou l'URL de callback configurée
  response_type: 'code',
  scope: 'openid profile email',
  // post_logout_redirect_uri: window.location.origin,
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Root element #root introuvable. Assurez-vous d'avoir un <div id=\"root\"></div> dans votre index.html");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
