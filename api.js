// =====================================================================
// api.js - API Module for Bot Integration
// =====================================================================

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Keys storage
const apiKeysFile = path.join(__dirname, "storage", "api_keys.json");

// Initialize API keys file if not exists
if (!fs.existsSync(apiKeysFile)) {
  fs.writeFileSync(apiKeysFile, JSON.stringify({ keys: [] }, null, 2));
}

// Load API keys
function loadAPIKeys() {
  try {
    return JSON.parse(fs.readFileSync(apiKeysFile, "utf8"));
  } catch (err) {
    return { keys: [] };
  }
}

// Save API keys
function saveAPIKeys(data) {
  try {
    fs.writeFileSync(apiKeysFile, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("Error saving API keys:", err);
    return false;
  }
}

// Generate API key
function generateAPIKey() {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}

// =====================================================================
// API Endpoints
// =====================================================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Bug Bot API is running" });
});

// Documentation
app.get("/api/docs", (req, res) => {
  res.json({
    name: "Bug Bot API",
    version: "1.0.0",
    description: "API for integrating with other bots",
    endpoints: {
      "GET /api/health": "Check API health",
      "POST /api/connect": "Connect to another bot",
      "POST /api/disconnect": "Disconnect from another bot",
      "GET /api/connections": "Get all connections",
      "POST /api/command": "Send command to connected bot",
      "POST /api/message": "Send message to connected bot",
      "GET /api/status": "Get bot status",
      "POST /api/key/generate": "Generate new API key",
      "DELETE /api/key": "Delete API key",
      "POST /api/webhook": "Webhook endpoint for receiving messages"
    }
  });
});

// Connect to another bot
app.post("/api/connect", async (req, res) => {
  try {
    const { botToken, botName, type } = req.body;

    if (!botToken || !botName) {
      return res.status(400).json({
        success: false,
        error: "botToken and botName are required"
      });
    }

    // Test connection
    try {
      const response = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
      
      if (response.status === 200) {
        const botInfo = response.data;
        
        // Save connection
        const connections = loadAPIKeys();
        connections.connections = connections.connections || [];
        
        connections.connections.push({
          id: generateAPIKey(),
          botToken,
          botName,
          type: type || "telegram",
          botInfo,
          connectedAt: new Date().toISOString(),
          status: "connected"
        });

        saveAPIKeys(connections);

        return res.json({
          success: true,
          message: "Successfully connected to bot",
          connectionId: connections.connections[connections.connections.length - 1].id
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Failed to connect to bot: " + err.message
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Disconnect from bot
app.post("/api/disconnect", async (req, res) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({
        success: false,
        error: "connectionId is required"
      });
    }

    const connections = loadAPIKeys();
    const updatedConnections = connections.connections.filter(c => c.id !== connectionId);

    connections.connections = updatedConnections;
    saveAPIKeys(connections);

    return res.json({
      success: true,
      message: "Successfully disconnected from bot"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Get all connections
app.get("/api/connections", (req, res) => {
  try {
    const connections = loadAPIKeys();
    return res.json({
      success: true,
      connections: connections.connections || []
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Send command to connected bot
app.post("/api/command", async (req, res) => {
  try {
    const { connectionId, command, chatId } = req.body;

    if (!connectionId || !command || !chatId) {
      return res.status(400).json({
        success: false,
        error: "connectionId, command, and chatId are required"
      });
    }

    const connections = loadAPIKeys();
    const connection = connections.connections.find(c => c.id === connectionId);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Connection not found"
      });
    }

    // Send command
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${connection.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: command
        }
      );

      return res.json({
        success: true,
        message: "Command sent successfully",
        response: response.data
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Failed to send command: " + err.message
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Send message to connected bot
app.post("/api/message", async (req, res) => {
  try {
    const { connectionId, message, chatId } = req.body;

    if (!connectionId || !message || !chatId) {
      return res.status(400).json({
        success: false,
        error: "connectionId, message, and chatId are required"
      });
    }

    const connections = loadAPIKeys();
    const connection = connections.connections.find(c => c.id === connectionId);

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: "Connection not found"
      });
    }

    // Send message
    try {
      const response = await axios.post(
        `https://api.telegram.org/bot${connection.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: message
        }
      );

      return res.json({
        success: true,
        message: "Message sent successfully",
        response: response.data
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: "Failed to send message: " + err.message
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Get bot status
app.get("/api/status", (req, res) => {
  try {
    const connections = loadAPIKeys();
    return res.json({
      success: true,
      totalConnections: connections.connections?.length || 0,
      connections: connections.connections || []
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Generate new API key
app.post("/api/key/generate", (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: "name is required"
      });
    }

    const apiKey = generateAPIKey();
    const keys = loadAPIKeys();
    keys.keys = keys.keys || [];

    keys.keys.push({
      id: generateAPIKey(),
      name,
      key: apiKey,
      createdAt: new Date().toISOString()
    });

    saveAPIKeys(keys);

    return res.json({
      success: true,
      message: "API key generated successfully",
      apiKey
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Delete API key
app.delete("/api/key", (req, res) => {
  try {
    const { keyId } = req.body;

    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: "keyId is required"
      });
    }

    const keys = loadAPIKeys();
    keys.keys = keys.keys.filter(k => k.id !== keyId);

    saveAPIKeys(keys);

    return res.json({
      success: true,
      message: "API key deleted successfully"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Webhook endpoint
app.post("/api/webhook", (req, res) => {
  try {
    const { event, data } = req.body;

    if (!event) {
      return res.status(400).json({
        success: false,
        error: "event is required"
      });
    }

    // Process webhook
    console.log("Webhook received:", { event, data });

    return res.json({
      success: true,
      message: "Webhook processed successfully"
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Internal server error: " + err.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Bug Bot API is running on port ${PORT}`);
});

// Export for use in other modules
module.exports = { app, generateAPIKey, loadAPIKeys, saveAPIKeys };