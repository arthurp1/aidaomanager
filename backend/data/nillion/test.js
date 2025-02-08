import { testNillionStorage } from './nillion.js';

async function runTest() {
    console.log('Starting Nillion storage test...');
    
    const result = await testNillionStorage();
    
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