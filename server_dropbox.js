const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fetch = require('node-fetch');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;
const DROPBOX_FOLDER_PATH = process.env.DROPBOX_FOLDER_PATH || '/';

if (!DROPBOX_TOKEN) {
  console.warn('DROPBOX_TOKEN not set — файлы не будут загружаться');
}

app.get('/', (req, res) => res.send('OK - Dropbox uploader'));

app.post('/save', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) return res.status(400).json({ ok: false, error: 'Empty body' });

    const participant = payload.participant ? String(payload.participant).replace(/[^a-z0-9-_]/gi, '_') : 'unknown';
    const ts = Date.now();
    const filename = `data_${participant}_${ts}.json`;
    const dropboxPath = path.posix.join(DROPBOX_FOLDER_PATH, filename);
    const content = JSON.stringify(payload, null, 2);

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'add',
          autorename: true,
          mute: false
        })
      },
      body: content
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Dropbox upload failed: ' + errText);
    }

    const json = await response.json();
    return res.json({ ok: true, savedTo: `dropbox:${json.path_display}` });
  } catch (err) {
    console.error('Dropbox save error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server (Dropbox) listening on ${PORT}`));
