const { execSync } = require('child_process');

try {
  const output = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "SELECT id, status, media_base64 FROM posts WHERE status IN (\'pending\', \'reviewed\', \'approved\') AND media_base64 IS NOT NULL"', { encoding: 'utf-8' });
  const data = JSON.parse(output);
  const rows = data[0].results || [];
  
  let found = 0;
  rows.forEach((row) => {
    try {
      const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
      if (decodedStr.includes('trinchera')) {
        console.log(`Found 'trinchera' in media_base64 of post ${row.id} (${row.status}):`);
        console.log(decodedStr.substring(0, 500));
        found++;
      }
    } catch (e) {
      // ignore decode error
    }
  });
  console.log(`\nCheck complete. Found ${found} active posts with 'trinchera' in media.`);
} catch (err) {
  console.error("Error:", err.message);
}
