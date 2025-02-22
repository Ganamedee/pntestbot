// Initialize marked with options after it's loaded
window.onload = function () {
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    sanitize: false,
  });

  // Custom renderer
  const renderer = {
    code(code, language) {
      return `<div class="code-block">
        <div class="code-header">
          ${language ? `<span class="code-language">${language}</span>` : ""}
          <button class="copy-button">Copy</button>
        </div>
        <pre><code class="language-${language || "text"}">${code}</code></pre>
      </div>`;
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
  };

  marked.use({ renderer });
};

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatContainer = document.getElementById("chat-container");
const sendButton = document.getElementById("sendChat");
const modelSelect = document.getElementById("model-select");

// Enter key handling
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (chatInput.value.trim()) {
      chatForm.dispatchEvent(new Event("submit"));
    }
  }
});

function appendMessage(text, sender = "bot", modelInfo = null) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", sender);

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
    contentDiv.innerHTML = marked.parse(text);
    messageEl.appendChild(contentDiv);

    // Add copy functionality to code blocks
    messageEl.querySelectorAll(".copy-button").forEach((button) => {
      button.addEventListener("click", () => {
        const codeBlock = button.closest(".code-block").querySelector("code");
        navigator.clipboard.writeText(codeBlock.textContent);
        button.textContent = "Copied!";
        button.classList.add("copied");
        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("copied");
        }, 2000);
      });
    });

    // Apply syntax highlighting
    messageEl.querySelectorAll("pre code").forEach((block) => {
      hljs.highlightElement(block);
    });
  } else {
    messageEl.textContent = text;
  }

  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

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
    if (loadingMessage) loadingMessage.remove();
  }
}

// Chat form submission with model selection
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userMessage = chatInput.value.trim();
  const selectedModel = modelSelect.value;

  if (!userMessage) return;

  appendMessage(userMessage, "user");
  chatInput.value = "";
  setLoading(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        model: selectedModel,
      }),
    });

    const data = await response.json();
    setLoading(false);

    if (data.error) {
      appendMessage(`Error: ${data.error}`, "bot");
    } else {
      // Log model information for debugging
      console.log("Model debug info:", data.model);
      appendMessage(data.response, "bot", data.model);
    }
  } catch (error) {
    console.error("Fetch error:", error);
    setLoading(false);
    appendMessage("Error: Unable to fetch response.", "bot");
  }
});

// Add model change event listener to save preference
modelSelect.addEventListener("change", (e) => {
  localStorage.setItem("preferred-model", e.target.value);
});

// Load preferred model on startup
const savedModel = localStorage.getItem("preferred-model");
if (savedModel) {
  modelSelect.value = savedModel;
}
