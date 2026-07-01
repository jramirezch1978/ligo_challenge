import 'reflect-metadata';
import dataSource from './data-source';

/**
 * Standalone migration runner used by the Docker entrypoint so the production
 * image can apply pending migrations with plain `node`, without requiring the
 * TypeORM CLI or ts-node inside the runtime container.
 */
async function run(): Promise<void> {
  await dataSource.initialize();
  const applied = await dataSource.runMigrations();
  // eslint-disable-next-line no-console
  console.log(`Applied ${applied.length} migration(s).`);
  await dataSource.destroy();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', error);
    process.exit(1);
  });
