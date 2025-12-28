Ajoutez l’exemple de code à votre application
1
Configurez le client de votre application de groupe d'utilisateurs avec les URL de rappel autorisées, les URL de déconnexion et les étendues que vous souhaitez demander, par exemple openid et profile. En savoir plus 

2
Installez les bibliothèques oidc-client-ts  et react-oidc-context .


npm install oidc-client-ts react-oidc-context --save
3
Configurez react-oidc-context avec les propriétés OIDC de votre groupe d'utilisateurs.


// index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";

const cognitoAuthConfig = {
  authority: "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_e3giVfjQy",
  client_id: "5hb25as07buvk4lilj20vpotho",
  redirect_uri: "http://localhost:3000/dashboard",
  response_type: "code",
  scope: "email openid phone",
};

const root = ReactDOM.createRoot(document.getElementById("root"));

// wrap the application with AuthProvider
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
4
Générez un bouton de connexion qui lance une demande d'autorisation auprès du fournisseur OIDC de votre groupe d'utilisateurs, et un bouton de déconnexion qui lance une demande de déconnexion.


// App.js

import { useAuth } from "react-oidc-context";

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "5hb25as07buvk4lilj20vpotho";
    const logoutUri = "<logout uri>";
    const cognitoDomain = "https://eu-west-1e3givfjqy.auth.eu-west-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div>
        <pre> Hello: {auth.user?.profile.email} </pre>
        <pre> ID Token: {auth.user?.id_token} </pre>
        <pre> Access Token: {auth.user?.access_token} </pre>
        <pre> Refresh Token: {auth.user?.refresh_token} </pre>

        <button onClick={() => auth.removeUser()}>Sign out</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
      <button onClick={() => signOutRedirect()}>Sign out</button>
    </div>
  );
}

export default App;