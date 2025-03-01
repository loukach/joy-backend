import Anthropic from '@anthropic-ai/sdk';
import { TaskModel } from '../models/task';
import claudeService from './claude.service';

export class MatchingService {

    // Find matches for a given message and language
    async findMatches(message: string, language: string, userId?: string) {

        // Stage 0: Translate message to English if needed  
        const searchMessage = language !== 'en'
            ? await claudeService.translateToEnglish(message, userId)
            : message;

        // Stage 1: Extract search terms using Claude
        const searchTerms = await this.extractSearchTerms(searchMessage, userId);

        // Stage 2: Perform MongoDB search with English terms (since tasks are stored in English)
        const tasks = await this.performTaskSearch(searchTerms);

        // Stage 3: Generate response based on search results
        let response: string;
        if (tasks.length > 0) {
            // We found matches - generate recommendations
            response = await claudeService.generateRecommendationResponse(message, tasks, userId);
        } else {
            // No matches found - analyze message for missing info and generate helpful response
            const missingInfo = await claudeService.analyzeMessageForMissingInfo(message, userId);
            // Create a more targeted prompt using the missing information
            const noMatchesPrompt = `Message: "${message}"\n\n` +
                `I notice we're missing some key information: ${missingInfo.join(', ')}.\n\n` +
                `Please generate a response that specifically asks about these missing details ` +
                `while keeping a friendly and encouraging tone.`;

            response = await claudeService.generateNoMatchesResponse(noMatchesPrompt, userId);
        }

        // If original message was in Maltese, translate response back
        if (language === 'mt') {
            response = await claudeService.translate(response, 'en', 'mt', userId);
        }

        return response;
    }

    // Extract search terms from the message using Claude
    private async extractSearchTerms(message: string, userId?: string): Promise<string> {
        // Use claudeService instead of direct Claude API calls
        const searchTerms = await claudeService.generateSearchTerms(message, userId);
        return searchTerms.join(' ');
    }

    private async performTaskSearch(searchTerms: string) {
        console.log(`Performing task search with terms: "${searchTerms}"`);

        // First try direct text search
        let tasks = await TaskModel.find(
            { $text: { $search: searchTerms } },
            { score: { $meta: "textScore" } }
        )
            .sort({ score: { $meta: "textScore" } })
            .limit(10)
            .exec();

        console.log(`Text search found ${tasks.length} tasks`);

        // If no results, try a more flexible search using individual terms
        if (tasks.length === 0) {
            const terms = searchTerms.split(' ').filter(term => term.length > 2);
            console.log(`Trying flexible search with terms:`, terms);

            tasks = await TaskModel.find({
                $or: [
                    { tags: { $in: terms.map(term => new RegExp(term, 'i')) } },
                    { title: { $regex: terms.join('|'), $options: 'i' } },
                    { description: { $regex: terms.join('|'), $options: 'i' } }
                ]
            })
                .limit(10)
                .exec();

            console.log(`Flexible search found ${tasks.length} tasks`);
        }

        // Log a sample task if any were found
        if (tasks.length > 0) {
            console.log('Sample task:', {
                title: tasks[0].title,
                tags: tasks[0].tags,
                description: tasks[0].description.substring(0, 100) + '...'
            });
        }

        return tasks;
    }

    // Generate recommendations based on the message, tasks, and language using Claude
    private async generateRecommendations(message: string, tasks: any[], userId?: string): Promise<string> {
        // Use claudeService instead of direct Claude API calls
        const response = await claudeService.generateRecommendationResponse(message, tasks, userId);
        return response;
    }

    private async generateNoMatchesResponse(message: string, language: string, userId?: string): Promise<string> {
        const prompt = `No exact matches were found for this volunteer request: "${message}"
    
    Please provide a helpful response in ${language} that:
    1. Acknowledges their interests
    2. Suggests broadening their search
    3. Asks helpful follow-up questions to better understand their preferences`;

        // console.log(`Sending prompt to Claude for generating no matches response: ${prompt}`);

        const response = "No matches found. Please try again later.";

        // console.log(`Received response from Claude: ${JSON.stringify(response)}`);

        return response;
    }
}

export default new MatchingService();