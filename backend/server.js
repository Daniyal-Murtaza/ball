const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins during development
  },
});

app.use(cors());
app.use(express.json());

const CONTACTS = {}; // Store { username: { socketId } }
const MESSAGE_HISTORY = {}; // Store { recipient: { messageId: { from, message, socketId } } }

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", (username) => {
    CONTACTS[username.toLowerCase()] = { socketId: socket.id };
    console.log(`Registered ${username} with socket ID ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const user in CONTACTS) {
      if (CONTACTS[user].socketId === socket.id) {
        delete CONTACTS[user];
      }
    }
  });
});

app.post("/api/send-message", async (req, res) => {
  const { text, from, isEdit = false, originalMessageId } = req.body;
  console.log("Received message request:", { text, from, isEdit, originalMessageId });

  try {
    const hfRes = await axios.post(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        inputs: text,
        parameters: {
          candidate_labels: ["send message", "hello", "ask question"]
        }
      },
      {
        headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` }
      }
    );

    const labels = hfRes.data.labels || [];
    const scores = hfRes.data.scores || [];

    const intentIndex = labels.findIndex(label => label.toLowerCase() === "send message");
    const confidence = intentIndex >= 0 ? scores[intentIndex] : 0;

    const topLabel = labels[0].toLowerCase();
    const topScore = scores[0];

    if (!(
      (topLabel === "send message" && topScore > 0.4) ||
      (confidence > 0.4)
    )) {
      return res.status(400).json({ error: "Intent not recognized as messaging" });
    }

    const match = text.match(/send\s+["']?(.+?)["']?\s+to\s+(\w+)/i);
    if (!match) return res.status(400).json({ error: "Could not extract message and recipient" });

    const message = match[1];
    const recipient = match[2].toLowerCase();
    const conversationKey = `${from.toLowerCase()}-${recipient}`;

    const recipientContact = CONTACTS[recipient];
    if (!recipientContact || !recipientContact.socketId) {
      return res.status(404).json({ error: "Recipient not connected" });
    }

    // Initialize message history for recipient if it doesn't exist
    if (!MESSAGE_HISTORY[recipient]) {
      MESSAGE_HISTORY[recipient] = {};
    }

    if (isEdit && originalMessageId) {
      console.log("Processing edit for message:", originalMessageId);
      // Handle message edit
      if (MESSAGE_HISTORY[recipient][originalMessageId]) {
        // Update the existing message
        MESSAGE_HISTORY[recipient][originalMessageId] = {
          from,
          message,
          socketId: recipientContact.socketId,
          timestamp: Date.now()
        };

        // Send update to recipient
        io.to(recipientContact.socketId).emit("update_message", {
          messageId: originalMessageId,
          from,
          message,
          timestamp: Date.now()
        });

        return res.json({ 
          success: true, 
          message: "Message updated!",
          messageId: originalMessageId
        });
      } else {
        console.log("Message not found for edit:", originalMessageId);
        return res.status(404).json({ error: "Message not found for editing" });
      }
    }

    // Handle new message
    const messageId = `${conversationKey}-${Date.now()}`;
    console.log("Creating new message with ID:", messageId);
    
    // Store the new message
    MESSAGE_HISTORY[recipient][messageId] = {
      from,
      message,
      socketId: recipientContact.socketId,
      timestamp: Date.now()
    };

    // Send new message to recipient
    io.to(recipientContact.socketId).emit("receive_message", {
      from,
      message,
      messageId,
      timestamp: Date.now()
    });

    return res.json({ 
      success: true, 
      message: "Message sent!",
      messageId
    });

  } catch (err) {
    console.error("Error processing message:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
