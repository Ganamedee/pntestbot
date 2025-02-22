require("dotenv").config();
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");

const systemMessage = `You are a strictly ethical hacking assistant specialised in providing guidance and commands related to ethical hacking using Kali Linux...`;

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
  const client = ModelClient(
    "https://models.github.ai/inference",
    new AzureKeyCredential(process.env.GITHUB_TOKEN),
    {
      // Add timeout configuration
      timeout: 90000, // 60 seconds
      retries: 2,
    }
  );

  const selectedModel =
    AVAILABLE_MODELS[modelChoice]?.id || AVAILABLE_MODELS.gpt4.id;
  console.log(`Using model: ${selectedModel}`);

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
        temperature: 1,
        max_tokens: 4096,
        top_p: 1,
      },
    });

    if (isUnexpected(response)) {
      throw new Error(`Model Error: ${response.body.error || "Unknown error"}`);
    }

    return {
      content: response.body.choices[0].message.content,
      model: {
        requested: modelChoice,
        actual: selectedModel,
        displayName: AVAILABLE_MODELS[modelChoice]?.name || "Unknown Model",
      },
    };
  } catch (error) {
    if (error.message.includes("FUNCTION_INVOCATION_TIMEOUT")) {
      throw new Error(
        "The model is taking too long to respond. Try a shorter query or switch to a different model."
      );
    }
    throw error;
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
    // Enhanced error handling
    console.error("Chat handler error:", error);
    const errorMessage = error.message || "Failed to get response from AI";
    res.status(500).json({
      error: errorMessage,
      model: {
        requested: model,
        displayName: AVAILABLE_MODELS[model]?.name || "Unknown Model",
      },
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
