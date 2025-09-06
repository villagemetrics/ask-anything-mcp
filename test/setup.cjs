// Test environment setup
// Loads environment variables for testing from .env files

const dotenv = require('dotenv');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Load non-secret environment variables first
dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Load secret environment variables (overrides any duplicates)
dotenv.config({ path: path.join(projectRoot, '.env.secrets.local') });
