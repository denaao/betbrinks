const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// Serve preview.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'preview.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile preview running on port ${PORT}`);
});
