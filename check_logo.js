const Jimp = require('jimp');

async function check() {
  const image = await Jimp.read('public/logo.png');
  console.log(`Width: ${image.bitmap.width}, Height: ${image.bitmap.height}`);
}

check().catch(console.error);
