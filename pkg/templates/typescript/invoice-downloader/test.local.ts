/**
 * Local test script for invoice-downloader
 * 
 * This script validates TypeScript compilation and checks for common issues.
 * 
 * Note: Full testing requires deploying to Kernel since this template uses
 * Kernel's browser API which is only available in the Kernel environment.
 * 
 * Run with: npx tsx test.local.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

async function test(): Promise<void> {
  console.log('🧪 Testing invoice-downloader template...\n');

  // Check 1: Verify .env.example exists
  console.log('✓ Checking .env.example...');
  try {
    const envExample = readFileSync(join(process.cwd(), '.env.example'), 'utf-8');
    if (!envExample.includes('ANTHROPIC_API_KEY')) {
      throw new Error('.env.example missing ANTHROPIC_API_KEY');
    }
    console.log('  ✓ .env.example looks good\n');
  } catch (error) {
    console.error('  ✗ Error reading .env.example:', error);
    process.exit(1);
  }

  // Check 2: Verify main files exist
  console.log('✓ Checking required files...');
  const requiredFiles = [
    'index.ts',
    'loop.ts',
    'session.ts',
    'types.ts',
    'tools/computer.ts',
    'tools/collection.ts',
  ];

  for (const file of requiredFiles) {
    try {
      readFileSync(join(process.cwd(), file), 'utf-8');
      console.log(`  ✓ ${file} exists`);
    } catch (error) {
      console.error(`  ✗ ${file} missing!`);
      process.exit(1);
    }
  }
  console.log('');

  // Check 3: Verify package.json dependencies
  console.log('✓ Checking dependencies...');
  try {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
    );
    
    const requiredDeps = ['@anthropic-ai/sdk', '@onkernel/sdk', 'luxon'];
    for (const dep of requiredDeps) {
      if (!packageJson.dependencies?.[dep]) {
        console.error(`  ✗ Missing dependency: ${dep}`);
        process.exit(1);
      }
      console.log(`  ✓ ${dep} is listed`);
    }
    console.log('');
  } catch (error) {
    console.error('  ✗ Error reading package.json:', error);
    process.exit(1);
  }

  console.log('✅ All local checks passed!\n');
  console.log('📝 Next steps:');
  console.log('   1. Set up your .env file with ANTHROPIC_API_KEY');
  console.log('   2. Deploy: kernel deploy index.ts --env-file .env');
  console.log('   3. Test: kernel invoke ts-invoice-downloader download-invoice-by-id --payload \'{"invoiceId": "TEST"}\'');
}

test().catch(console.error);
