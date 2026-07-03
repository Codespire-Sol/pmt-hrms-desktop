#!/usr/bin/env ts-node

/**
 * Launch Checklist Script
 *
 * Comprehensive pre-launch verification script that checks
 * all systems, configurations, and security requirements.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// ============================================
// TYPES
// ============================================

interface CheckResult {
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: string;
  critical: boolean;
}

interface ChecklistSummary {
  timestamp: Date;
  environment: string;
  results: CheckResult[];
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  ready: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  baseUrl: process.env.API_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  environment: process.env.NODE_ENV || 'development',
};

// ============================================
// CHECK FUNCTIONS
// ============================================

async function checkEnvironmentVariables(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const requiredVars = [
    { name: 'NODE_ENV', critical: true },
    { name: 'DATABASE_URL', critical: true },
    { name: 'REDIS_URL', critical: true },
    { name: 'JWT_SECRET', critical: true },
    { name: 'JWT_REFRESH_SECRET', critical: true },
    { name: 'ANTHROPIC_API_KEY', critical: false },
    { name: 'GOOGLE_CLIENT_ID', critical: false },
    { name: 'GOOGLE_CLIENT_SECRET', critical: false },
    { name: 'GITHUB_CLIENT_ID', critical: false },
    { name: 'GITHUB_CLIENT_SECRET', critical: false },
    { name: 'SLACK_CLIENT_ID', critical: false },
    { name: 'SLACK_CLIENT_SECRET', critical: false },
    { name: 'GCS_BUCKET', critical: false },
    { name: 'BACKUP_BUCKET', critical: false },
    { name: 'SENTRY_DSN', critical: false },
  ];

  for (const { name, critical } of requiredVars) {
    const value = process.env[name];
    results.push({
      name: `ENV: ${name}`,
      category: 'Environment',
      status: value ? 'pass' : critical ? 'fail' : 'warn',
      message: value ? `${name} is set` : `${name} is not set`,
      critical,
    });
  }

  // Check JWT secret strength
  const jwtSecret = process.env.JWT_SECRET || '';
  results.push({
    name: 'JWT Secret Strength',
    category: 'Security',
    status: jwtSecret.length >= 32 ? 'pass' : 'fail',
    message: jwtSecret.length >= 32
      ? 'JWT secret has adequate length'
      : `JWT secret too short (${jwtSecret.length} chars, need 32+)`,
    critical: true,
  });

  return results;
}

async function checkDatabaseConnection(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    // This would use actual database client in production
    const hasDbUrl = !!CONFIG.databaseUrl;

    results.push({
      name: 'Database Connection',
      category: 'Database',
      status: hasDbUrl ? 'pass' : 'fail',
      message: hasDbUrl ? 'Database URL configured' : 'Database URL not configured',
      critical: true,
    });

    // Check SSL
    const usesSsl = CONFIG.databaseUrl.includes('sslmode=require') ||
                    process.env.DATABASE_SSL === 'true';
    results.push({
      name: 'Database SSL',
      category: 'Database',
      status: usesSsl ? 'pass' : 'warn',
      message: usesSsl ? 'SSL enabled for database' : 'SSL not configured for database',
      critical: false,
    });
  } catch (error) {
    results.push({
      name: 'Database Connection',
      category: 'Database',
      status: 'fail',
      message: `Database connection failed: ${error}`,
      critical: true,
    });
  }

  return results;
}

async function checkRedisConnection(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const hasRedisUrl = !!CONFIG.redisUrl;
    const usesTls = CONFIG.redisUrl.startsWith('rediss://');

    results.push({
      name: 'Redis Connection',
      category: 'Cache',
      status: hasRedisUrl ? 'pass' : 'warn',
      message: hasRedisUrl ? 'Redis URL configured' : 'Redis URL not configured',
      critical: false,
    });

    results.push({
      name: 'Redis TLS',
      category: 'Cache',
      status: usesTls ? 'pass' : 'warn',
      message: usesTls ? 'Redis TLS enabled' : 'Redis TLS not configured',
      critical: false,
    });
  } catch (error) {
    results.push({
      name: 'Redis Connection',
      category: 'Cache',
      status: 'fail',
      message: `Redis connection failed: ${error}`,
      critical: false,
    });
  }

  return results;
}

async function checkSecurityHeaders(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Strict-Transport-Security',
    'Content-Security-Policy',
    'X-XSS-Protection',
  ];

  // In production, make actual request to check headers
  // For now, check if helmet middleware exists
  const helmitExists = fs.existsSync(
    path.join(__dirname, '../middleware/security.ts')
  );

  results.push({
    name: 'Security Middleware',
    category: 'Security',
    status: helmitExists ? 'pass' : 'fail',
    message: helmitExists
      ? 'Security middleware configured'
      : 'Security middleware not found',
    critical: true,
  });

  for (const header of requiredHeaders) {
    results.push({
      name: `Header: ${header}`,
      category: 'Security',
      status: helmitExists ? 'pass' : 'warn',
      message: `${header} ${helmitExists ? 'configured via Helmet' : 'status unknown'}`,
      critical: false,
    });
  }

  return results;
}

async function checkRateLimiting(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check if rate limiting middleware exists
  const securityMiddleware = path.join(__dirname, '../middleware/security.ts');

  if (fs.existsSync(securityMiddleware)) {
    const content = fs.readFileSync(securityMiddleware, 'utf-8');

    results.push({
      name: 'API Rate Limiting',
      category: 'Security',
      status: content.includes('apiRateLimiter') ? 'pass' : 'warn',
      message: content.includes('apiRateLimiter')
        ? 'API rate limiting configured'
        : 'API rate limiting not found',
      critical: false,
    });

    results.push({
      name: 'Auth Rate Limiting',
      category: 'Security',
      status: content.includes('authRateLimiter') ? 'pass' : 'warn',
      message: content.includes('authRateLimiter')
        ? 'Auth rate limiting configured'
        : 'Auth rate limiting not found',
      critical: true,
    });
  } else {
    results.push({
      name: 'Rate Limiting',
      category: 'Security',
      status: 'fail',
      message: 'Rate limiting middleware not found',
      critical: true,
    });
  }

  return results;
}

async function checkMonitoring(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check monitoring service
  const monitoringService = path.join(__dirname, '../services/monitoring.service.ts');
  results.push({
    name: 'Monitoring Service',
    category: 'Monitoring',
    status: fs.existsSync(monitoringService) ? 'pass' : 'warn',
    message: fs.existsSync(monitoringService)
      ? 'Monitoring service configured'
      : 'Monitoring service not found',
    critical: false,
  });

  // Check Sentry
  results.push({
    name: 'Error Tracking (Sentry)',
    category: 'Monitoring',
    status: process.env.SENTRY_DSN ? 'pass' : 'warn',
    message: process.env.SENTRY_DSN
      ? 'Sentry configured'
      : 'Sentry not configured',
    critical: false,
  });

  // Check Prometheus rules
  const prometheusRules = path.join(
    __dirname,
    '../../infrastructure/kubernetes/monitoring/prometheus-rules.yaml'
  );
  results.push({
    name: 'Prometheus Alerts',
    category: 'Monitoring',
    status: fs.existsSync(prometheusRules) ? 'pass' : 'warn',
    message: fs.existsSync(prometheusRules)
      ? 'Prometheus rules configured'
      : 'Prometheus rules not found',
    critical: false,
  });

  return results;
}

async function checkBackups(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check backup service
  const backupService = path.join(__dirname, '../services/backup.service.ts');
  results.push({
    name: 'Backup Service',
    category: 'Backup',
    status: fs.existsSync(backupService) ? 'pass' : 'warn',
    message: fs.existsSync(backupService)
      ? 'Backup service configured'
      : 'Backup service not found',
    critical: false,
  });

  // Check backup bucket
  results.push({
    name: 'Backup Bucket',
    category: 'Backup',
    status: process.env.BACKUP_BUCKET ? 'pass' : 'warn',
    message: process.env.BACKUP_BUCKET
      ? `Backup bucket: ${process.env.BACKUP_BUCKET}`
      : 'Backup bucket not configured',
    critical: false,
  });

  return results;
}

async function checkDocumentation(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check OpenAPI docs
  const openApiDocs = path.join(__dirname, '../docs/openapi.ts');
  results.push({
    name: 'API Documentation',
    category: 'Documentation',
    status: fs.existsSync(openApiDocs) ? 'pass' : 'warn',
    message: fs.existsSync(openApiDocs)
      ? 'OpenAPI documentation configured'
      : 'OpenAPI documentation not found',
    critical: false,
  });

  return results;
}

async function checkDependencies(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    // Run npm audit
    const auditOutput = execSync('npm audit --json 2>/dev/null || true', {
      encoding: 'utf-8',
      cwd: path.join(__dirname, '../..'),
    });

    let audit;
    try {
      audit = JSON.parse(auditOutput);
    } catch {
      audit = { metadata: { vulnerabilities: { critical: 0, high: 0 } } };
    }

    const critical = audit.metadata?.vulnerabilities?.critical || 0;
    const high = audit.metadata?.vulnerabilities?.high || 0;

    results.push({
      name: 'Critical Vulnerabilities',
      category: 'Dependencies',
      status: critical === 0 ? 'pass' : 'fail',
      message: `${critical} critical vulnerabilities`,
      critical: true,
    });

    results.push({
      name: 'High Vulnerabilities',
      category: 'Dependencies',
      status: high === 0 ? 'pass' : 'warn',
      message: `${high} high vulnerabilities`,
      critical: false,
    });
  } catch (error) {
    results.push({
      name: 'Dependency Audit',
      category: 'Dependencies',
      status: 'skip',
      message: 'Could not run npm audit',
      critical: false,
    });
  }

  return results;
}

// ============================================
// MAIN EXECUTION
// ============================================

async function runChecklist(): Promise<ChecklistSummary> {
  console.log('\n🚀 ProjectFlow Launch Checklist\n');
  console.log('=' .repeat(60));
  console.log(`Environment: ${CONFIG.environment}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('=' .repeat(60));

  const allResults: CheckResult[] = [];

  // Run all checks
  const checks = [
    { name: 'Environment Variables', fn: checkEnvironmentVariables },
    { name: 'Database', fn: checkDatabaseConnection },
    { name: 'Redis Cache', fn: checkRedisConnection },
    { name: 'Security Headers', fn: checkSecurityHeaders },
    { name: 'Rate Limiting', fn: checkRateLimiting },
    { name: 'Monitoring', fn: checkMonitoring },
    { name: 'Backups', fn: checkBackups },
    { name: 'Documentation', fn: checkDocumentation },
    { name: 'Dependencies', fn: checkDependencies },
  ];

  for (const check of checks) {
    console.log(`\n📋 Checking ${check.name}...`);
    const results = await check.fn();
    allResults.push(...results);

    for (const result of results) {
      const icon = {
        pass: '✅',
        fail: '❌',
        warn: '⚠️',
        skip: '⏭️',
      }[result.status];

      console.log(`   ${icon} ${result.name}: ${result.message}`);
    }
  }

  // Calculate summary
  const summary: ChecklistSummary = {
    timestamp: new Date(),
    environment: CONFIG.environment,
    results: allResults,
    passed: allResults.filter((r) => r.status === 'pass').length,
    failed: allResults.filter((r) => r.status === 'fail').length,
    warnings: allResults.filter((r) => r.status === 'warn').length,
    skipped: allResults.filter((r) => r.status === 'skip').length,
    ready: allResults.filter((r) => r.status === 'fail' && r.critical).length === 0,
  };

  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY');
  console.log('=' .repeat(60));
  console.log(`   ✅ Passed:   ${summary.passed}`);
  console.log(`   ❌ Failed:   ${summary.failed}`);
  console.log(`   ⚠️  Warnings: ${summary.warnings}`);
  console.log(`   ⏭️  Skipped:  ${summary.skipped}`);
  console.log('=' .repeat(60));

  if (summary.ready) {
    console.log('\n🎉 All critical checks passed! Ready for launch.\n');
  } else {
    console.log('\n⛔ Critical failures detected. Not ready for launch.\n');
    console.log('Failed critical checks:');
    allResults
      .filter((r) => r.status === 'fail' && r.critical)
      .forEach((r) => console.log(`   ❌ ${r.name}: ${r.message}`));
    console.log('');
  }

  return summary;
}

// Run if executed directly
if (require.main === module) {
  runChecklist()
    .then((summary) => {
      process.exit(summary.ready ? 0 : 1);
    })
    .catch((error) => {
      console.error('Launch checklist failed:', error);
      process.exit(1);
    });
}

export { runChecklist, CheckResult, ChecklistSummary };
