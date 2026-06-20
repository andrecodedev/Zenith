const { Jimp } = require('jimp');

async function processLogo() {
  const image = await Jimp.read('public/logo.png');
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  console.log(`Dimensions: ${w}x${h}`);
  
  // scan rows to find horizontal gap
  let rows = [];
  for (let y = 0; y < h; y++) {
    let hasPixel = false;
    for (let x = 0; x < w; x++) {
      let alpha = Jimp.intToRGBA(image.getPixelColor(x, y)).a;
      if (alpha > 50) { hasPixel = true; break; }
    }
    rows.push(hasPixel ? 1 : 0);
  }
  
  // Find the gap (a sequence of 0s after some 1s)
  let inTriangle = false;
  let gapStartY = -1;
  let gapEndY = -1;
  for(let y=0; y<h; y++){
    if(rows[y] === 1) {
      inTriangle = true;
      if (gapStartY !== -1 && gapEndY === -1) {
        gapEndY = y;
        break;
      }
    } else if (inTriangle && rows[y] === 0 && gapStartY === -1) {
      gapStartY = y;
    }
  }
  
  console.log(`Gap starts at ${gapStartY}, ends at ${gapEndY}`);
  
  if (gapStartY > 0) {
    image.crop({x: 0, y: 0, w: w, h: gapStartY});
    await image.write('public/logo.png');
    console.log('Cropped successfully.');
  } else {
    // maybe we just crop the top 70%
    image.crop({x: 0, y: 0, w: w, h: Math.floor(h * 0.75)});
    await image.write('public/logo.png');
    console.log('Forced Crop.');
  }
}

processLogo().catch(console.error);
