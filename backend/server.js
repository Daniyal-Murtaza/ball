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
  const { text, from } = req.body;

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

    const recipientContact = CONTACTS[recipient];
    if (!recipientContact || !recipientContact.socketId) {
      return res.status(404).json({ error: "Recipient not connected" });
    }

    io.to(recipientContact.socketId).emit("receive_message", {
      from,
      message
    });

    return res.json({ success: true, message: "Message sent via WebSocket!" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
