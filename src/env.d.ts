declare global {
    namespace NodeJS {
        interface ProcessEnv {
            readonly COGNITO_USER_POOL: string;

            readonly COGNITO_USER_POOL_CLIENT: string;
            readonly COGNITO_USER_POOL_CLIENT_SECRET: string;

            readonly WEBSOCKET_CONNECTIONS_TABLE: string;
            readonly DOCUMENTS_TABLE: string;

            readonly WEBSOCKET_API_ENDPOINT: string;
            readonly CLIENT_URL: string;
        }
    }
}

export { };