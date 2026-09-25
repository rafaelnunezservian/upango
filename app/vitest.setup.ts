// Variables mínimas para que cualquier test que importe (directa o
// transitivamente) el composition root o shopify.server.ts no dispare
// cargarConfiguracionOSalir() con un entorno vacío. No son secretos reales.
process.env.SHOPIFY_API_KEY ??= "test-api-key";
process.env.SHOPIFY_API_SECRET ??= "test-api-secret";
process.env.SHOPIFY_APP_URL ??= "https://test.example.com";
process.env.SCOPES ??= "write_delivery_customizations,write_app_proxy";
process.env.SESSION_STORAGE_DRIVER ??= "memoria";
process.env.NODE_ENV ??= "test";
