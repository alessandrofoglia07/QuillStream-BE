declare global {
    namespace NodeJS {
        interface ProcessEnv {
            USER_POOL_ID: string;
            POOL_CLIENT_ID: string;
        }
    }
}

export { };