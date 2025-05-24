import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import "./Ball.css";

const socket = io("http://localhost:5000");

function App() {
  const [username, setUsername] = useState("");
  const [registered, setRegistered] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Click the ball and speak...");
  const [chat, setChat] = useState([]);

  useEffect(() => {
    if (registered) {
      socket.emit("register", username);
      socket.on("receive_message", (data) => {
        setChat((prev) => [...prev, `${data.from}: ${data.message}`]);
      });
      return () => socket.off("receive_message");
    }
  }, [registered, username]);

  const handleVoiceInput = () => {
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setMessage(text);
      setStatus("Processing...");

      try {
        const res = await fetch("http://localhost:5000/api/send-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, from: username }),
        });

        const data = await res.json();
        if (data.success) {
          setStatus("✅ Message Sent!");
          setChat((prev) => [...prev, `You: ${text}`]);
        } else {
          setStatus("❌ " + data.error);
        }
      } catch (err) {
        setStatus("❌ Failed to contact server.");
      }
    };

    recognition.onerror = () => setStatus("❌ Voice recognition failed");
  };

  if (!registered) {
    return (
      <div className="container">
        <h2>Enter your username:</h2>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase())}
          placeholder="Type here.."
        />
        <button onClick={() => setRegistered(true)} disabled={!username.trim()}>
          Register
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>Logged in as: {username}</h2>
      <div className="ball" onClick={handleVoiceInput}></div>
      <p className="status">{status}</p>
      <p className="spoken-text">{message}</p>
      <div className="chat-window">
        {chat.map((msg, idx) => (
          <p key={idx}>{msg}</p>
        ))}
      </div>
    </div>
  );
}

export default App;
