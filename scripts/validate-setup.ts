#!/usr/bin/env npx tsx
/**
 * Apex Lab: Setup Validation Script
 *
 * Checks that all required environment variables are configured correctly.
 * Run with: pnpm validate
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ENV_PATH = join(ROOT, '.env');

// ANSI colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

interface ValidationResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: ValidationResult[] = [];

function pass(name: string, message: string) {
  results.push({ name, status: 'pass', message });
  console.log(`  ${GREEN}✓${RESET} ${name}: ${message}`);
}

function fail(name: string, message: string) {
  results.push({ name, status: 'fail', message });
  console.log(`  ${RED}✗${RESET} ${name}: ${message}`);
}

function warn(name: string, message: string) {
  results.push({ name, status: 'warn', message });
  console.log(`  ${YELLOW}⚠${RESET} ${name}: ${message}`);
}

function header(text: string) {
  console.log(`\n${CYAN}${BOLD}${text}${RESET}`);
  console.log('─'.repeat(50));
}

// Load .env file
function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) {
    return {};
  }

  const content = readFileSync(ENV_PATH, 'utf-8');
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

// Validation checks
function validateEnvFile() {
  header('Environment File');

  if (!existsSync(ENV_PATH)) {
    fail('.env file', 'Not found. Run: cp .env.example .env');
    return false;
  }

  pass('.env file', 'Found');
  return true;
}

function validateGoogleClientId(env: Record<string, string>) {
  header('Google OAuth');

  const clientId = env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    fail('VITE_GOOGLE_CLIENT_ID', 'Not set. See ONBOARDING.md section 1.');
    return;
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    warn('VITE_GOOGLE_CLIENT_ID', 'Format looks incorrect. Should end with .apps.googleusercontent.com');
    return;
  }

  if (clientId === 'your-client-id-here.apps.googleusercontent.com') {
    fail('VITE_GOOGLE_CLIENT_ID', 'Still set to placeholder value');
    return;
  }

  pass('VITE_GOOGLE_CLIENT_ID', 'Set and format looks valid');
}

function validateGoogleDriveFolderId(env: Record<string, string>) {
  header('Google Drive');

  const folderId = env.VITE_GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) {
    fail('VITE_GOOGLE_DRIVE_FOLDER_ID', 'Not set. See ONBOARDING.md section 2.');
    return;
  }

  if (folderId.length < 20) {
    warn('VITE_GOOGLE_DRIVE_FOLDER_ID', 'Value looks too short for a folder ID');
    return;
  }

  pass('VITE_GOOGLE_DRIVE_FOLDER_ID', 'Set');
}

function validateCoachingWorkerUrl(env: Record<string, string>) {
  header('AI Coaching');

  const workerUrl = env.VITE_COACHING_WORKER_URL;

  if (!workerUrl) {
    warn('VITE_COACHING_WORKER_URL', 'Not set. AI coaching will be disabled. See ONBOARDING.md section 3.');
    return;
  }

  if (!workerUrl.startsWith('https://')) {
    fail('VITE_COACHING_WORKER_URL', 'Must start with https://');
    return;
  }

  if (workerUrl === 'https://your-app.vercel.app') {
    fail('VITE_COACHING_WORKER_URL', 'Still set to placeholder value');
    return;
  }

  pass('VITE_COACHING_WORKER_URL', `Set to ${workerUrl}`);
}

function validateOptionalSettings(env: Record<string, string>) {
  header('Optional Settings');

  const appName = env.VITE_APP_NAME;
  if (appName && appName !== 'Apex Lab') {
    pass('VITE_APP_NAME', `Custom: "${appName}"`);
  } else {
    console.log(`  ${CYAN}○${RESET} VITE_APP_NAME: Using default "Apex Lab"`);
  }

  const ownerEmail = env.VITE_OWNER_EMAIL;
  if (ownerEmail) {
    pass('VITE_OWNER_EMAIL', 'Set');
  } else {
    console.log(`  ${CYAN}○${RESET} VITE_OWNER_EMAIL: Not set (optional)`);
  }
}

function printSummary() {
  header('Summary');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  console.log(`  ${GREEN}Passed:${RESET} ${passed}`);
  if (warned > 0) console.log(`  ${YELLOW}Warnings:${RESET} ${warned}`);
  if (failed > 0) console.log(`  ${RED}Failed:${RESET} ${failed}`);

  console.log('');

  if (failed > 0) {
    console.log(`${RED}${BOLD}Setup incomplete.${RESET} Fix the issues above and run again.`);
    console.log(`See ${CYAN}ONBOARDING.md${RESET} for detailed setup instructions.\n`);
    process.exit(1);
  } else if (warned > 0) {
    console.log(`${YELLOW}${BOLD}Setup has warnings.${RESET} Some features may not work correctly.`);
    console.log(`See ${CYAN}ONBOARDING.md${RESET} for detailed setup instructions.\n`);
    process.exit(0);
  } else {
    console.log(`${GREEN}${BOLD}Setup complete!${RESET} Run ${CYAN}pnpm dev${RESET} to start the app.\n`);
    process.exit(0);
  }
}

// Main
console.log(`\n${BOLD}Apex Lab: Setup Validation${RESET}`);
console.log('═'.repeat(50));

const envExists = validateEnvFile();

if (envExists) {
  const env = loadEnv();
  validateGoogleClientId(env);
  validateGoogleDriveFolderId(env);
  validateCoachingWorkerUrl(env);
  validateOptionalSettings(env);
}

printSummary();
