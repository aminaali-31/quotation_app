require('dotenv').config();
const express = require('express');
const db = require('./config/db');

const app = express();

app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send("Quotation App is Running");
});

// Example DB test route
app.get('/test-db', (req, res) => {
  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.json(results);
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});