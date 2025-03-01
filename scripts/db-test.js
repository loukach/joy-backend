require('dotenv').config();
const mongoose = require('mongoose');

async function testDbConnection() {
    try {
        const baseUri = process.env.MONGODB_URI;
        const dbName = process.env.DB_NAME;

        if (!baseUri || !dbName) {
            throw new Error('MONGODB_URI and DB_NAME must be defined in environment variables');
        }

        // Construct the full URI
        const uri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;
        
        // Log connection details (without credentials)
        console.log('Connection details:');
        console.log('Database:', dbName);
        console.log('URI (sanitized):', uri.replace(/\/\/[^@]+@/, '//[credentials]@'));

        await mongoose.connect(uri, {
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true
        });
        console.log('Connected successfully!');

        // List all collections
        console.log('\nAvailable collections:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });

        // Get reference to the tasks collection
        const tasksCollection = mongoose.connection.db.collection('tasks');
        
        // Count documents
        const count = await tasksCollection.countDocuments();
        console.log(`\nNumber of documents in tasks collection: ${count}`);

        // Try different queries
        console.log('\nTrying different queries:');
        
        // Find all documents
        const allDocs = await tasksCollection.find({}).toArray();
        console.log(`Find all documents: found ${allDocs.length} documents`);
        
        if (allDocs.length > 0) {
            console.log('\nFirst document:', JSON.stringify(allDocs[0], null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

testDbConnection().catch(console.error);