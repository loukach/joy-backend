const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    organization: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['one-time', 'ongoing']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    tags: [{
        type: String,
        trim: true
    }],
    expiryDate: {
        type: Date,
        required: true
    },
    isFamilyFriendly: {
        type: Boolean,
        required: true
    },
    isRemote: {
        type: Boolean,
        required: true
    },
    addedBy: {
        type: String,
        required: true,
        trim: true
    },
    volunteersRequired: {
        type: Number,
        min: 0
    }
});

// Add text indexes for search
taskSchema.index({ 
    title: 'text', 
    description: 'text', 
    tags: 'text' 
});

const TaskModel = mongoose.model('Task', taskSchema, 'tasks');

module.exports = { TaskModel };