require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

const HUGGINGFACE_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;

app.post("/parse", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const prompt = `
Extract the recipient and message from this command:
"${text}"

Format as JSON with keys "recipient" and "message".
If not clear, respond with "error" key and message.
`;

    const response = await axios.post(
      "https://api-inference.huggingface.co/models/google/flan-t5-small",
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${HUGGINGFACE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const output = response.data[0]?.generated_text || response.data.generated_text;
    let json;
    try {
      json = JSON.parse(output);
    } catch {
      return res.json({ error: "Invalid JSON", raw: output });
    }

    res.json({ parsed: json });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
});
