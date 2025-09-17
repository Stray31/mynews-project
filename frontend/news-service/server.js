// news-service/server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWSAPI_BASE = 'https://newsapi.org/v2';

// GET /news?q=keyword&page=1&pageSize=12
app.get('/news', async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(50, parseInt(req.query.pageSize) || 12);

    let url, params;
    if (q) {
      url = `${NEWSAPI_BASE}/everything`;
      params = { q, language: 'en', page, pageSize, sortBy: 'publishedAt' };
    } else {
      url = `${NEWSAPI_BASE}/top-headlines`;
      params = { country: 'us', page, pageSize };
    }

    const response = await axios.get(url, {
      params,
      headers: { 'X-Api-Key': NEWS_API_KEY }
    });

    // forward API data to frontend
    res.json(response.data);
  } catch (err) {
    console.error('News fetch error:', err.response?.data || err.message);
    res.status(500).json({ error: 'news_fetch_failed', details: err.response?.data || err.message });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`News service on ${PORT}`));