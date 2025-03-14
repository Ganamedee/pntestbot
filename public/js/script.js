// Initialize marked with options after it's loaded
window.onload = function () {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    sanitize: false,
    smartLists: true,
    smartypants: true,
    xhtml: true,
  });

  // Custom renderer
  const renderer = {
    code(code, language) {
      const escapedCode = code
        .replace(/&amp;/g, "&amp;amp;")
        .replace(/&lt;/g, "&amp;lt;")
        .replace(/&gt;/g, "&amp;gt;")
        .replace(/&quot;/g, "&amp;quot;")
        .replace(/'/g, "&amp;#039;");

      return `<div class="code-block">
      <div class="code-header">
        ${language ? `<span class="code-language">${language}</span>` : ""}
        <button class="copy-button">Copy</button>
      </div>
      <pre><code class="language-${
        language || "text"
      }">${escapedCode}</code></pre>
    </div>`;
    },
    strong(text) {
      return `<strong>${text}</strong>`;
    },
    heading(text, level) {
      return `<h${level}>${text}</h${level}>`;
    },
    blockquote(quote) {
      if (quote.includes("Parameters:")) {
        return `<div class="parameter-section">⚡ ${quote}</div>`;
      }
      return `<blockquote>${quote}</blockquote>`;
    },
    paragraph(text) {
      if (text.startsWith("Example:")) {
        return `<div class="example-section">💡 ${text}</div>`;
      }
      if (text.startsWith("⚠️")) {
        return `<div class="warning">${text}</div>`;
      }
      return `<p>${text}</p>`;
    },
    listitem(text) {
      const paramMatch = text.match(/^([^:]+):\s*(.*)$/);
      if (paramMatch) {
        return `<div class="parameter-item">
        <code class="param-name">${paramMatch[1]}</code>
        <div class="param-desc">${paramMatch[2]}</div>
      </div>`;
      }
      return `<li>${text}</li>`;
    },
    list(body, ordered) {
      const type = ordered ? "ol" : "ul";
      return `<${type}>${body}</${type}>`;
    },
  };

  marked.use({ renderer });

  // Load model preferences
  loadModelPreference();

  // Display welcome message
  displayWelcomeMessage();
};

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatContainer = document.getElementById("chat-container");
const sendButton = document.getElementById("sendChat");
const modelSelect = document.getElementById("model-select");

// Connection status tracking
let connectionIssues = false;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds to prevent rapid successive requests

// Enter key handling
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (chatInput.value.trim() && !sendButton.disabled) {
      chatForm.dispatchEvent(new Event("submit"));
    }
  }
});

// Welcome message function
function displayWelcomeMessage() {
  const welcomeMessage = `# Welcome to PenTest AI

This tool provides ethical hacking guidance for security professionals.

**Important Notes:**
- Always obtain proper authorization before testing any system
- This tool is for educational purposes only
- Use this knowledge responsibly and legally

**Example Commands:**
Type your ethical hacking question or ask for commands related to:
- Reconnaissance and information gathering
- Network scanning and enumeration
- Vulnerability assessment
- Security tool usage in Kali Linux`;

  appendMessage(welcomeMessage, "bot");
}

function appendMessage(text, sender = "bot", modelInfo = null) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", sender);

  // Create unique ID for each message for potential reference
  const messageId = `msg-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  messageEl.id = messageId;

  if (sender === "bot") {
    // Add model info banner if available
    if (modelInfo) {
      const modelBanner = document.createElement("div");
      modelBanner.classList.add("model-banner");
      modelBanner.innerHTML = `<span class="model-indicator">Using: ${modelInfo.displayName}</span>`;
      messageEl.appendChild(modelBanner);
    }

    // Add the message content
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("message-content");

    try {
      contentDiv.innerHTML = marked.parse(text);
    } catch (error) {
      console.error("Markdown parsing error:", error);
      contentDiv.textContent = text; // Fallback to plain text if markdown parsing fails
    }

    messageEl.appendChild(contentDiv);

    // Process code blocks after adding to DOM
    setTimeout(() => {
      // Add copy functionality to code blocks
      messageEl.querySelectorAll(".code-block").forEach((block) => {
        // Create copy button if it doesn't exist
        if (!block.querySelector(".copy-button")) {
          const header = block.querySelector(".code-header");
          const copyBtn = document.createElement("button");
          copyBtn.className = "copy-button";
          copyBtn.textContent = "Copy";
          header.appendChild(copyBtn);
        }

        // Add event listener to copy button
        block.querySelector(".copy-button").addEventListener("click", () => {
          const codeBlock = block.querySelector("code");
          navigator.clipboard.writeText(codeBlock.textContent);
          const copyButton = block.querySelector(".copy-button");
          copyButton.textContent = "Copied!";
          copyButton.classList.add("copied");
          setTimeout(() => {
            copyButton.textContent = "Copy";
            copyButton.classList.remove("copied");
          }, 2000);
        });
      });

      // Apply syntax highlighting
      messageEl.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }, 0);
  } else {
    messageEl.textContent = text;
  }

  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  return messageId; // Return message ID for potential reference
}

// Updated loading indicator
function setLoading(isLoading) {
  if (isLoading) {
    sendButton.disabled = true;
    sendButton.innerHTML = '<div class="loader"></div>';

    const loadingMessage = document.createElement("div");
    loadingMessage.classList.add("message", "bot", "loading");
    loadingMessage.innerHTML =
      '<div class="thinking-dots"><span>.</span><span>.</span><span>.</span></div>';
    loadingMessage.id = "loading-message";
    chatContainer.appendChild(loadingMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    sendButton.disabled = false;
    sendButton.textContent = "Send";

    const loadingMessage = document.getElementById("loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }
}

// Enhanced error handling
function handleApiError(error, selectedModel) {
  console.error("API Error:", error);

  let errorMessage =
    "The AI model is currently unavailable. Please try again later or select a different model.";

  // Check for specific error messages from the backend
  if (error.includes("timeout") || error.includes("long")) {
    errorMessage = "⏱️ " + error;
  } else if (error.includes("Authentication")) {
    errorMessage = "🔑 " + error;
  } else if (error.includes("Rate limit")) {
    errorMessage = "⚠️ " + error;
  } else if (error.includes("service is currently experiencing issues")) {
    errorMessage = "🛠️ " + error;
  }

  // If we detect multiple failures, provide more helpful guidance
  if (connectionIssues) {
    errorMessage +=
      "\n\n**Troubleshooting Steps:**\n1. Try refreshing the page\n2. Try a different model\n3. Wait a few minutes and try again";
  }

  const modelInfo = {
    displayName: getModelDisplayName(selectedModel),
  };

  return appendMessage(errorMessage, "bot", modelInfo);
}

function getModelDisplayName(modelId) {
  return AVAILABLE_MODELS[modelId]?.name || modelId || "Unknown Model";
}

// Model preference handling
function saveModelPreference(modelId) {
  localStorage.setItem("preferred-model", modelId);
}

function loadModelPreference() {
  const savedModel = localStorage.getItem("preferred-model");
  if (savedModel && modelSelect) {
    modelSelect.value = savedModel;
  }
}

// Define models to match the backend
const AVAILABLE_MODELS = {
  gpt4: { name: "GPT-4o (OpenAI)" },
  "llama-3.3": { name: "Llama 3.3 (Meta)" },
  phi4: { name: "Phi-4 (Microsoft)" },
  "llama-3.1": { name: "Llama 3.1 (Meta)" },
  deepseek: { name: "DeepSeek" },
};

// Enhanced chat form submission with throttling and better error handling
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentTime = Date.now();
  if (currentTime - lastRequestTime < MIN_REQUEST_INTERVAL) {
    console.log("Throttling request - too many requests");
    return;
  }

  lastRequestTime = currentTime;

  const userMessage = chatInput.value.trim();
  const selectedModel = modelSelect.value;

  if (!userMessage || sendButton.disabled) return;

  // Append user message
  const userMessageId = appendMessage(userMessage, "user");
  chatInput.value = "";

  // Show loading indicator
  setLoading(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        model: selectedModel,
      }),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(120000), // 2 minute timeout
    });

    // Remove loading indicator
    setLoading(false);

    // Handle response
    if (!response.ok) {
      connectionIssues = true;
      let errorText = "Server Error";

      try {
        const errorData = await response.json();
        errorText =
          errorData.error || `Error ${response.status}: ${response.statusText}`;
      } catch (e) {
        errorText = `Error ${response.status}: ${response.statusText}`;
      }

      handleApiError(errorText, selectedModel);
      return;
    }

    // Parse successful response
    const data = await response.json();
    connectionIssues = false; // Reset connection issues flag on success

    if (data.error) {
      handleApiError(data.error, selectedModel);
    } else {
      appendMessage(data.response, "bot", data.model);
    }
  } catch (error) {
    // Remove loading indicator
    setLoading(false);
    connectionIssues = true;

    console.error("Fetch error:", error);

    // Handle different error types
    let errorMessage =
      "Network error. Please check your connection and try again.";
    if (error.name === "AbortError") {
      errorMessage = "Request timed out. The server took too long to respond.";
    }

    handleApiError(errorMessage, selectedModel);
  }
});

// Add model change event listener to save preference
modelSelect.addEventListener("change", (e) => {
  saveModelPreference(e.target.value);
});

// Set focus to input on page load
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    chatInput.focus();
  }, 500);
});

// Retry mechanism for errors
window.addEventListener("online", () => {
  if (connectionIssues) {
    appendMessage(
      "Your internet connection has been restored. You can try sending your message again.",
      "bot"
    );
    connectionIssues = false;
  }
});
