const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 5009;

app.use(cors());

const farmFilePath = path.join(__dirname, './data/farm/novadaq-far-farm_2024-02-21.json');
const mgrFilePath = path.join(__dirname, './data/mgr/novadaq-far-mgr-01.json'); 

app.get('/mgrData', (req, res) => {
    fs.readFile(mgrFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading file' });
        }
        res.json(JSON.parse(data));
    });
});

app.get('/farmData', (req, res) => {
    const readStream = fs.createReadStream(farmFilePath, { encoding: 'utf8' });

    res.setHeader('Content-Type', 'application/json');
    readStream.pipe(res);

    readStream.on('error', (err) => {
        console.error('Error reading file:', err);
        res.status(500).json({ error: 'Error reading file' });
    });
  });

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT} !`);
});