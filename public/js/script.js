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

      // No copy button, just a code block
      return `<div class=\"code-block\" tabindex=\"0\" data-language=\"${language || ''}\">\n      <div class=\"code-header\">${language ? `<span class=\"code-language\">${language}</span>` : ""}</div>\n      <pre><code class=\"language-${language || "text"}\">${escapedCode}</code></pre>\n    </div>`;
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

// Connection status tracking
let connectionIssues = false;
let lastRequestTime = 0;
let retryCount = 0;
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds to prevent rapid successive requests

// Persistent chat history for context
let chatHistory = [];

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
  const welcomeMessage = `
<div class="welcome-message">
  <h1>Welcome to PenTest AI</h1>
  <p><strong>PenTest AI</strong> is your friendly assistant for learning and using <strong>Kali Linux</strong> tools and ethical hacking techniques.</p>
  <ul>
    <li>Ask for explanations or examples of Kali Linux commands and tools.</li>
    <li>Get step-by-step guidance for penetration testing and security research.</li>
    <li>All advice is for <strong>authorized, ethical, and educational</strong> purposes only.</li>
  </ul>
  <p style="margin-top:1rem; color:#10b981;"><strong>Type your question below to get started!</strong></p>
</div>
`;
  appendMessage(welcomeMessage, "bot");
}

// Debug logging function
function debugLog(message, data = null) {
  if (window.debugMode) {
    console.log(`[PenTestAI] ${message}`);
    if (data) {
      console.log(`[PenTestAI] Data:`, data);
    }
  }
}

function appendMessage(text, sender = "bot") {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", sender);

  // Create unique ID for each message for potential reference
  const messageId = `msg-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 5)}`;
  messageEl.id = messageId;

  if (sender === "bot") {
    // Check if this is an error message and add error class if so
    if (
      text.includes("error") ||
      text.includes("unavailable") ||
      text.includes("⚠️") ||
      text.includes("⏱️") ||
      text.includes("🔑")
    ) {
      messageEl.classList.add("error");
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

    // Add retry button for error messages
    if (messageEl.classList.contains("error")) {
      const retryButton = document.createElement("button");
      retryButton.className = "retry-button";
      retryButton.innerHTML = "Try Again";
      retryButton.addEventListener("click", retryLastRequest);
      contentDiv.appendChild(retryButton);
    }

    // Process code blocks after adding to DOM
    setTimeout(() => {
      // Add copy functionality to code blocks (no button)
      messageEl.querySelectorAll(".code-block").forEach((block) => {
        const codeBlock = block.querySelector("code");
        // Helper to copy code and show feedback
        function copyCode() {
          navigator.clipboard.writeText(codeBlock.textContent);
          // Show a temporary overlay or feedback
          let feedback = block.querySelector('.copy-feedback');
          if (!feedback) {
            feedback = document.createElement('div');
            feedback.className = 'copy-feedback';
            feedback.textContent = 'Copied!';
            block.appendChild(feedback);
          }
          feedback.style.display = 'block';
          setTimeout(() => {
            feedback.style.display = 'none';
          }, 1500);
        }
        // Click anywhere in code block copies code
        block.addEventListener("click", copyCode);
        // Keyboard accessibility
        block.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            copyCode();
          }
        });
      });

      // Apply syntax highlighting
      messageEl.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }, 0);
  } else {
    messageEl.textContent = text;

    // Store last user message for retry functionality
    window.lastUserMessage = text;
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
function handleApiError(error) {
  debugLog("API Error:", error);

  let errorMessage =
    "The AI model is currently unavailable. Please try again later.";

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
      "\n\n**Troubleshooting Steps:**\n1. Try refreshing the page\n2. Wait a few minutes and try again";
  }

  // If we've retried too many times, suggest different remedies
  if (retryCount >= 3) {
    errorMessage +=
      "\n\n**Multiple retries failed. You might want to:**\n- Try a simpler or shorter query\n- Check if your question follows ethical guidelines\n- Try again later when the service might be more available";
  }

  return appendMessage(errorMessage, "bot");
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

// Enable debug mode via URL parameter
if (window.location.search.includes("debug=true")) {
  window.debugMode = true;
  console.log("[PenTestAI] Debug mode enabled");
}

// Enhanced chat form submission with throttling and better error handling
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentTime = Date.now();
  if (currentTime - lastRequestTime < MIN_REQUEST_INTERVAL) {
    debugLog("Throttling request - too many requests");
    return;
  }

  lastRequestTime = currentTime;

  const userMessage = chatInput.value.trim();
  if (!userMessage || sendButton.disabled) return;

  // Append user message visually
  appendMessage(userMessage, "user");
  chatInput.value = "";

  // Add user message to chat history
  chatHistory.push({ role: "user", content: userMessage });

  // Show loading indicator
  setLoading(true);

  // Store this message for potential retry
  window.lastUserMessage = userMessage;

  debugLog(`Sending chat request`);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history: chatHistory.slice(0, -1) }), // Exclude the just-added user message
      signal: AbortSignal.timeout(150000),
    });

    setLoading(false);

    if (!response.ok) {
      connectionIssues = true;
      let errorText = "Server Error";
      try {
        const errorData = await response.json();
        errorText = errorData.error || `Error ${response.status}: ${response.statusText}`;
        debugLog("Error response data:", errorData);
      } catch (e) {
        errorText = `Error ${response.status}: ${response.statusText}`;
        debugLog("Failed to parse error response", e);
      }
      handleApiError(errorText);
      // Remove the last user message from chatHistory if error
      chatHistory.pop();
      return;
    }

    const data = await response.json();
    connectionIssues = false;
    retryCount = 0;
    debugLog("Received successful response", data);
    if (data.error) {
      handleApiError(data.error);
    } else {
      appendMessage(data.response, "bot");
      // Add assistant message to chat history
      chatHistory.push({ role: "assistant", content: data.response });
    }
  } catch (error) {
    setLoading(false);
    connectionIssues = true;
    let errorMessage = "Network error. Please check your connection and try again.";
    if (error.name === "AbortError") {
      errorMessage = "Request timed out. The server took too long to respond.";
    }
    handleApiError(errorMessage);
    // Remove the last user message from chatHistory if error
    chatHistory.pop();
  }
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

// Add network error detection
window.addEventListener("error", (event) => {
  if (event.target.tagName === "SCRIPT" || event.target.tagName === "LINK") {
    debugLog("Resource error detected", {
      resource: event.target.src || event.target.href,
      type: event.target.tagName,
    });
    connectionIssues = true;
  }
});
