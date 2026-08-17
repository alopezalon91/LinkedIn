const { execSync } = require('child_process');
try {
  const output = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --json --command="SELECT media_base64 FROM posts WHERE id = \'8e070f4a-c563-4d70-92e7-e6c367df6160\'"').toString();
  const data = JSON.parse(output.split('\n').filter(line => !line.includes('Warning:')).join('\n'));
  const base64 = data[0].results[0].media_base64;
  if (!base64) {
    console.log("No media_base64 found.");
  } else {
    let str = Buffer.from(base64, 'base64').toString('utf8');
    if (str.startsWith('CAROUSEL:')) {
      str = str.substring(9);
    }
    // Pretty print the JSON
    console.log(JSON.stringify(JSON.parse(str), null, 2));
  }
} catch (e) {
  console.error(e);
}
