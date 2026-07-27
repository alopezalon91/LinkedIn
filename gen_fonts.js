const fs = require('fs');

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
console.log('Done');
