import { Anthropic } from "@anthropic-ai/sdk";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "../config/environment";
import { Client as LangSmithClient } from "langsmith";
import { ChatAnthropic } from "@langchain/anthropic";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

interface CacheEntry {
  response: string;
  timestamp: number;
}

export class ClaudeService {
  private client: Anthropic;
  private readonly MODEL_NAME = "claude-3-7-sonnet-20250219"; // Updated to use the latest model
  private readonly FAST_MODEL = "claude-3-haiku-20240307"; // Much faster model for simpler tasks
  private cache: Map<string, CacheEntry> = new Map(); // In-memory cache
  private readonly CACHE_TTL = 1000 * 60 * 60 * 24; // 24-hour cache TTL
  private readonly CACHE_FILE_PATH = path.join(
    process.cwd(),
    "cache",
    "claude-cache.json",
  );
  private langsmith: LangSmithClient | null = null;
  private langchainClient: ChatAnthropic | null = null;
  private cacheInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error("CLAUDE_API_KEY environment variable is not set");
    }

    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    // Initialize LangChain integration
    try {
      this.langchainClient = new ChatAnthropic({
        anthropicApiKey: process.env.CLAUDE_API_KEY,
        modelName: this.FAST_MODEL
      });
      console.log("✅ LangChain client initialized");
    } catch (error) {
      console.error(
        "❌ Failed to initialize LangChain client:",
        error instanceof Error ? error.message : String(error),
      );
      this.langchainClient = null;
    }

    // Ensure cache directory exists
    const cacheDir = path.dirname(this.CACHE_FILE_PATH);
    if (!fs.existsSync(cacheDir)) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
      } catch (err) {
        console.warn("Failed to create cache directory:", err);
      }
    }

    // Initialize LangSmith using LangChain's automatic tracing
    if (process.env.LANGSMITH_API_KEY) {
      try {
        // Always set up these environment variables for LangChain's tracing
        process.env.LANGCHAIN_PROJECT =
          process.env.LANGCHAIN_PROJECT ||
          config.langsmithProject ||
          "joy-volunteer-matching";
        process.env.LANGCHAIN_TRACING_V2 = "true";

        // We don't need to use the LangSmith client directly when using LangChain
        // Just initialize it to confirm connectivity
        this.langsmith = new LangSmithClient();

        console.log("✅ LangSmith tracing enabled");
        console.log(`📊 Project: ${process.env.LANGCHAIN_PROJECT}`);

        // List environment variables for debugging
        const relevantVars = [
          `LANGCHAIN_PROJECT=${process.env.LANGCHAIN_PROJECT || "(not set)"}`,
          `LANGCHAIN_TRACING_V2=${process.env.LANGCHAIN_TRACING_V2 || "(not set)"}`,
          `LANGSMITH_API_KEY=${process.env.LANGSMITH_API_KEY ? "(set)" : "(not set)"}`,
        ];
        console.log(`📋 LangSmith configuration: ${relevantVars.join(", ")}`);
      } catch (error) {
        console.error(
          "❌ Failed to initialize LangSmith:",
          error instanceof Error ? error.message : String(error),
        );
        this.langsmith = null;
      }
    } else {
      console.warn("⚠️ LangSmith API key not provided. Tracing disabled.");
    }

    // Load cache from disk
    this.loadCacheFromDisk();

    // Schedule periodic cache saving in non-test environment
    if (process.env.NODE_ENV !== "test") {
      this.cacheInterval = setInterval(
        () => this.saveCacheToDisk(),
        5 * 60 * 1000,
      ); // Save every 5 minutes
    }
  }

  // Clean up when service is destroyed (for tests)
  cleanup() {
    if (this.cacheInterval) {
      clearInterval(this.cacheInterval);
      this.cacheInterval = null;
    }
    // Save cache before cleanup
    this.saveCacheToDisk();
  }

  // Load cache from disk
  private loadCacheFromDisk(): void {
    try {
      if (fs.existsSync(this.CACHE_FILE_PATH)) {
        const fileData = fs.readFileSync(this.CACHE_FILE_PATH, "utf8");
        const cacheData: Record<string, CacheEntry> = JSON.parse(fileData);

        // Convert to Map and filter out expired entries
        const now = Date.now();
        Object.entries(cacheData).forEach(([key, value]) => {
          if (now - value.timestamp <= this.CACHE_TTL) {
            this.cache.set(key, value);
          }
        });

        console.log(
          `📦 Loaded ${this.cache.size} valid entries from Claude cache`,
        );
      }
    } catch (err) {
      console.warn("⚠️ Failed to load Claude cache from disk:", err);
    }
  }

  // Save cache to disk
  private saveCacheToDisk(): void {
    try {
      // Convert Map to object for JSON serialization
      const cacheObj: Record<string, CacheEntry> = {};
      this.cache.forEach((value, key) => {
        cacheObj[key] = value;
      });

      fs.writeFileSync(this.CACHE_FILE_PATH, JSON.stringify(cacheObj), "utf8");
      console.log(`💾 Saved ${this.cache.size} entries to Claude cache file`);
    } catch (err) {
      console.warn("⚠️ Failed to save Claude cache to disk:", err);
    }
  }

  // Generate a cache key from the function name and parameters
  private generateCacheKey(functionName: string, ...args: any[]): string {
    const dataToHash = JSON.stringify({ functionName, args });
    return crypto.createHash("md5").update(dataToHash).digest("hex");
  }

  // Check if a cached response exists and is still valid
  private getCachedResponse(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL;
    if (isExpired) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.response;
  }

  // Store a response in the cache
  private setCachedResponse(cacheKey: string, response: string): void {
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now(),
    });

    // If cache is getting too large, prune it
    if (this.cache.size > 1000) {
      this.pruneCache();
    }
  }

  // Remove oldest entries when cache gets too large
  private pruneCache(): void {
    // Convert to array to sort by timestamp
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 20% of entries
    const entriesToRemove = Math.ceil(entries.length * 0.2);
    entries.slice(0, entriesToRemove).forEach(([key]) => {
      this.cache.delete(key);
    });

    console.log(`🧹 Pruned ${entriesToRemove} old entries from Claude cache`);
  }

  // Create a LangSmith run and track the Claude API call
  private async trackWithLangSmith<T>(
    functionName: string,
    inputs: Record<string, any>,
    runFn: () => Promise<T>,
  ): Promise<T> {
    // Always log what we're doing
    const userId = inputs.userId || "anonymous";
    const runName = `${functionName}-${new Date().toISOString()}`;
    const startTime = Date.now();

    // Debug log
    if (this.langsmith) {
      console.log(
        `🔍 Tracking run '${runName}' for user ${userId} via LangSmith`,
      );
    }

    try {
      // Execute the actual function
      const result = await runFn();

      // Record successful run
      this.logRunToConsole(functionName, inputs, result, startTime, true);

      return result;
    } catch (error) {
      // Record failed run
      this.logRunToConsole(functionName, inputs, null, startTime, false, error);
      throw error;
    }
  }

  // Run with LangChain and track the Claude API call
  private async runWithLangChain(
    functionName: string,
    promptTemplate: string,
    promptVariables: Record<string, any>,
  ): Promise<string> {
    try {
      // Initialize LangChain components
      const prompt = PromptTemplate.fromTemplate(promptTemplate);
      const outputParser = new StringOutputParser();

      if (!this.langchainClient) {
        throw new Error("LangChain client not initialized");
      }

      // Create LangChain chain
      const chain = prompt.pipe(this.langchainClient).pipe(outputParser);
      
      // Execute the chain
      const startTime = Date.now();
      console.log(`🔄 Running ${functionName} with LangChain`);

      // Use runName attribute and metadata to improve LangSmith visibility
      const result = await chain.invoke(promptVariables, {
        runName: `JoyBot-${functionName}`,
        tags: ["joy-volunteer-matching", functionName],
        // Additional metadata for the specific invocation
        metadata: {
          userId: promptVariables.userId || 'anonymous',
          function: functionName,
          inputSize: JSON.stringify(promptVariables).length
        }
      });

      const duration = Date.now() - startTime;
      console.log(
        `✅ ${functionName} completed in ${duration}ms via LangChain`,
      );

      return result as string;
    } catch (error) {
      console.error(
        `❌ ${functionName} failed with LangChain:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  // Helper to log run info to console for debugging
  private logRunToConsole(
    functionName: string,
    inputs: Record<string, any>,
    result: any,
    startTime: number,
    success: boolean,
    error?: any,
  ): void {
    const duration = Date.now() - startTime;
    const userId = inputs.userId || "anonymous";
    const cached = inputs.cached || false;

    if (success) {
      console.log(
        `✅ ${functionName} completed in ${duration}ms for user ${userId} ${cached ? "(cached)" : ""}`,
      );
    } else {
      console.error(
        `❌ ${functionName} failed after ${duration}ms for user ${userId}: ${error}`,
      );
    }
  }

  // CLAUDE API METHODS

  async translateToEnglish(text: string, userId?: string): Promise<string> {
    const cacheKey = this.generateCacheKey("translateToEnglish", text);
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(
        `🔄 Using cached translation for: "${text.substring(0, 30)}..."`,
      );

      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "translateToEnglish",
        { text, userId, cached: true, model: this.FAST_MODEL },
        async () => cachedResponse,
      );
    }

    console.log(`🌐 Translating to English: "${text.substring(0, 30)}..."`);

    const promptTemplate = `
I need you to translate the following Maltese text to English. 
This is extremely important: DO NOT return any text in Maltese or any explanations.
ONLY return the translated text in English.

Maltese text to translate: "{text}"

Remember: ONLY provide the English translation, nothing else.`;

    // Try using LangChain first if available
    if (this.langchainClient) {
      try {
        const result = await this.runWithLangChain(
          "translateToEnglish",
          promptTemplate,
          { text },
        );

        this.setCachedResponse(cacheKey, result);
        return result;
      } catch (error) {
        console.error(
          "LangChain translation failed, falling back to direct API:",
          error,
        );
        // Fall through to direct API call
      }
    }

    // Fallback to direct Claude API
    return this.trackWithLangSmith(
      "translateToEnglish",
      { text, userId, model: this.FAST_MODEL },
      async () => {
        const prompt = promptTemplate.replace("{text}", text);
        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model for translation
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text.trim();
          this.setCachedResponse(cacheKey, result);
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }

  async translate(
    text: string,
    sourceLang: string,
    destinationLang: string,
    userId?: string,
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(
      "translate",
      text,
      sourceLang,
      destinationLang,
    );
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(
        `🔄 Using cached translation from ${sourceLang} to ${destinationLang}`,
      );

      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "translate",
        {
          text,
          sourceLang,
          destinationLang,
          userId,
          cached: true,
          model: this.FAST_MODEL,
        },
        async () => cachedResponse,
      );
    }

    console.log(
      `🌐 Translating from ${sourceLang} to ${destinationLang}: "${text.substring(0, 30)}..."`,
    );

    const promptTemplate = `
I need you to translate the following text from {sourceLang} to {destinationLang}. 
This is extremely important: DO NOT return any text in the original language or any explanations.
ONLY return the translated text in {destinationLang}.

Text to translate: "{text}"

Remember: ONLY provide the translation in {destinationLang}, nothing else.`;

    // Try using LangChain first if available
    if (this.langchainClient) {
      try {
        const result = await this.runWithLangChain(
          "translate",
          promptTemplate,
          { text, sourceLang, destinationLang },
        );

        this.setCachedResponse(cacheKey, result);
        return result;
      } catch (error) {
        console.error(
          "LangChain translation failed, falling back to direct API:",
          error,
        );
        // Fall through to direct API call
      }
    }

    // Fallback to direct Claude API
    return this.trackWithLangSmith(
      "translate",
      { text, sourceLang, destinationLang, userId, model: this.FAST_MODEL },
      async () => {
        // Replace template variables
        const prompt = promptTemplate
          .replace("{text}", text)
          .replace(/{sourceLang}/g, sourceLang)
          .replace(/{destinationLang}/g, destinationLang);

        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model for translation
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text.trim();
          this.setCachedResponse(cacheKey, result);
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }

  async generateSearchTerms(text: string, userId?: string): Promise<string[]> {
    const cacheKey = this.generateCacheKey("generateSearchTerms", text);
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(
        `🔄 Using cached search terms for: "${text.substring(0, 30)}..."`,
      );

      const result = JSON.parse(cachedResponse);
      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "generateSearchTerms",
        { text, userId, cached: true, model: this.FAST_MODEL },
        async () => result,
      );
    }

    console.log(
      `🔍 Generating search terms for: "${text.substring(0, 30)}..."`,
    );

    const promptTemplate = `Extract key search terms from this volunteer preference message. Return only the search terms as a comma-separated list: "{text}"`;

    // Try using LangChain first if available
    if (this.langchainClient) {
      try {
        const result = await this.runWithLangChain(
          "generateSearchTerms",
          promptTemplate,
          { text },
        );

        const terms = result.split(",").map((term) => term.trim());
        this.setCachedResponse(cacheKey, JSON.stringify(terms));
        return terms;
      } catch (error) {
        console.error(
          "LangChain search terms generation failed, falling back to direct API:",
          error,
        );
        // Fall through to direct API call
      }
    }

    // Fallback to direct Claude API
    return this.trackWithLangSmith(
      "generateSearchTerms",
      { text, userId, model: this.FAST_MODEL },
      async () => {
        const prompt = promptTemplate.replace("{text}", text);
        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model for search terms
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text
            .split(",")
            .map((term) => term.trim());
          this.setCachedResponse(cacheKey, JSON.stringify(result));
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }

  async generateRecommendationResponse(
    message: string,
    tasks: any[],
    userId?: string,
  ): Promise<string> {
    console.log(
      `💡 Generating recommendations for: "${message.substring(0, 30)}..." with ${tasks.length} tasks`,
    );

    // For semantic caching, we need to handle similar inputs
    // Create a simplified version of message by extracting key intent/topics
    const simplifiedMessage = message
      .toLowerCase()
      .replace(/[^\w\s]/g, "") // Remove punctuation
      .split(/\s+/) // Split into words
      .filter((word) => word.length > 3) // Keep only significant words
      .sort() // Sort for consistent ordering
      .join(" ");

    // Create a simplified version of tasks for the cache key to avoid cache misses due to minor differences
    const simplifiedTasks = tasks.map((t) => ({
      id: t._id?.toString(),
      title: t.title,
      tags: t.tags?.sort().join(","),
    }));

    // Primary cache key with message intent and tasks
    const cacheKey = this.generateCacheKey(
      "generateRecommendationResponse",
      simplifiedMessage,
      simplifiedTasks,
    );
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🔄 Using cached recommendation response`);

      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "generateRecommendationResponse",
        {
          message,
          tasks: simplifiedTasks,
          userId,
          cached: true,
          model: this.FAST_MODEL,
        },
        async () => cachedResponse,
      );
    }

    // Secondary cache key with just message intent
    const messageOnlyCacheKey = this.generateCacheKey(
      "messageIntent",
      simplifiedMessage,
    );
    const similarResponseCached = this.getCachedResponse(messageOnlyCacheKey);

    if (similarResponseCached) {
      console.log(`🔄 Using similar cached recommendation response`);

      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "generateRecommendationResponse",
        {
          message,
          tasks: simplifiedTasks,
          userId,
          cached: true,
          similarMatch: true,
          model: this.FAST_MODEL,
        },
        async () => similarResponseCached,
      );
    }

    // Limit the number of tasks to reduce prompt size (only include top 3 most relevant)
    const limitedTasks = tasks.slice(0, 3);

    // Create a more compact task representation
    const compactTasksJson = limitedTasks.map((task) => ({
      title: task.title,
      // Truncate description to 100 chars for prompt efficiency
      description:
        task.description?.substring(0, 100) +
        (task.description?.length > 100 ? "..." : ""),
      tags: task.tags,
      organization: task.organization,
      location: task.location,
    }));

    const prompt = `As a volunteer coordinator, recommend these volunteering opportunities based on the message: "${message}"
    
Available opportunities (showing top 3):
${JSON.stringify(compactTasksJson, null, 2)}

Provide a brief, natural response that:
1. Acknowledges their interests
2. Lists the top 2-3 opportunities and why they match
3. Asks 1 follow-up question

Keep your response concise but friendly.`;

    return this.trackWithLangSmith(
      "generateRecommendationResponse",
      { message, tasks: simplifiedTasks, userId, model: this.FAST_MODEL },
      async () => {
        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model for recommendations
          max_tokens: 800, // Reduced token limit for faster generation
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text;
          this.setCachedResponse(cacheKey, result);
          // Also cache the message intent for partial matching
          this.setCachedResponse(messageOnlyCacheKey, result);
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }

  async generateNoMatchesResponse(
    message: string,
    userId?: string,
  ): Promise<string> {
    const cacheKey = this.generateCacheKey(
      "generateNoMatchesResponse",
      message,
    );
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🔄 Using cached no-matches response`);

      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "generateNoMatchesResponse",
        { message, userId, cached: true, model: this.FAST_MODEL },
        async () => cachedResponse,
      );
    }

    console.log(
      `❓ Generating no matches response for: "${message.substring(0, 30)}..."`,
    );

    const prompt = `As a volunteer coordinator, I need to respond to this volunteer request: "${message}"

Unfortunately, I couldn't find any exact matches for their interests. Please provide a helpful response that:

1. Warmly acknowledges their specific interests and motivation to volunteer
2. Asks ONE targeted follow-up questions about either:
   - Their specific skills or experience
   - or Preferred time commitment (weekdays, weekends, evenings)
   - or Geographic area or travel preferences
   - or Types of organizations they'd like to work with
3. Maintains an encouraging and supportive tone
4. Keep it concise.

Make the response conversational and natural, focused on gathering more information to help find the right opportunity.`;

    return this.trackWithLangSmith(
      "generateNoMatchesResponse",
      { message, userId, model: this.FAST_MODEL },
      async () => {
        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model for these simple responses
          max_tokens: 600, // Reduced token limit for faster generation
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text;
          this.setCachedResponse(cacheKey, result);
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }

  async analyzeMessageForMissingInfo(
    message: string,
    userId?: string,
  ): Promise<string[]> {
    const cacheKey = this.generateCacheKey(
      "analyzeMessageForMissingInfo",
      message,
    );
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🔄 Using cached missing info analysis`);

      const result = JSON.parse(cachedResponse);
      // Track cache hit in LangSmith
      return this.trackWithLangSmith(
        "analyzeMessageForMissingInfo",
        { message, userId, cached: true, model: this.FAST_MODEL },
        async () => result,
      );
    }

    console.log(
      `🔍 Analyzing message for missing info: "${message.substring(0, 30)}..."`,
    );

    const prompt = `Analyze this volunteer request: "${message}"

Identify what key information is missing that would help match them with opportunities. Consider:
- Skills and experience
- Time availability
- Location preferences
- Preferred cause areas
- Type of work they want to do
- Target beneficiary groups they want to help

Return only a comma-separated list of the most important missing pieces of information.`;

    return this.trackWithLangSmith(
      "analyzeMessageForMissingInfo",
      { message, userId, model: this.FAST_MODEL },
      async () => {
        const response = await this.client.messages.create({
          model: this.FAST_MODEL, // Use faster model
          max_tokens: 400, // Reduced token limit for faster generation
          messages: [{ role: "user", content: prompt }],
        });

        if (response.content[0].type === "text") {
          const result = response.content[0].text
            .split(",")
            .map((info) => info.trim());
          this.setCachedResponse(cacheKey, JSON.stringify(result));
          return result;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      },
    );
  }
}

export default new ClaudeService();
