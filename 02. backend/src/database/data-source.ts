import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'ligo',
  password: process.env.DATABASE_PASSWORD ?? 'ligo_password',
  database: process.env.DATABASE_NAME ?? 'wallet_service',
  ssl: process.env.DATABASE_SSL === 'true',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
