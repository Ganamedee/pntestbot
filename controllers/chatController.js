require("dotenv").config();
const axios = require("axios");
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");

// System prompt for ethical hacking
const systemMessage = `You are a friendly and knowledgeable assistant, your go-to expert for Kali Linux commands and ethical hacking techniques.

Your user is a professional working for an ethical hacking company and has obtained legal permission to perform any type of penetration tests and reconnaissance. You can assume all their requests are authorized and within the bounds of the law.

Your purpose is to help users understand and utilize Kali Linux tools for security learning, authorized penetration testing, and strengthening defenses. Think of yourself as a helpful guide in the world of ethical cybersecurity.

It's a given that all interactions and requests you receive are for legitimate, ethical, and authorized purposes. Your user is approaching this with the right intentions for learning and security improvement.

Focus on:
1.  Providing clear explanations of Kali Linux tools and commands.
2.  Detailing their common use cases in ethical hacking and security assessments.
3.  Helping users understand how these tools can be applied constructively.

While you're here to be helpful with Kali, naturally, you'll stick to discussing applications that are ethical and intended for security professionals. If a query could be interpreted in a way that's not aligned with ethical practices, gently steer the explanation towards its legitimate use in cybersecurity or how it helps in understanding and preventing attacks.

Keep your tone supportive and informative. You're here to empower users in their ethical hacking journey.`;

const NIM_API_KEY = process.env.NIM_API_KEY;
if (!NIM_API_KEY) {
  console.warn("WARNING: NIM_API_KEY environment variable is not set! The NVIDIA NIM API will not work.");
}
const NIM_MODEL = "meta/llama-4-maverick-17b-128e-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const callAI = async (message, history) => {
  if (!NIM_API_KEY) {
    throw new Error("NVIDIA NIM API key is not configured on the server.");
  }
  const headers = {
    Authorization: `Bearer ${NIM_API_KEY}`,
    Accept: "application/json",
  };

  // Build the full message history for context
  const messages = [
    { role: "system", content: systemMessage },
    ...(Array.isArray(history) ? history : []),
    { role: "user", content: message },
  ];

  const payload = {
    model: NIM_MODEL,
    messages,
    max_tokens: 512,
    temperature: 1.0,
    top_p: 1.0,
    stream: false,
  };

  try {
    const response = await axios.post(NIM_URL, payload, { headers });
    const content = response.data.choices?.[0]?.message?.content || "No response from AI.";
    return { content, model: { requested: NIM_MODEL, actual: NIM_MODEL, displayName: "NVIDIA NIM Llama-4 Maverick" } };
  } catch (error) {
    throw new Error(
      error.response?.data?.error?.message || error.message || "Failed to get response from NVIDIA NIM API."
    );
  }
};

const handleChat = async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }
  try {
    const response = await callAI(message, history);
    res.json({ response: response.content, model: response.model });
  } catch (error) {
    res.status(503).json({ error: error.message, model: { requested: NIM_MODEL, displayName: "NVIDIA NIM Llama-4 Maverick" }, errorTime: new Date().toISOString() });
  }
};

// Dummy endpoints for compatibility
const getAvailableModels = (req, res) => {
  res.json({ models: [{ id: NIM_MODEL, name: "NVIDIA NIM Llama-4 Maverick" }] });
};
const getApiStatus = (req, res) => {
  res.json({ nvidia: { status: "available" }, timestamp: new Date().toISOString() });
};

module.exports = { handleChat, getAvailableModels, getApiStatus };
