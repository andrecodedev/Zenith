import Jimp from 'jimp';

async function cropLogo() {
  try {
    const image = await Jimp.read('public/logo.png');
    
    // The logo has a triangle on top and text "ZENITH" on the bottom.
    // We want to crop off the bottom text.
    // Let's assume the text occupies the bottom 35% of the image.
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    // Crop: x, y, w, h
    // We keep the top 65% of the image.
    const newHeight = Math.floor(height * 0.70);
    
    image.crop(0, 0, width, newHeight);
    
    await image.writeAsync('public/logo.png');
    console.log(`Cropped logo successfully! Old height: ${height}, New height: ${newHeight}`);
  } catch (error) {
    console.error('Error cropping logo:', error);
  }
}

cropLogo();
