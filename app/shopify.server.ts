import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { contenedor } from "./composition/contenedor.server.js";

const { config } = contenedor;

const shopify = shopifyApp({
  apiKey: config.shopifyApiKey,
  apiSecretKey: config.shopifyApiSecret,
  apiVersion: ApiVersion.July26,
  scopes: [...config.scopes],
  appUrl: config.shopifyAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: contenedor.sessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(config.shopCustomDomain
    ? { customShopDomains: [config.shopCustomDomain] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
