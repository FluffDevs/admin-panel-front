"use client";
import React from "react";
import { AuthProvider } from "react-oidc-context";

type Props = {
  children: React.ReactNode;
};

const oidcConfig = {
  authority: process.env.NEXT_PUBLIC_OIDC_AUTHORITY || "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_e3giVfjQy",
  client_id: process.env.NEXT_PUBLIC_OIDC_CLIENT_ID || "5hb25as07buvk4lilj20vpotho",
  redirect_uri: process.env.NEXT_PUBLIC_OIDC_REDIRECT_URI || "http://localhost:3000/dashboard",
  post_logout_redirect_uri: process.env.NEXT_PUBLIC_POST_LOGOUT_REDIRECT_URI || "https://d84l1y8p4kdic.cloudfront.net",
  response_type: "code",
  scope: process.env.NEXT_PUBLIC_OIDC_SCOPE || "phone openid email",
};

export default function AuthProviderClient({ children }: Props) {
  return <AuthProvider {...oidcConfig}>{children}</AuthProvider>;
}
