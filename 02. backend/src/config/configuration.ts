export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  corsOrigin: string;
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    ssl: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: number;
  };
  auth: {
    mockUsername: string;
    mockPassword: string;
    customerUsername: string;
    customerPassword: string;
    customerOwnerName: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'ligo',
    password: process.env.DATABASE_PASSWORD ?? 'ligo_password',
    name: process.env.DATABASE_NAME ?? 'wallet_service',
    ssl: process.env.DATABASE_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-this-super-secret-key-in-production',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN ?? '3600', 10),
  },
  auth: {
    mockUsername: process.env.AUTH_MOCK_USERNAME ?? 'senior.backend',
    mockPassword: process.env.AUTH_MOCK_PASSWORD ?? 'Password123',
    // Demo customer identity, scoped to a single wallet owner (wal_001 / seed data).
    // Used to exercise the 403 ownership rule: this identity cannot touch other wallets.
    customerUsername: process.env.AUTH_CUSTOMER_USERNAME ?? 'juan.perez',
    customerPassword: process.env.AUTH_CUSTOMER_PASSWORD ?? 'Cliente123',
    customerOwnerName: process.env.AUTH_CUSTOMER_OWNER_NAME ?? 'Juan Perez',
  },
});
