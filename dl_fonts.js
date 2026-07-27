const fs = require('fs');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        https.get(response.headers.location, (res) => {
          const file = fs.createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(resolve));
        });
      } else {
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      }
    });
  });
}

async function main() {
  console.log("Downloading fonts...");
  await download('https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Medium.ttf', 'assets/fonts/Montserrat-Medium.ttf');
  await download('https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat-Bold.ttf', 'assets/fonts/Montserrat-Bold.ttf');
  await download('https://github.com/google/fonts/raw/main/ofl/lora/Lora-Medium.ttf', 'assets/fonts/Lora-Medium.ttf');
  
  console.log("Encoding to base64...");
  const mMedium = fs.readFileSync('assets/fonts/Montserrat-Medium.ttf').toString('base64');
  const mBold = fs.readFileSync('assets/fonts/Montserrat-Bold.ttf').toString('base64');
  const lMedium = fs.readFileSync('assets/fonts/Lora-Medium.ttf').toString('base64');

  const css = `
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 500;
  src: url(data:font/ttf;base64,${mMedium}) format('truetype');
}
@font-face {
  font-family: 'Montserrat';
  font-style: normal;
  font-weight: 700;
  src: url(data:font/ttf;base64,${mBold}) format('truetype');
}
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 500;
  src: url(data:font/ttf;base64,${lMedium}) format('truetype');
}
`;
  fs.writeFileSync('dashboard/assets/fonts_b64.css', css);
  console.log('Done generating CSS. Size:', css.length);
}

main().catch(console.error);
