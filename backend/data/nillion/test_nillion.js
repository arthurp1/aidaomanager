import { testNillionStorage } from './nillion.js';
import { v4 as uuidv4 } from 'uuid';

// Test data structure with plain values (encryption handled by SecretVaultWrapper based on schema)
const testUserData = [
  {
    id: uuidv4(),
    content: "This is a sensitive test message 1",
    authorId: "123456789",
    authorUsername: "Test User 1",
    channelId: "987654321",
    channelName: "test-channel",
    timestamp: new Date().toISOString(),
    editedTimestamp: null,
    attachments: [],
    embeds: [],
    reactions: [
      {
        emoji: {
          name: "👍",
          id: null,
          animated: false
        },
        count: 1,
        users: [
          {
            userId: "123456789",
            username: "Test User 1"
          }
        ]
      }
    ]
  },
  {
    id: uuidv4(),
    content: "This is a sensitive test message 2",
    authorId: "987654321",
    authorUsername: "Test User 2",
    channelId: "987654321",
    channelName: "test-channel",
    timestamp: new Date().toISOString(),
    editedTimestamp: null,
    attachments: [],
    embeds: [],
    reactions: []
  }
];

async function runTest() {
    console.log('Starting Nillion storage test...');
    
    const result = await testNillionStorage(testUserData);
    
    if (result.success) {
        console.log('\n✅ Test completed successfully!');
        console.log('\nWrite operation results:');
        console.log('Created IDs:', result.writeOperation.createdIds);
        
        console.log('\nRead operation results:');
        console.log('Retrieved data:', JSON.stringify(result.readOperation.data, null, 2));
    } else {
        console.log('\n❌ Test failed!');
        console.error('Error:', result.error);
    }
}

// Run the test
runTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});