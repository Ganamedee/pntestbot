require("dotenv").config();
const express = require("express");
const { exec } = require("child_process");
const bodyParser = require("body-parser");
const chatController = require("./controllers/chatController");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

// Chat endpoint
app.post("/api/chat", chatController.handleChat);

// Endpoint to execute shell commands (WARNING: This is extremely dangerous in production)
app.post("/api/execute", (req, res) => {
  const command = req.body.command;
  if (!command) return res.status(400).send("No command provided.");

  // SECURITY WARNING: Executing shell commands based on user input can lead to severe vulnerabilities.
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Execution error: ${error}`);
      return res.status(500).send(stderr);
    }
    res.send(stdout);
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
