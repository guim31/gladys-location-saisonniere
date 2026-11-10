// -----------------------------------------------------------------------------
// Entry point: wires the Gladys SDK to the bookings (src/app.js). No booking
// logic here. Handlers are registered before connect().
//
// Environment provided by the Gladys supervisor: GLADYS_HOST_API_URL,
// GLADYS_INTEGRATION_TOKEN, GLADYS_INTEGRATION_SELECTOR (read by the SDK), and
// TZ, the time zone of Gladys: check-in and check-out hours are read in it.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
const app = registerHandlers(gladys, {
  userAgent: `gladys-location-saisonniere/${version} (+https://github.com/guim31/gladys-location-saisonniere)`,
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal}, stopping`);
  app.stop();
});

logger.info(`Starting the holiday rental integration ${version}...`);
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
