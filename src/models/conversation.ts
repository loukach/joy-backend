import mongoose, { Document, Schema } from 'mongoose';

// Define the message interface
interface IMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

// Define the conversation schema interface
export interface IConversation extends Document {
  userId?: string;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// Create the message schema
const MessageSchema = new Schema<IMessage>({
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

// Create the conversation schema
const ConversationSchema = new Schema<IConversation>({
  userId: {
    type: String
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create and export the model
export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);