const mongoose = require('mongoose');

// Message schema for conversation messages
const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ['user', 'bot'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Conversation schema
const conversationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: false,
        index: true
    },
    messages: [messageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: () => ({})
    }
});

// Update the updatedAt field on save
conversationSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Create and export the model
const ConversationModel = mongoose.model('Conversation', conversationSchema);

module.exports = { ConversationModel };