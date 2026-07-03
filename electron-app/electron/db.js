'use strict';
// Embedded PostgreSQL lifecycle for the desktop app.
//
// Uses the `embedded-postgres` npm package, which downloads/bundles a real
// PostgreSQL binary (pinned to major 16 here) and runs it against a data
// directory we control. No system Postgres or Docker required.
//
// The API (via Prisma) connects using a single DATABASE_URL. We create the
// application database on first run, then hand the URL to the caller.

const fs = require('node:fs');
const path = require('node:path');
// embedded-postgres is ESM-only. Electron's bundled Node does NOT support
// require() of ES modules (ERR_REQUIRE_ESM), so it is loaded via a dynamic
// import() inside start() below.

// ── Fixed connection parameters ─────────────────────────────────────────────
// Bound to loopback only: Postgres is an internal dependency, it must NOT be
// reachable from the LAN. Only the SPAs (3000/3001) and API (4000) are public.
const PG_HOST = '127.0.0.1';
const PG_PORT = 5432;
const PG_USER = 'postgres';
// Local-only superuser password. The DB is loopback-bound and lives inside the
// user's own data dir, so this is a fixed internal credential, not a secret the
// user needs. It is embedded in DATABASE_URL passed to the API.
const PG_PASSWORD = 'postgres';
// Matches the API's default DATABASE_NAME (see apps/api/src/config/index.ts).
const PG_DATABASE = 'projectflow';

class Database {
  /**
   * @param {string} dataDir  Absolute path where the PG cluster is stored,
   *                          e.g. app.getPath('userData')/data/postgres
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.pg = null;
  }

  /** postgresql://postgres:postgres@127.0.0.1:5432/projectflow */
  get databaseUrl() {
    const user = encodeURIComponent(PG_USER);
    const pass = encodeURIComponent(PG_PASSWORD);
    return `postgresql://${user}:${pass}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;
  }

  get databaseName() {
    return PG_DATABASE;
  }

  /**
   * Initialise (first run only) and start the embedded cluster, then ensure the
   * application database exists. Idempotent across runs.
   */
  async start() {
    // A PG data dir already initialised will contain PG_VERSION.
    const alreadyInitialised = fs.existsSync(path.join(this.dataDir, 'PG_VERSION'));

    fs.mkdirSync(this.dataDir, { recursive: true });

    // Load the ESM-only embedded-postgres via dynamic import (require() throws
    // ERR_REQUIRE_ESM under Electron's Node).
    const { default: EmbeddedPostgres } = await import('embedded-postgres');

    this.pg = new EmbeddedPostgres({
      databaseDir: this.dataDir,
      user: PG_USER,
      password: PG_PASSWORD,
      port: PG_PORT,
      host: PG_HOST,
      persistent: true,     // keep the cluster + data between app launches
      // Force UTF8. On Windows, initdb otherwise picks the system locale's
      // encoding (e.g. WIN1252), which cannot store Unicode used in migrations
      // (e.g. the "↔" character) and fails with SQLSTATE 22P05. C locale is
      // encoding-neutral so UTF8 is accepted and collation stays deterministic.
      initdbFlags: ['--encoding=UTF8', '--locale=C'],
      // PostgreSQL major version is determined by the installed embedded-postgres
      // package (pinned to 16.x in package.json → @embedded-postgres/*-x64 PG 16).
    });

    if (!alreadyInitialised) {
      console.log('[db] Initialising fresh PostgreSQL 16 cluster at', this.dataDir);
      await this.pg.initialise();
    }

    console.log('[db] Starting PostgreSQL on', `${PG_HOST}:${PG_PORT}`);
    await this.pg.start();

    await this.ensureDatabase();

    return this.databaseUrl;
  }

  /**
   * Create the application database if it does not already exist.
   * embedded-postgres exposes createDatabase(); we swallow the "already exists"
   * error so this is safe to call on every boot.
   */
  async ensureDatabase() {
    try {
      await this.pg.createDatabase(PG_DATABASE);
      console.log('[db] Created database:', PG_DATABASE);
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/already exists/i.test(msg)) {
        console.log('[db] Database already exists:', PG_DATABASE);
      } else {
        // Re-throw anything that is not the benign "already exists" case.
        throw err;
      }
    }
  }

  /** Stop the cluster cleanly (called on app quit). Safe to call if not started. */
  async stop() {
    if (!this.pg) return;
    try {
      console.log('[db] Stopping PostgreSQL...');
      await this.pg.stop();
    } catch (err) {
      console.error('[db] Error stopping PostgreSQL:', err);
    } finally {
      this.pg = null;
    }
  }
}

module.exports = { Database };
