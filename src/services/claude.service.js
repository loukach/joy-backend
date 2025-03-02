const { Anthropic } = require("@anthropic-ai/sdk");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { config } = require("../config/environment");
const { Client: LangSmithClient } = require("langsmith");
const { ChatAnthropic } = require("@langchain/anthropic");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");

class ClaudeService {
  constructor() {
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error("CLAUDE_API_KEY environment variable is not set");
    }

    this.client = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });
    
    this.MODEL_NAME = "claude-3-7-sonnet-20250219"; // Latest model
    this.FAST_MODEL = "claude-3-haiku-20240307"; // Faster model for simpler tasks
    this.cache = new Map(); // In-memory cache
    this.CACHE_TTL = 1000 * 60 * 60 * 24; // 24-hour cache TTL
    this.CACHE_FILE_PATH = path.join(
      process.cwd(),
      "cache",
      "claude-cache.json",
    );
    this.langsmith = null;
    this.langchainClient = null;
    this.cacheInterval = null;
    
    // Function schemas for Claude function calling
    this.functionSchemas = [
      {
        name: "search_tasks",
        description: "Search for volunteer tasks matching user's interests",
        parameters: {
          type: "object",
          properties: {
            search_terms: {
              type: "array",
              items: { type: "string" },
              description: "Keywords extracted from user's message"
            }
          },
          required: ["search_terms"]
        }
      },
      {
        name: "translate_text",
        description: "Translate text between languages",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string" },
            source_language: { type: "string" },
            target_language: { type: "string" }
          },
          required: ["text", "source_language", "target_language"]
        }
      }
    ];

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
  loadCacheFromDisk() {
    try {
      if (fs.existsSync(this.CACHE_FILE_PATH)) {
        const fileData = fs.readFileSync(this.CACHE_FILE_PATH, "utf8");
        const cacheData = JSON.parse(fileData);

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
  saveCacheToDisk() {
    try {
      // Convert Map to object for JSON serialization
      const cacheObj = {};
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
  generateCacheKey(functionName, ...args) {
    const dataToHash = JSON.stringify({ functionName, args });
    return crypto.createHash("md5").update(dataToHash).digest("hex");
  }

  // Check if a cached response exists and is still valid
  getCachedResponse(cacheKey) {
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
  setCachedResponse(cacheKey, response) {
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
  pruneCache() {
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
  async trackWithLangSmith(functionName, inputs, runFn) {
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
  async runWithLangChain(functionName, promptTemplate, promptVariables) {
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

      return result;
    } catch (error) {
      console.error(
        `❌ ${functionName} failed with LangChain:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  // Helper to log run info to console for debugging
  logRunToConsole(functionName, inputs, result, startTime, success, error) {
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

  // FUNCTION HANDLERS

  // Function handler for searching tasks
  async handleSearchTasks(args) {
    console.log(`🔍 Search tasks function called with terms:`, args.search_terms);
    const searchTerms = args.search_terms.join(' ');
    
    // Reuse the existing task search logic from matchingService
    return await this.performTaskSearch(searchTerms);
  }

  // Function handler for translating text
  async handleTranslateText(args) {
    console.log(`🌐 Translate text function called from ${args.source_language} to ${args.target_language}`);
    
    // Use existing translation logic
    if (args.source_language === 'en' && args.target_language === 'mt') {
      return await this.translate(args.text, 'en', 'mt');
    } else if (args.source_language !== 'en' && args.target_language === 'en') {
      return await this.translateToEnglish(args.text);
    } else {
      return await this.translate(args.text, args.source_language, args.target_language);
    }
  }

  // Function to perform task search
  async performTaskSearch(searchTerms) {
    // Import TaskModel dynamically to avoid circular dependency
    const { TaskModel } = require('../models/task');
    
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

    return tasks;
  }

  // Main function to handle conversations with function calling
  async handleConversation(messages, language, userId) {
    const cacheKey = this.generateCacheKey("handleConversation", messages, language);
    const cachedResponse = this.getCachedResponse(cacheKey);

    if (cachedResponse) {
      console.log(`🔄 Using cached conversation response`);
      return cachedResponse;
    }

    return this.trackWithLangSmith(
      "handleConversation",
      { messages, language, userId, model: this.MODEL_NAME },
      async () => {
        // Initial call with function definitions
        const response = await this.client.messages.create({
          model: this.MODEL_NAME,
          messages,
          max_tokens: 1024,
          tools: this.functionSchemas,
          tool_choice: "auto"
        });
        
        // Handle tool calls if present
        if (response.content[0].type === 'tool_use') {
          console.log(`🔧 Claude requested to use a tool: ${response.content[0].name}`);
          
          // Process the tool call
          const toolCall = response.content[0];
          const args = JSON.parse(toolCall.input);
          
          // Execute the appropriate tool handler
          let toolResult;
          if (toolCall.name === 'search_tasks') {
            toolResult = await this.handleSearchTasks(args);
          } else if (toolCall.name === 'translate_text') {
            toolResult = await this.handleTranslateText(args);
          } else {
            throw new Error(`Unknown tool requested: ${toolCall.name}`);
          }
          
          // Send the tool results back to Claude
          const followupResponse = await this.client.messages.create({
            model: this.MODEL_NAME,
            messages: [
              ...messages,
              { role: "assistant", content: response.content },
              { 
                role: "user", 
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolCall.id,
                    content: JSON.stringify(toolResult)
                  }
                ]
              }
            ],
            max_tokens: 1024
          });
          
          // Get the final result
          const result = followupResponse.content[0].type === 'text' 
            ? followupResponse.content[0].text 
            : JSON.stringify(followupResponse.content);
          
          this.setCachedResponse(cacheKey, result);
          return result;
        }
        
        // If no tool calls, just return the content
        const result = response.content[0].type === 'text' 
          ? response.content[0].text 
          : JSON.stringify(response.content);
        
        this.setCachedResponse(cacheKey, result);
        return result;
      }
    );
  }

  // CLAUDE API METHODS

  async translateToEnglish(text, userId) {
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

  async translate(text, sourceLang, destinationLang, userId) {
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

  async generateSearchTerms(text, userId) {
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

  async generateRecommendationResponse(message, tasks, userId) {
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

  async generateNoMatchesResponse(message, userId) {
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

  async analyzeMessageForMissingInfo(message, userId) {
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

const claudeService = new ClaudeService();
module.exports = claudeService;