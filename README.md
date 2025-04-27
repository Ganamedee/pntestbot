# PenTestAI: Ethical Hacking Assistant

PenTestAI is an AI-powered chatbot specifically tailored to assist cybersecurity professionals and students with **ethical hacking** methodologies, focusing on Kali Linux tools and secure testing practices.

**Disclaimer:** This tool is for **educational and authorized ethical use ONLY**. Unauthorized system access or malicious use is illegal and unethical. Always secure explicit permission before conducting any security tests.

**Live Demo:** [https://pentestai.vercel.app](https://pentestai.vercel.app)

## What it Does

PenTestAI acts as an intelligent assistant for your penetration testing workflow. By leveraging advanced AI models (like GPT-4o, Llama 3.1, Phi-4, DeepSeek) via the GitHub/Azure AI Inference API, it provides contextually relevant information, command examples, and explanations for various security tools and techniques, all while emphasizing ethical conduct.

## Key Features

*   **Ethical Focus:** AI is guided by a system prompt that prioritizes legal and ethical hacking practices.
*   **Multiple AI Models:** Choose from leading LLMs (GPT-4o, Llama 3.1, Phi-4, DeepSeek) to get different perspectives or capabilities.
*   **Kali Linux Command Assistance:** Get specific commands and usage examples for tools commonly found in Kali Linux.
*   **Formatted Responses:** AI answers are rendered using Markdown for clarity, including formatted code blocks, lists, and tables.
*   **Syntax Highlighting:** Code snippets are automatically highlighted for improved readability (`highlight.js`).
*   **Copy-to-Clipboard:** Easily copy commands or code with a single click.
*   **API Status & Rate Limit Info:** Monitor the backend AI service availability and view GitHub API rate limit details.
*   **Connection Monitoring:** Indicates if the connection to the backend server is stable.
*   **Ethical Guardrails:** The AI is instructed to decline requests that are potentially harmful or illegal.

## How it Works

*   **Backend:** A Node.js server using Express handles API requests to the AI models.
*   **AI Integration:** Uses the Azure AI Inference SDK (`@azure-rest/ai-inference`) to communicate with various models hosted via the GitHub/Azure endpoint, using a GitHub token for authentication. Axios is used for rate limit checks.
*   **Frontend:** The chat interface is built with HTML, CSS, and vanilla JavaScript.
*   **Response Handling:** `marked.js` and `highlight.js` are used to render the AI's Markdown responses attractively in the browser.