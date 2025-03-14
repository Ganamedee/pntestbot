require("dotenv").config();
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

const callAI = async (message, modelChoice = "gpt4") => {
  // Validate model choice early
  if (!AVAILABLE_MODELS[modelChoice]) {
    console.log(`Invalid model: ${modelChoice}, falling back to GPT-4`);
    modelChoice = "gpt4";
  }

  const selectedModel = AVAILABLE_MODELS[modelChoice].id;
  console.log(`Using model: ${selectedModel}`);

  // Initialize client with improved timeout and retry settings
  const client = ModelClient(
    "https://models.github.ai/inference",
    new AzureKeyCredential(process.env.GITHUB_TOKEN),
    {
      timeout: 120000, // 120 seconds - increased from 90s
      retries: 3, // Increased retries from 2
    }
  );

  try {
    const response = await client.path("/chat/completions").post({
      body: {
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
      },
    });

    // Improved error handling
    if (isUnexpected(response)) {
      const errorDetails = response.body.error || "Unknown model error";
      console.error(`Model response error: ${errorDetails}`);
      throw new Error(`Model Error: ${errorDetails}`);
    }

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
    console.error(`AI call error: ${error.message}`);

    if (error.message.includes("FUNCTION_INVOCATION_TIMEOUT")) {
      throw new Error(
        "The AI model took too long to respond. Please try a shorter query or switch to a different model."
      );
    } else if (error.message.includes("401") || error.message.includes("403")) {
      throw new Error(
        "Authentication error. The API key may be invalid or expired."
      );
    } else if (error.message.includes("429")) {
      throw new Error(
        "Rate limit exceeded. Please wait a minute before trying again."
      );
    } else if (
      error.message.includes("500") ||
      error.message.includes("502") ||
      error.message.includes("503")
    ) {
      throw new Error(
        "The AI service is currently experiencing issues. Please try again later."
      );
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

  try {
    const response = await callAI(message, model);
    res.json({
      response: response.content,
      model: response.model,
    });
  } catch (error) {
    // Enhanced error handling with more context
    console.error("Chat handler error:", error);

    const errorMessage = error.message || "Failed to get response from AI";
    const modelInfo = {
      requested: model,
      displayName: AVAILABLE_MODELS[model]?.name || "Unknown Model",
    };

    // Return a 503 status code for service unavailable rather than 500
    // This helps indicate to the client that the service is temporarily unavailable
    res.status(503).json({
      error: errorMessage,
      model: modelInfo,
      errorTime: new Date().toISOString(),
    });
  }
};

const getAvailableModels = (req, res) => {
  res.json({
    models: Object.entries(AVAILABLE_MODELS).map(([key, value]) => ({
      id: key,
      name: value.name,
    })),
  });
};

module.exports = { handleChat, getAvailableModels };
