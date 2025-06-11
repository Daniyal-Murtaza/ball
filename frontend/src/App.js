import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./Ball.css";

const socket = io("http://localhost:5000");

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [registered, setRegistered] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [chat, setChat] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isSelectingRecipient, setIsSelectingRecipient] = useState(true);

  useEffect(() => {
    if (registered) {
      socket.emit("register", username);
      
      socket.on("receive_message", (data) => {
        console.log("Received message:", data);
        setChat(prev => [...prev, { 
          text: `${data.from}: ${data.message}`,
          recipient: data.from,
          messageId: data.messageId
        }]);
      });

      socket.on("update_message", (data) => {
        console.log("Received message update:", data);
        setChat(prev => {
          const updatedChat = prev.map(msg => {
            if (msg.messageId === data.messageId) {
              return {
                ...msg,
                text: `${data.from}: ${data.message}`,
                recipient: data.from
              };
            }
            return msg;
          });
          return updatedChat;
        });
      });

      return () => {
        socket.off("receive_message");
        socket.off("update_message");
      };
    }
  }, [registered, username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? "/api/login" : "/api/register";
    
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      
      if (data.success) {
        setRegistered(true);
        setStatus("hold the ball and say a name...");
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (err) {
      setStatus("❌ Failed to contact server.");
    }
  };

  const handleVoiceInput = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setMessage(text);
      setStatus("Processing...");

      if (isSelectingRecipient) {
        // Handle recipient selection
        const recipient = text.trim().toLowerCase();
        setSelectedRecipient(recipient);
        setIsSelectingRecipient(false);
        setStatus(`✅ Connected to ${recipient}. Click the ball to send a message.`);
        return;
      }

      try {
        const res = await fetch("http://localhost:5000/api/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            text: `send ${text} to ${selectedRecipient}`,
            from: username 
          }),
        });

        const data = await res.json();
        if (data.success) {
          setStatus("✅ Message Sent!");
          setChat(prev => [...prev, { 
            text: `You: ${text}`,
            recipient: selectedRecipient,
            messageId: data.messageId
          }]);
        } else {
          setStatus("❌ " + data.error);
        }
      } catch (err) {
        setStatus("❌ Failed to contact server.");
      }
    };

    recognition.onerror = () => setStatus("❌ Voice recognition failed");
  };

  const handleEditLastMessage = () => {
    const lastMessageIndex = chat.length - 1;
    if (lastMessageIndex >= 0 && chat[lastMessageIndex].text.startsWith("You:")) {
      const messageContent = chat[lastMessageIndex].text.replace("You: ", "");
      setEditText(messageContent);
      setEditingIndex(lastMessageIndex);
      setIsEditing(true);
    }
  };

  const handleEditSubmit = async () => {
    if (!editText.trim()) return;

    try {
      const originalMessage = chat[editingIndex];
      console.log("Editing message:", originalMessage);

      if (!originalMessage.recipient) {
        setStatus("❌ Could not find recipient information");
        return;
      }

      const res = await fetch("http://localhost:5000/api/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: `send ${editText} to ${originalMessage.recipient}`,
          from: username,
          isEdit: true,
          originalMessageId: originalMessage.messageId
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("✅ Message Edited!");
        setChat(prev => {
          const newChat = [...prev];
          newChat[editingIndex] = {
            ...originalMessage,
            text: `You: ${editText}`
          };
          return newChat;
        });
        setIsEditing(false);
        setEditingIndex(null);
        setEditText("");
      } else {
        setStatus("❌ " + data.error);
      }
    } catch (err) {
      console.error("Edit error:", err);
      setStatus("❌ Failed to contact server.");
    }
  };

  const handleChangeRecipient = () => {
    setIsSelectingRecipient(true);
    setSelectedRecipient(null);
    setStatus("Click the ball and say the recipient's name...");
  };

  if (!registered) {
    return (
      <div className="container">
        <h2>{isLogin ? "Login" : "Register"}</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="Username"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
          <button type="submit" disabled={!username.trim() || !password.trim()}>
            {isLogin ? "Login" : "Register"}
          </button>
          <button 
            type="button" 
            className="switch-auth"
            onClick={() => {
              setIsLogin(!isLogin);
              setStatus("");
            }}
          >
            {isLogin ? "Need an account? Register" : "Have an account? Login"}
          </button>
        </form>
        <p className="status">{status}</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Logged in as: {username}</h2>
      <div className="ball" onClick={handleVoiceInput}>
        {selectedRecipient && !isSelectingRecipient && (
          <div className="recipient-name">{selectedRecipient}</div>
        )}
      </div>
      <p className="status">{status}</p>
      <p className="spoken-text">{message}</p>
      {selectedRecipient && !isSelectingRecipient && (
        <button className="change-recipient" onClick={handleChangeRecipient}>
          Change Recipient
        </button>
      )}
      {chat.length > 0 && chat[chat.length - 1].text.startsWith("You:") && (
        <button 
          className="edit-button"
          onClick={handleEditLastMessage}
          disabled={isEditing}
        >
          Edit Last Message
        </button>
      )}
      {isEditing && (
        <div className="edit-container">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="edit-input"
            placeholder="Edit your message..."
          />
          <div className="edit-buttons">
            <button onClick={handleEditSubmit} className="save-button">
              Save
            </button>
            <button 
              onClick={() => {
                setIsEditing(false);
                setEditingIndex(null);
                setEditText("");
              }} 
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className="chat-window">
        {chat.map((msg, idx) => {
          const isSent = msg.text.startsWith("You:");
          return (
            <p key={idx} className={`message ${isSent ? 'sent' : 'received'}`}>
              {msg.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default App;
