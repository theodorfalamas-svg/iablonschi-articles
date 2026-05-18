const https = require('https');
const fs = require('fs');

const SHEETS_URL = process.env.SHEETS_URL;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

function parseCSV(text) {
  const rows = [];
  let i = 0, n = text.length;
  while (i < n) {
    const row = [];
    while (i < n && text[i] !== '\n' && text[i] !== '\r') {
      let cell = '';
      if (text[i] === '"') {
        i++;
        while (i < n) {
          if (text[i] === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
          else if (text[i] === '"') { i++; break; }
          else { cell += text[i++]; }
        }
      } else {
        while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') cell += text[i++];
      }
      row.push(cell);
      if (text[i] === ',') i++;
    }
    if (text[i] === '\r') i++;
    if (text[i] === '\n') i++;
    if (row.length > 0 && row.some(c => c.trim())) rows.push(row);
  }
  return rows;
}

async function main() {
  const current = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
  const currentIds = new Set(current.map(a => a.id));

  const csvText = await fetchText(SHEETS_URL);
  const rows = parseCSV(csvText);
  if (rows.length < 2) { console.log('No data from Sheets'); return; }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const col = k => headers.indexOf(k);

  const newArticles = rows.slice(1)
    .filter(r => r[col('id')] && r[col('title')])
    .map(r => ({
      id:         (r[col('id')] || '').trim(),
      title:      (r[col('title')] || '').trim(),
      title_en:   (r[col('title_en')] || '').trim(),
      date:       (r[col('date')] || '').trim(),
      dateISO:    (r[col('dateiso')] || r[col('date_iso')] || '').trim(),
      category:   (r[col('category')] || 'corporate').trim(),
      excerpt:    (r[col('excerpt')] || '').trim(),
      excerpt_en: (r[col('excerpt_en')] || '').trim(),
      body:       (r[col('content')] || r[col('body')] || '').trim(),
      body_en:    (r[col('content_en')] || r[col('body_en')] || '').trim(),
      image:      (r[col('image')] || '').trim(),
      url:        (r[col('url')] || r[col('link')] || '').trim(),
    }))
    .filter(a => !currentIds.has(a.id));

  if (!newArticles.length) { console.log('No new articles'); return; }

  const merged = [...newArticles, ...current];
  merged.sort((a, b) => {
    const da = a.dateISO || '', db = b.dateISO || '';
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });

  fs.writeFileSync('articles.json', JSON.stringify(merged, null, 2));
  console.log(`Added ${newArticles.length} articles. Total: ${merged.length}`);
}

main().catch(console.error);
