const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Server } = require("socket.io");
const http = require("http");
const pool = require("./config/database");
const bcrypt = require("bcrypt");
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

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username.toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json({ 
      success: true, 
      message: "Login successful",
      username: user.username
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Register endpoint
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if username already exists
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [username.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    await pool.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username.toLowerCase(), hashedPassword]
    );

    res.json({ 
      success: true, 
      message: "Registration successful",
      username: username.toLowerCase()
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

io.on("connection", async (socket) => {
  console.log("User connected:", socket.id);

  socket.on("register", async (username) => {
    try {
      const [existingUser] = await pool.query(
        "SELECT * FROM users WHERE username = ?",
        [username.toLowerCase()]
      );

      if (existingUser.length > 0) {
        // Update existing user's socket_id
        await pool.query(
          "UPDATE users SET socket_id = ? WHERE username = ?",
          [socket.id, username.toLowerCase()]
        );
      }
      console.log(`Registered ${username} with socket ID ${socket.id}`);
    } catch (error) {
      console.error("Error registering user:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    try {
      await pool.query(
        "UPDATE users SET socket_id = NULL WHERE socket_id = ?",
        [socket.id]
      );
    } catch (error) {
      console.error("Error handling disconnect:", error);
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

    // Check if recipient exists and is online
    const [recipientUser] = await pool.query(
      "SELECT * FROM users WHERE username = ? AND socket_id IS NOT NULL",
      [recipient]
    );

    if (recipientUser.length === 0) {
      return res.status(404).json({ error: "Recipient not connected" });
    }

    if (isEdit && originalMessageId) {
      console.log("Processing edit for message:", originalMessageId);
      
      // Update message in database
      await pool.query(
        "UPDATE messages SET message = ?, is_edited = TRUE WHERE id = ?",
        [message, originalMessageId]
      );

      // Send update to recipient
      io.to(recipientUser[0].socket_id).emit("update_message", {
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
    }

    // Handle new message
    const messageId = `${from.toLowerCase()}-${recipient}-${Date.now()}`;
    
    // Store message in database
    await pool.query(
      "INSERT INTO messages (id, sender, recipient, message) VALUES (?, ?, ?, ?)",
      [messageId, from.toLowerCase(), recipient, message]
    );

    // Send new message to recipient
    io.to(recipientUser[0].socket_id).emit("receive_message", {
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
