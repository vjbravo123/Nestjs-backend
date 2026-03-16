#!/usr/bin/env node

/**
 * Render Setup Helper
 * 
 * Prepares environment variables for easy copy-paste into Render dashboard
 * Run: node scripts/render-setup-helper.js
 */

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           RENDER DEPLOYMENT SETUP HELPER                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 This script will prepare your environment variables for Render\n');

const environments = [
  { name: 'Development', file: '.env.development', service: 'zappy-api-dev' },
  { name: 'QA/Staging', file: '.env.qa', service: 'zappy-api-qa' },
  { name: 'Production', file: '.env.production', service: 'zappy-api-prod' }
];

function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const vars = {};
    
    lines.forEach(line => {
      line = line.trim();
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return;
      
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        vars[key] = value;
      }
    });
    
    return vars;
  } catch (error) {
    return null;
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 DEPLOYMENT CHECKLIST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('💡 USING ENVIRONMENT GROUPS - EASIER MANAGEMENT!\n');
console.log('Your render.yaml uses Environment Groups to share common variables.');
console.log('Define sensitive values once per group instead of per service.\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Step 1: Open Render Dashboard');
console.log('   👉 https://dashboard.render.com/\n');

console.log('Step 2: Create Blueprint');
console.log('   • Click "New" → "Blueprint"');
console.log('   • Connect GitHub account (if not already)');
console.log('   • Select repository: Zappyeventz/backend-zappy');
console.log('   • Render will detect render.yaml and create:');
console.log('     - 4 Environment Groups (common, dev, qa, prod)');
console.log('     - 3 Web Services (zappy-api-dev, qa, prod)\n');

console.log('Step 3: Configure Environment Groups (IMPORTANT!)');
console.log('   Go to: Dashboard → Environment Groups');
console.log('   You\'ll see 4 groups created. Update sensitive values:\n');
console.log('   📦 zappy-common (shared across all):');
console.log('      • MSG91_AUTH_KEY → Set your real MSG91 key');
console.log('      • JWT_SECRET → Set a secure random string\n');
console.log('   📦 zappy-dev:');
console.log('      • MONGODB_URL → Your dev MongoDB connection string');
console.log('      • AWS_ACCESS_KEY_ID → Your AWS dev credentials');
console.log('      • AWS_SECRET_ACCESS_KEY → Your AWS dev secret\n');
console.log('   📦 zappy-qa:');
console.log('      • MONGODB_URL → Your QA MongoDB connection string');
console.log('      • AWS_ACCESS_KEY_ID → Your AWS QA credentials');
console.log('      • AWS_SECRET_ACCESS_KEY → Your AWS QA secret');
console.log('      • RAZORPAY_KEY_ID → Test key (rzp_test_xxx)');
console.log('      • RAZORPAY_KEY_SECRET → Test secret\n');
console.log('   📦 zappy-prod:');
console.log('      • MONGODB_URL → Your production MongoDB connection string');
console.log('      • AWS_ACCESS_KEY_ID → Your AWS prod credentials');
console.log('      • AWS_SECRET_ACCESS_KEY → Your AWS prod secret');
console.log('      • RAZORPAY_KEY_ID → Live key (rzp_live_xxx)');
console.log('      • RAZORPAY_KEY_SECRET → Live secret\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

environments.forEach(env => {
  const envPath = path.resolve(__dirname, '..', env.file);
  const vars = parseEnvFile(envPath);
  
  if (!vars) {
    console.log(`❌ ${env.name} - File not found: ${env.file}\n`);
    return;
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${env.name.toUpperCase()} (${env.service})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  console.log(`📍 Service: ${env.service}`);
  console.log(`📁 Go to: Dashboard → ${env.service} → Settings → Environment\n`);
  
  console.log('Copy these variables (click "Add Environment Variable" for each):\n');
  
  Object.entries(vars).forEach(([key, value]) => {
    // Mask sensitive values in display
    let displayValue = value;
    if (key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY')) {
      if (value.length > 10) {
        displayValue = value.substring(0, 4) + '...' + value.substring(value.length - 4);
      }
    }
    
    console.log(`${key}=${value}`);
  });
  
  console.log('\n');
});

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔐 MONGODB ATLAS CONFIGURATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Don\'t forget to whitelist Render IPs in MongoDB Atlas:\n');
console.log('1. Go to: https://cloud.mongodb.com/');
console.log('2. Select your cluster');
console.log('3. Network Access → Add IP Address');
console.log('4. Add: 0.0.0.0/0 (Allow from anywhere)');
console.log('   OR get specific Render IPs from their docs\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 DEPLOYMENT VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('After setup, your APIs will be available at:\n');
console.log('🔹 Development: https://zappy-api-dev.onrender.com');
console.log('🔹 QA/Staging:  https://zappy-api-qa.onrender.com');
console.log('🔹 Production:  https://zappy-api-prod.onrender.com\n');

console.log('Test endpoints:');
console.log('  curl https://zappy-api-dev.onrender.com');
console.log('  curl https://zappy-api-qa.onrender.com');
console.log('  curl https://zappy-api-prod.onrender.com\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💡 NEXT STEPS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('1. ✅ Copy environment variables to Render (see above)');
console.log('2. ✅ Whitelist IPs in MongoDB Atlas');
console.log('3. ✅ Trigger manual deploy for each service');
console.log('4. ✅ Check logs for any errors');
console.log('5. ✅ Test API endpoints');
console.log('6. ✅ Update frontend NEXT_PUBLIC_API_URL to point to Render URLs\n');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('✨ Setup helper complete!\n');
console.log('👉 Open Render Dashboard: https://dashboard.render.com/\n');
