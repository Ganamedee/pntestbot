require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const chatController = require("./controllers/chatController");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json({ limit: "1mb" })); // Increased limit for larger payloads
app.use(express.static(path.join(__dirname, "public")));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
    time: new Date().toISOString(),
  });
});

// Routes
app.post("/api/chat", chatController.handleChat);
app.get("/api/models", chatController.getAvailableModels);
app.get("/api/status", chatController.getApiStatus); // API status endpoint

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "production",
  });
});

// Serve index.html for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server if not being imported
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "production"}`);

    // Check if API key is configured
    if (!process.env.GITHUB_TOKEN) {
      console.warn("WARNING: GITHUB_TOKEN environment variable is not set!");
    } else {
      console.log("GitHub token is configured");
    }
  });
}

// Export for Vercel
module.exports = app;
