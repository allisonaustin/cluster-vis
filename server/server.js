const express = require('express');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 5009;

app.use(cors());

const farmFilePath = path.join(__dirname, './data/farm/novadaq-far-farm.json');

app.get('/mgrData', (req, res) => {
    const { file } = req.query;
    const filePath = path.join(__dirname, `./data/${file}`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading file' });
        }
        res.json(JSON.parse(data));
    });
});

app.get('/farmData', (req, res) => {
    fs.readFile(farmFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading file' });
        }
        res.json(JSON.parse(data));
    });
  });

app.get('/files', (req, res) => {
    const dataPath = path.join(__dirname, 'data');
    fs.readdir(dataPath, (err, folders) => {
        if (err) {
            res.status(500).send('Error reading folder');
            return;
        }
        const jsonFiles = [];

        folders.forEach(folder => {
            if (!folder.includes('farm')) {
                const folderPath = path.join(dataPath, folder);

                if (fs.statSync(folderPath).isDirectory()) {
                    const files = fs.readdirSync(folderPath);
                    files.forEach(file => {
                        if (path.extname(file) === '.json') {
                            jsonFiles.push(path.join(folder, file)); 
                        }
                    });
                }
            }
        });

        res.json(jsonFiles);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} !`);
  });