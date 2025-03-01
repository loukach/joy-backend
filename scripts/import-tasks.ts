import mongoose from 'mongoose';
import { parse } from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Task Schema
const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        maxLength: 200
    },
    description: {
        type: String,
        maxLength: 2000
    },
    organization: {
        type: String
    },
    location: {
        type: String
    },
    type: {
        type: String,
        enum: ['one-time', 'ongoing']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String
    }],
    expiryDate: {
        type: Date
    },
    isFamilyFriendly: {
        type: Boolean,
        default: false
    },
    isRemote: {
        type: Boolean,
        default: false
    },
    addedBy: {
        type: String
    },
    volunteersRequired: {
        type: Number,
        min: 1
    }
}, {
    timestamps: true
});

const Task = mongoose.model('Task', taskSchema);

// Define interfaces
interface CSVTask {
    Title: string;
    Description: string;
    Organization: string;
    Location: string;
    Type: string;
    Status: string;
    Tags: string;
    'Expiry Date': string;
    'Family Friendly': string;
    Remote: string;
    'Added By': string;
    'Volunteers Required': string;
}

function parseExpiryDate(dateStr: string): Date {
    try {
        let date: Date;
        
        // Check if the date is in YYYY-MM-DD format
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-').map(Number);
            date = new Date(year, month - 1, day);
        }
        // Check if the date is in DD/MM/YYYY format
        else if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/').map(Number);
            date = new Date(year, month - 1, day);
        }
        else {
            throw new Error(`Unsupported date format: ${dateStr}`);
        }
        
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date: ${dateStr}`);
        }
        
        return date;
    } catch (error: any) {
        const errorMessage = error.message || 'Unknown error occurred while parsing date';
        throw new Error(`Error parsing date ${dateStr}: ${errorMessage}`);
    }
}

function transformTask(csvTask: CSVTask, index: number) {
    try {
        // Log raw data for debugging
        // console.log(`\nProcessing row ${index + 1}:`);
        // console.log('Raw data:', JSON.stringify(csvTask, null, 2));

        const task = {
            title: csvTask.Title?.trim(),
            description: csvTask.Description?.trim(),
            organization: csvTask.Organization?.trim(),
            location: csvTask.Location?.trim(),
            type: csvTask.Type?.toLowerCase(),
            isActive: csvTask.Status === 'active',
            tags: csvTask.Tags ? csvTask.Tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
            expiryDate: parseExpiryDate(csvTask['Expiry Date']),
            isFamilyFriendly: csvTask['Family Friendly'] === 'Yes',
            isRemote: csvTask.Remote === 'Yes',
            addedBy: csvTask['Added By']?.trim(),
            volunteersRequired: (() => {
                if (!csvTask['Volunteers Required']) return undefined;
                const parsed = parseInt(csvTask['Volunteers Required']);
                return isNaN(parsed) ? undefined : parsed;
            })()
        };

        // console.log(`Successfully transformed row ${index + 1}`);
        return task;
    } catch (error: any) {
        const errorMessage = error.message || 'Unknown error occurred while transforming task';
        throw new Error(`Error transforming task at index ${index}: ${errorMessage}`);
    }
}

async function importTasks(options: {
    mode: 'replace' | 'skip' | 'update'
}) {
    try {
        // Construct database URI
        const baseUri = process.env.MONGODB_URI;
        const dbName = process.env.DB_NAME;

        if (!baseUri || !dbName) {
            throw new Error('MONGODB_URI and DB_NAME must be defined in environment variables');
        }

        const uri = `${baseUri}/${dbName}?retryWrites=true&w=majority`;

        console.log(`Import mode: ${options.mode}`);

        // Connect to MongoDB
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri, {
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true
        });
        console.log('Connected successfully to MongoDB');

        // Handle existing data based on mode
        if (options.mode === 'replace') {
            console.log('Clearing existing tasks...');
            await Task.deleteMany({});
            console.log('Existing tasks cleared');
        }

        // Read and parse CSV file
        const fileContent = fs.readFileSync(
            path.join(__dirname, '../data/tasks_export_2024-12-23.csv'),
            'utf-8'
        );

        console.log('Parsing CSV file...');
        const { data, errors } = parse<CSVTask>(fileContent, {
            header: true,
            skipEmptyLines: true
        });

        if (errors.length) {
            console.error('CSV parsing errors:', errors);
            throw new Error('Failed to parse CSV');
        }

        console.log(`Found ${data.length} rows in CSV`);

        // Transform and validate tasks
        const tasks: any[] = [];
        const skipped: { index: number; title: string }[] = [];
        const updated: { index: number; title: string }[] = [];
        const failed: { index: number; rawData: CSVTask; error: string }[] = [];

        for (let i = 0; i < data.length; i++) {
            try {
                const task = transformTask(data[i], i);
                
                const existingTask = await Task.findOne({
                    title: task.title,
                    organization: task.organization
                });

                if (existingTask) {
                    if (options.mode === 'skip') {
                        skipped.push({ index: i, title: task.title });
                        continue;
                    } else if (options.mode === 'update') {
                        await Task.updateOne(
                            { _id: existingTask._id },
                            { $set: task }
                        );
                        updated.push({ index: i, title: task.title });
                        continue;
                    }
                }

                tasks.push(task);
                
            } catch (error: any) {
                failed.push({
                    index: i,
                    rawData: data[i],
                    error: error.message
                });
            }
        }

        // Summary before insertion
        console.log('\nProcessing Summary:');
        console.log(`- Tasks to insert: ${tasks.length}`);
        console.log(`- Tasks skipped (duplicates): ${skipped.length}`);
        console.log(`- Tasks updated: ${updated.length}`);
        console.log(`- Tasks failed to process: ${failed.length}`);

        // Insert new tasks
        if (tasks.length > 0) {
            console.log('\nInserting tasks one by one...');
            const results = {
                success: 0,
                failed: [] as { index: number; error: string; task: any }[]
            };

            for (let i = 0; i < tasks.length; i++) {
                try {
                    console.log(`\nAttempting to insert task ${i + 1}/${tasks.length}`);
                    console.log('Title:', tasks[i].title);
                    console.log('Organization:', tasks[i].organization);
                    
                    const newTask = new Task(tasks[i]);
                    await newTask.save();
                    
                    console.log('✅ Successfully inserted');
                    results.success++;
                } catch (error: any) {
                    console.log('❌ Failed to insert');
                    console.log('Error:', error.message);
                    console.log('Task data:', JSON.stringify(tasks[i], null, 2));
                    
                    results.failed.push({
                        index: i,
                        error: error.message,
                        task: tasks[i]
                    });
                }
            }

            // Final summary
            console.log('\n==== INSERTION SUMMARY ====');
            console.log(`Total tasks processed: ${tasks.length}`);
            console.log(`Successfully inserted: ${results.success}`);
            console.log(`Failed to insert: ${results.failed.length}`);

            if (results.failed.length > 0) {
                console.log('\nFailed insertions details:');
                results.failed.forEach(({ index, error, task }) => {
                    console.log(`\nTask #${index + 1}:`);
                    console.log('Title:', task.title);
                    console.log('Organization:', task.organization);
                    console.log('Error:', error);
                });
            }
        }

        // Log details
        if (skipped.length > 0) {
            console.log('\nSkipped tasks (duplicates):');
            skipped.forEach(item => console.log(`- Row ${item.index + 1}: ${item.title}`));
        }

        if (updated.length > 0) {
            console.log('\nUpdated tasks:');
            updated.forEach(item => console.log(`- Row ${item.index + 1}: ${item.title}`));
        }

        if (failed.length > 0) {
            console.log('\nFailed tasks:');
            failed.forEach(item => {
                console.log(`\nRow ${item.index + 1}:`);
                console.log('Error:', item.error);
                console.log('Raw data:', JSON.stringify(item.rawData, null, 2));
            });
        }

    } catch (error: any) {
        console.error('Import failed:', error.message || error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    }
}

// Run the import with desired mode
importTasks({ mode: 'skip' }).catch(console.error);