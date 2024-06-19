declare global {
    namespace NodeJS {
        interface ProcessEnv {
            COGNITO_USER_POOL: string;
            COGNITO_USER_POOL_CLIENT: string;
            WEBSOCKET_CONNECTIONS_TABLE: string;
            DOCUMENTS_TABLE: string;
            CORS_ORIGIN: string;
            WEBSOCKET_API_ENDPOINT: string;
        }
    }
}

export { };