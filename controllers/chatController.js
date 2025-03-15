require("dotenv").config();
const axios = require("axios");
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");

// Enhanced system prompt with stronger ethical guidelines
const systemMessage = `You are a strictly ethical hacking assistant specialized in providing guidance and commands related to ethical hacking using Kali Linux.

IMPORTANT ETHICAL GUIDELINES:
1. You must ONLY provide information for legal, ethical purposes like security research, penetration testing with proper authorization, educational purposes, and improving system security.
2. You must ALWAYS refuse to help with any activity that could harm systems without authorization, steal data, cause damage, or commit any illegal act.
3. You must ALWAYS emphasize the importance of obtaining proper authorization before performing any security tests.
4. You must ALWAYS include disclaimers about legal implications and the necessity of proper permissions.
5. When providing tools or techniques, you must ALWAYS explain their ethical use cases and potential misuse risks.
6. You must NEVER provide guidance that could be primarily used for malicious purposes.

Remember: Your purpose is to educate and assist in ETHICAL security practices only. If in doubt, prioritize ethics and legality over providing potentially harmful information.`;

const AVAILABLE_MODELS = {
  gpt4: {
    id: "gpt-4o",
    name: "GPT-4",
  },
  deepseek: {
    id: "DeepSeek-R1",
    name: "DeepSeek",
  },
  "llama-3.3": {
    id: "Llama-3.3-70B-Instruct",
    name: "Llama 3.3 (70B)",
  },
  phi4: {
    id: "Phi-4",
    name: "Phi-4",
  },
  "llama-3.1": {
    id: "Meta-Llama-3.1-405B-Instruct",
    name: "Llama 3.1 (405B)",
  },
};

// Add debug logging function
const debugLog = (message, data = null) => {
  const prefix = "[PenTestAI Debug]";
  console.log(`${prefix} ${message}`);
  if (data) {
    console.log(`${prefix} Data:`, data);
  }
};

// Rate limiting state
let rateLimitInfo = {
  isLimited: false,
  resetTime: null,
  lastChecked: null,
  remaining: null,
  limit: null,
};

// Function to check rate limit status using GitHub API
const checkGitHubRateLimit = async (token) => {
  try {
    const response = await axios.get("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const { resources } = response.data;
    debugLog("GitHub Rate Limit Status:", resources);

    // Check if we're rate limited - use a higher threshold (10) to be safe
    const isLimited = resources.core.remaining < 10;

    // Update rate limit info
    rateLimitInfo = {
      isLimited,
      resetTime: new Date(resources.core.reset * 1000),
      lastChecked: new Date(),
      remaining: resources.core.remaining,
      limit: resources.core.limit,
    };

    return rateLimitInfo;
  } catch (error) {
    debugLog("Error checking rate limit:", error.message);
    return {
      isLimited: false,
      error: error.message,
      lastChecked: new Date(),
    };
  }
};

// Dummy response for when GitHub API is unavailable
const getFallbackResponse = (message) => {
  return {
    content: `⚠️ **GitHub API Rate Limit Exceeded**

I'm sorry, but the GitHub AI API is currently rate limited. This happens when:

- The shared API token has reached its usage limit
- Too many requests are made in a short period of time
- The same token is used across multiple applications (which you mentioned)

**What you can try:**
1. Wait a few minutes and try again
2. Try a different model from the dropdown
3. If you're the administrator, consider creating a new GitHub token specifically for this application

Your question will be answered once the rate limit resets.`,
    model: {
      requested: "none",
      actual: "none",
      displayName: "Rate Limit Response",
    },
  };
};

const callAI = async (message, modelChoice = "gpt4") => {
  // Validate model choice early
  if (!AVAILABLE_MODELS[modelChoice]) {
    debugLog(`Invalid model: ${modelChoice}, falling back to GPT-4`);
    modelChoice = "gpt4";
  }

  const selectedModel = AVAILABLE_MODELS[modelChoice].id;
  debugLog(`Using model: ${selectedModel}`);

  // Get the token
  const token = process.env.GITHUB_TOKEN.trim();

  // Check if we're rate limited
  const currentTime = new Date();
  let shouldCheckRateLimit = true;

  // Only check rate limit if we haven't checked recently (within last 60 seconds)
  if (
    rateLimitInfo.lastChecked &&
    currentTime - rateLimitInfo.lastChecked < 60000
  ) {
    shouldCheckRateLimit = false;
  }

  // If we're rate limited and the reset time hasn't passed, return fallback
  if (
    rateLimitInfo.isLimited &&
    rateLimitInfo.resetTime &&
    currentTime < rateLimitInfo.resetTime
  ) {
    debugLog("Rate limited, returning fallback response");
    return getFallbackResponse(message);
  }

  // Check rate limit if needed
  if (shouldCheckRateLimit) {
    try {
      const rateLimit = await checkGitHubRateLimit(token);
      if (rateLimit.isLimited) {
        debugLog("Rate limit check confirmed we're limited");
        return getFallbackResponse(message);
      }
    } catch (error) {
      debugLog("Error checking rate limit, proceeding with caution", error);
    }
  }

  debugLog("Proceeding with GitHub AI request");

  // Initialize client with improved timeout and retry settings
  const client = ModelClient(
    "https://models.github.ai/inference",
    new AzureKeyCredential(token),
    {
      timeout: 150000, // 150 seconds
      retries: 4,
    }
  );

  try {
    // Create the request payload
    const requestBody = {
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        { role: "user", content: message },
      ],
      model: selectedModel,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 1,
    };

    // Send the request
    const response = await client.path("/chat/completions").post({
      body: requestBody,
    });

    // Reset rate limit flag if successful
    if (rateLimitInfo.isLimited) {
      rateLimitInfo.isLimited = false;
    }

    // Check for unexpected response
    if (isUnexpected(response)) {
      const errorDetails = response.body.error || "Unknown model error";
      debugLog(`Model response error: ${errorDetails}`, response.body);

      // Check for rate limit errors
      if (
        errorDetails.toLowerCase().includes("rate limit") ||
        errorDetails.toLowerCase().includes("too many requests") ||
        errorDetails.toLowerCase().includes("429")
      ) {
        rateLimitInfo.isLimited = true;
        // Set a default reset time of 5 minutes from now if not specified
        rateLimitInfo.resetTime = new Date(Date.now() + 5 * 60 * 1000);
        return getFallbackResponse(message);
      }

      throw new Error(`Model Error: ${errorDetails}`);
    }

    debugLog("Successfully received response from GitHub AI");

    return {
      content: response.body.choices[0].message.content,
      model: {
        requested: modelChoice,
        actual: selectedModel,
        displayName: AVAILABLE_MODELS[modelChoice].name,
      },
    };
  } catch (error) {
    // Enhanced error categorization for better debugging
    debugLog(`AI call error: ${error.message}`, error);

    // Check for rate limiting errors
    if (
      error.message.includes("429") ||
      error.message.includes("too many requests") ||
      error.message.includes("rate limit") ||
      error.message.includes("exceeded")
    ) {
      rateLimitInfo.isLimited = true;
      rateLimitInfo.resetTime = new Date(Date.now() + 5 * 60 * 1000); // Default 5 minute cooldown
      return getFallbackResponse(message);
    }

    // Check for other specific error types
    if (
      error.message.includes("FUNCTION_INVOCATION_TIMEOUT") ||
      error.message.includes("timeout")
    ) {
      throw new Error(
        "The AI model took too long to respond. Please try a shorter query or switch to a different model."
      );
    } else if (
      error.message.includes("401") ||
      error.message.includes("403") ||
      error.message.includes("Authentication")
    ) {
      throw new Error(
        "Authentication error. The GitHub API key may be invalid or expired."
      );
    } else if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503") ||
      error.message.includes("504")
    ) {
      throw new Error(
        "The GitHub AI service is currently experiencing issues. Please try again later."
      );
    } else if (
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ECONNREFUSED")
    ) {
      throw new Error(
        "Unable to connect to the AI service. Please check your network connection."
      );
    }

    // Try to extract any embedded error messages
    const errorMatch = error.message.match(/Error: (.+)/);
    if (errorMatch && errorMatch[1]) {
      throw new Error(`Error connecting to AI model: ${errorMatch[1]}`);
    }

    // Rethrow the original error with more context
    throw new Error(`Error connecting to AI model: ${error.message}`);
  }
};

const handleChat = async (req, res) => {
  const { message, model } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }

  debugLog(`Received chat request with model: ${model}`, {
    messageLength: message.length,
  });

  try {
    const response = await callAI(message, model);
    debugLog("Successfully processed chat request");

    res.json({
      response: response.content,
      model: response.model,
    });
  } catch (error) {
    // Enhanced error handling with more context
    debugLog("Chat handler error:", error);

    const errorMessage = error.message || "Failed to get response from AI";
    const modelInfo = {
      requested: model,
      displayName: AVAILABLE_MODELS[model]?.name || "Unknown Model",
    };

    // Return a 503 status code for service unavailable rather than 500
    res.status(503).json({
      error: errorMessage,
      model: modelInfo,
      errorTime: new Date().toISOString(),
      rateLimited: rateLimitInfo.isLimited,
      resetTime: rateLimitInfo.resetTime,
    });
  }
};

// Endpoint to check API status
const getApiStatus = async (req, res) => {
  const status = {
    github: { status: "unknown" },
    rateLimit: null,
    timestamp: new Date().toISOString(),
  };

  // Check GitHub token
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim()) {
    try {
      // First check our cached rate limit info
      if (
        rateLimitInfo.lastChecked &&
        Date.now() - rateLimitInfo.lastChecked < 60000
      ) {
        // Use cached info if recent
        status.github.status = rateLimitInfo.isLimited
          ? "rate_limited"
          : "available";
        status.rateLimit = {
          remaining: rateLimitInfo.remaining,
          limit: rateLimitInfo.limit,
          reset: rateLimitInfo.resetTime,
        };
      } else {
        // Otherwise check actual rate limit
        const rateLimitStatus = await checkGitHubRateLimit(
          process.env.GITHUB_TOKEN.trim()
        );
        status.github.status = rateLimitStatus.isLimited
          ? "rate_limited"
          : "available";
        status.rateLimit = {
          remaining: rateLimitStatus.remaining,
          limit: rateLimitStatus.limit,
          reset: rateLimitStatus.resetTime,
        };
      }
    } catch (error) {
      status.github.status = "error";
      status.github.error = error.message;
    }
  } else {
    status.github.status = "not_configured";
  }

  res.json(status);
};

const getAvailableModels = (req, res) => {
  res.json({
    models: Object.entries(AVAILABLE_MODELS).map(([key, value]) => ({
      id: key,
      name: value.name,
    })),
  });
};

module.exports = { handleChat, getAvailableModels, getApiStatus };
