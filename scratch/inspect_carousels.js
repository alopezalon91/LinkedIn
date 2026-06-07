const { execSync } = require('child_process');

try {
  const output = execSync('npx wrangler d1 execute mytaxbot_linkedin --remote --json --command "SELECT id, status, media_base64 FROM posts WHERE media_base64 IS NOT NULL AND status IN (\'pending\', \'reviewed\', \'approved\') LIMIT 10"', { encoding: 'utf-8' });
  const data = JSON.parse(output);
  const rows = data[0].results;
  
  rows.forEach((row, idx) => {
    console.log(`\n=================== POST ${idx + 1} (${row.id}, Status: ${row.status}) ===================`);
    try {
      const decodedStr = decodeURIComponent(escape(atob(row.media_base64)));
      if (decodedStr.startsWith('CAROUSEL:')) {
        const carousel = JSON.parse(decodedStr.substring(9));
        console.log("Slides in Carousel:");
        carousel.forEach((slide, sIdx) => {
          console.log(`  Slide ${sIdx + 1} (${slide.slide_type || 'unknown'}):`);
          console.log(`    Pre-title: ${slide.pre_title}`);
          console.log(`    Title:     ${slide.title}`);
          console.log(`    Subtitle:  ${slide.subtitle}`);
        });
      } else {
        console.log("Doesn't start with CAROUSEL:");
        console.log(decodedStr.substring(0, 100));
      }
    } catch (err) {
      console.log("Error decoding/parsing media_base64:", err.message);
    }
  });
} catch (err) {
  console.error("Execution error:", err.message);
}
