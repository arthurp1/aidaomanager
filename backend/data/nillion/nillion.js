import { SecretVaultWrapper } from 'nillion-sv-wrappers';
import { v4 as uuidv4 } from 'uuid';
import { orgConfig } from './nillionOrgConfig.js';

const SCHEMA_ID = 'df17c241-271a-4e43-9a95-71fc9f6d5638';

/**
 * Initialize the SecretVaultWrapper collection for writing
 * @returns {Promise<SecretVaultWrapper>}
 */
async function initializeCollectionForWrite() {
  const collection = new SecretVaultWrapper(
    orgConfig.nodes,
    { ...orgConfig.orgCredentials, operation: 'write' },
    SCHEMA_ID
  );
  await collection.init();
  return collection;
}

/**
 * Initialize the SecretVaultWrapper collection for reading
 * @returns {Promise<SecretVaultWrapper>}
 */
async function initializeCollectionForRead() {
  const collection = new SecretVaultWrapper(
    orgConfig.nodes,
    { ...orgConfig.orgCredentials, operation: 'read' },
    SCHEMA_ID
  );
  await collection.init();
  return collection;
}

/**
 * Write data to Nillion nodes
 * @param {Array} data - Array of data objects to write
 * @returns {Promise<{success: boolean, createdIds?: Array, error?: string}>}
 */
async function writeToNillion(data) {
  try {
    const collection = await initializeCollectionForWrite();
    console.log('Writing data to nodes...');
    const dataWritten = await collection.writeToNodes(data);
    const newIds = [...new Set(dataWritten.map(item => item.result.data.created).flat())];
    console.log('Created record IDs:', newIds);
    
    return {
      success: true,
      createdIds: newIds
    };
  } catch (error) {
    console.error('Failed to write to Nillion:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Read data from Nillion nodes
 * @param {Object} query - Query parameters for filtering data
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
 */
async function readFromNillion(query = {}, limit = null) {
  try {
    const collection = await initializeCollectionForRead();
    console.log('Reading data from nodes...');
    const dataRead = await collection.readFromNodes(query);
    const limitedData = limit ? dataRead.slice(0, limit) : dataRead;
    
    return {
      success: true,
      data: limitedData
    };
  } catch (error) {
    console.error('Failed to read from Nillion:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test the Nillion storage functionality
 * @param {Array} testData - Array of test data objects to write and read
 */
async function testNillionStorage(testData) {
  try {
    // Test writing data
    const writeResult = await writeToNillion(testData);
    if (!writeResult.success) {
      throw new Error(`Write operation failed: ${writeResult.error}`);
    }

    // Test reading data
    const readResult = await readFromNillion({}, testData.length);
    if (!readResult.success) {
      throw new Error(`Read operation failed: ${readResult.error}`);
    }

    return {
      success: true,
      writeOperation: writeResult,
      readOperation: readResult
    };
  } catch (error) {
    console.error('Test failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export { 
  writeToNillion, 
  readFromNillion, 
  testNillionStorage 
};



