const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
require('reflect-metadata');

module.exports = async () => {
  const { default: dataSource } = require('../../src/database/data-source');
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
};
