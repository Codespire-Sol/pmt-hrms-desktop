// Smoke test: prove embedded-postgres can initialise + start + stop on this OS.
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const _ep = require('embedded-postgres');
const EmbeddedPostgres = _ep.default || _ep;

(async () => {
  const dir = path.join(os.tmpdir(), 'pmt-smoke-pg-' + Date.now());
  console.log('[smoke] data dir:', dir);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port: 5433,
    persistent: false,
  });
  try {
    console.log('[smoke] initialise() ...');
    await pg.initialise();
    console.log('[smoke] start() ...');
    await pg.start();
    console.log('[smoke] createDatabase(projectflow) ...');
    await pg.createDatabase('projectflow');
    console.log('[smoke] OK — PostgreSQL started and DB created.');
    await pg.stop();
    console.log('[smoke] stopped cleanly.');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    console.log('SMOKE_RESULT: PASS');
    process.exit(0);
  } catch (err) {
    console.error('[smoke] FAILED:', err && err.stack ? err.stack : err);
    try { await pg.stop(); } catch {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    console.log('SMOKE_RESULT: FAIL');
    process.exit(1);
  }
})();
