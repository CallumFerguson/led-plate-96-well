import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
const PORT = 3000;

// Parse JSON bodies
app.use(express.json());

// Example API route
app.post("/api/upload-sketch", (req, res) => {
  res.json({ message: "Hello from Express 👋" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
