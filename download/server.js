const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Octokit } = require('@octokit/rest');
require('dotenv').config();

const app = express();
app.use(cors()); // разрешить запросы с браузера (в проде укажите origin)
app.use(bodyParser.json({ limit: '8mb' })); // увеличить если отправляете большие данные

const PORT = process.env.PORT || 3000;
const OWNER = process.env.GITHUB_OWNER || process.env.OWNER;
const REPO = process.env.GITHUB_REPO || process.env.REPO;
const BRANCH = process.env.GITHUB_BRANCH || process.env.BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN; // если нет — будет сохранять локально

const octokit = TOKEN ? new Octokit({ auth: TOKEN }) : null;

// Ensure data directory exists for local saves
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Health check
app.get('/', (req, res) => res.send('OK'));

// Save endpoint
app.post('/save', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ ok: false, error: 'Empty body' });
    }

    // Make safe filename
    const participant = payload.participant ? String(payload.participant).replace(/[^a-z0-9-_]/gi, '_') : 'unknown';
    const ts = Date.now();
    const filename = `data/data_${participant}_${ts}.json`;
    const content = JSON.stringify(payload, null, 2);

    if (octokit && OWNER && REPO) {
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER,
        repo: REPO,
        path: filename,
        message: `Add participant data ${filename}`,
        content: Buffer.from(content).toString('base64'),
        branch: BRANCH
      });
      return res.json({ ok: true, savedTo: `github://${OWNER}/${REPO}/${BRANCH}/${filename}` });
    } else {
      const localPath = path.join(__dirname, filename);
      fs.writeFileSync(localPath, content);
      return res.json({ ok: true, savedTo: `file://${localPath}` });
    }
  } catch (err) {
    console.error('Save error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Save server listening on ${PORT} (owner=${OWNER || ''} repo=${REPO || ''})`);
});
