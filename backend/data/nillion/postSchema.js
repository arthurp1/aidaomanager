import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { orgConfig } from './nillionOrgConfig.js';
import { createRequire } from 'module';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);
const schema = require('./schema.json');

const SCHEMA_ID_FILE = path.join(__dirname, 'schemaId.json');

async function createSchema() {
  try {
    const org = new SecretVaultWrapper(
      orgConfig.nodes,
      orgConfig.orgCredentials
    );
    await org.init();

    // Create a new collection schema for all nodes in the org
    const collectionName = 'AIDAOMANAGER';
    const newSchema = await org.createSchema(schema, collectionName);
    const schemaId = newSchema[0].result.data;
    
    // Store the schema ID
    await fs.writeFile(SCHEMA_ID_FILE, JSON.stringify({ schemaId }));
    
    console.log('✅ New Collection Schema created for all nodes:', newSchema);
    console.log('👀 Schema ID:', schemaId);
    
    return schemaId;
  } catch (error) {
    console.error('❌ Failed to use SecretVaultWrapper:', error.message);
    throw error;
  }
}

async function getSchemaId() {
  try {
    const data = await fs.readFile(SCHEMA_ID_FILE, 'utf8');
    return JSON.parse(data).schemaId;
  } catch (error) {
    console.error('❌ Failed to read schema ID:', error.message);
    return null;
  }
}

export { createSchema, getSchemaId };

// For direct execution of the file
if (import.meta.url === `file://${process.argv[1]}`) {
  createSchema().catch(console.error);
}