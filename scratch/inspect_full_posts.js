const { execSync } = require('child_process');

try {
  const output = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "SELECT id, content, media_base64 FROM posts WHERE status = \'pending\'"', { encoding: 'utf-8' });
  const data = JSON.parse(output);
  const rows = data[0].results;
  
  rows.forEach((row, idx) => {
    console.log(`\n=================== POST ${idx + 1} (${row.id}) ===================`);
    console.log("CONTENT:");
    console.log(row.content);
    console.log("\nCAROUSEL:");
    try {
      const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
      if (decodedStr.startsWith('CAROUSEL:')) {
        const carousel = JSON.parse(decodedStr.substring(9));
        console.log(JSON.stringify(carousel, null, 2));
      }
    } catch (err) {
      console.log("Error decoding carousel:", err.message);
    }
  });
} catch (err) {
  console.error("Error:", err.message);
}
