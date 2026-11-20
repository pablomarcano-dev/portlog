import { defineConfig } from 'cypress';
import * as dotenv from 'dotenv';
import {
  resetDb,
  seedNominationFixture,
  seedEtaRecipientFixture,
  cleanupEtaRecipientFixture,
} from './cypress/tasks/db';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  viewportWidth: 1440,
  viewportHeight: 1000,
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/specs/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    env: {
      API_URL: 'http://localhost:3000/api',
      OPS_EMAIL: 'ops@portlog.local',
      OPS_PASSWORD: 'portlog_ops_dev',
      ADM_EMAIL: 'admin@portlog.local',
      ADM_PASSWORD: 'portlog_admin_dev',
    },
    setupNodeEvents(on) {
      on('task', {
        resetDb,
        seedNominationFixture,
        seedEtaRecipientFixture,
        cleanupEtaRecipientFixture,
      });
    },
  },
});
