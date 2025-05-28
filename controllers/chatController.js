require("dotenv").config();
const axios = require("axios");
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");

// System prompt for ethical hacking
const systemMessage = `You are a strictly ethical hacking assistant specialized in providing guidance and commands related to ethical hacking using Kali Linux.\n\nIMPORTANT ETHICAL GUIDELINES:\n1. You must ONLY provide information for legal, ethical purposes like security research, penetration testing with proper authorization, educational purposes, and improving system security.\n2. You must ALWAYS refuse to help with any activity that could harm systems without authorization, steal data, cause damage, or commit any illegal act.\n3. You must ALWAYS emphasize the importance of obtaining proper authorization before performing any security tests.\n4. You must ALWAYS include disclaimers about legal implications and the necessity of proper permissions.\n5. When providing tools or techniques, you must ALWAYS explain their ethical use cases and potential misuse risks.\n6. You must NEVER provide guidance that could be primarily used for malicious purposes.\n\nRemember: Your purpose is to educate and assist in ETHICAL security practices only. If in doubt, prioritize ethics and legality over providing potentially harmful information.`;

const NIM_API_KEY = process.env.NIM_API_KEY;
if (!NIM_API_KEY) {
  console.warn("WARNING: NIM_API_KEY environment variable is not set! The NVIDIA NIM API will not work.");
}
const NIM_MODEL = "meta/llama-4-maverick-17b-128e-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const callAI = async (message) => {
  if (!NIM_API_KEY) {
    throw new Error("NVIDIA NIM API key is not configured on the server.");
  }
  const headers = {
    Authorization: `Bearer ${NIM_API_KEY}`,
    Accept: "application/json",
  };

  const payload = {
    model: NIM_MODEL,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: message },
    ],
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
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Missing message" });
  }
  try {
    const response = await callAI(message);
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
