import { readSafeError, startServer } from './main';

// Keep startup in an entrypoint: esbuild moves shared modules into chunks,
// where import.meta.url no longer identifies the executable main.js file.
startServer().catch(error => {
 console.error(JSON.stringify({ event: 'startup_failed', message: readSafeError(error) }));
 process.exit(1);
});
