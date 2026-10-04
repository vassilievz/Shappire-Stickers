import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SOURCE_LOGO = 'logo_downloaded.png';
const BG_COLOR = { r: 8, g: 9, b: 11, alpha: 1 };

async function run() {
  console.log('Generating assets from', SOURCE_LOGO);

  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const srcAssetsDir = path.resolve('src/assets');
  if (!fs.existsSync(srcAssetsDir)) fs.mkdirSync(srcAssetsDir, { recursive: true });

  await sharp(SOURCE_LOGO).resize(512, 512).toFile(path.join(publicDir, 'logo.png'));
  await sharp(SOURCE_LOGO).resize(192, 192).toFile(path.join(publicDir, 'favicon.png'));
  await sharp(SOURCE_LOGO).resize(512, 512).toFile(path.join(srcAssetsDir, 'logo.png'));
  console.log('Web assets generated.');

  const resDir = path.resolve('android/app/src/main/res');

  const densities = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108, fgLogoSize: 72 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162, fgLogoSize: 108 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216, fgLogoSize: 144 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324, fgLogoSize: 216 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432, fgLogoSize: 288 },
  ];

  for (const d of densities) {
    const targetDir = path.join(resDir, d.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const logoResized = await sharp(SOURCE_LOGO).resize(d.size, d.size).toBuffer();
    await sharp({
      create: {
        width: d.size,
        height: d.size,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: logoResized, top: 0, left: 0 }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    await sharp({
      create: {
        width: d.size,
        height: d.size,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: logoResized, top: 0, left: 0 }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    const fgLogo = await sharp(SOURCE_LOGO).resize(d.fgLogoSize, d.fgLogoSize).toBuffer();
    const offset = Math.round((d.fgSize - d.fgLogoSize) / 2);
    await sharp({
      create: {
        width: d.fgSize,
        height: d.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: fgLogo, top: offset, left: offset }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated icons for ${d.dir}`);
  }

  const v24Fg = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(v24Fg)) {
    fs.unlinkSync(v24Fg);
    console.log('Removed obsolete drawable-v24/ic_launcher_foreground.xml');
  }

  const bgXmlPath = path.join(resDir, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(
    bgXmlPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#08090B</color>\n</resources>\n`
  );
  console.log('Updated ic_launcher_background.xml');

  const splashTargets = [
    { dir: 'drawable', w: 480, h: 800, logoSize: 220 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480, logoSize: 150 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800, logoSize: 220 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280, logoSize: 320 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600, logoSize: 420 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920, logoSize: 520 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320, logoSize: 150 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480, logoSize: 220 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720, logoSize: 320 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960, logoSize: 420 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280, logoSize: 520 },
  ];

  for (const s of splashTargets) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const logoResized = await sharp(SOURCE_LOGO).resize(s.logoSize, s.logoSize).toBuffer();
    const top = Math.round((s.h - s.logoSize) / 2);
    const left = Math.round((s.w - s.logoSize) / 2);

    await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: BG_COLOR,
      },
    })
      .composite([{ input: logoResized, top, left }])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`Generated splash for ${s.dir} (${s.w}x${s.h})`);
  }

  console.log('All Android icons and splash screens successfully generated!');
}

run().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
