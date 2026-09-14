// Genera los recursos gráficos de YVR Assistant a partir de boot.png.
//
//   pnpm dlx --package=sharp node scripts/generate-avatar.mjs
//
// Solo hay que ejecutarlo si cambia boot.png; los .webp resultantes se
// versionan en el repo, así el build normal no necesita sharp.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = join(here, "..", "src", "assets", "img");
const SRC = join(DIR, "boot.png");

async function report(file) {
  const { size } = await stat(join(DIR, file));
  console.log(`${file}: ${(size / 1024).toFixed(0)} KB`);
}

// --- 1. Ilustración del hero -------------------------------------------
// La MISMA imagen completa, sin recortar: solo reducida y en WebP.
// 1024px de ancho basta (en pantalla se muestra a ~480px) y baja de
// 1.68 MB a unas decenas de KB.
await sharp(SRC)
  .resize({ width: 1024 })
  .webp({ quality: 88 })
  .toFile(join(DIR, "yvr-hero.webp"));

await report("yvr-hero.webp");

// --- 2. Avatar del header ----------------------------------------------
// Para el círculo pequeño sí hace falta un recorte cuadrado: la
// ilustración es 3:2 y el robot está en el centro-izquierda.
// Este encuadre contiene el rostro, el headset y parte del logo.
const CROP = { left: 455, top: 0, width: 645, height: 1024 };

// Trabajamos a un tamaño final pequeño y fijo: así todas las capas
// tienen exactamente las mismas dimensiones y el composite no falla.
const OUT = 256;

const background = await sharp(SRC)
  .extract(CROP)
  .resize(OUT, OUT, { fit: "cover" })
  .blur(12)
  // Oscurecemos el relleno: si queda tan claro como la ilustración, el
  // robot blanco pierde contraste sobre la interfaz oscura.
  .modulate({ brightness: 0.55, saturation: 0.7 })
  .toBuffer();

// El robot, escalado para caber entero dentro del cuadrado.
const robot = await sharp(SRC)
  .extract(CROP)
  .resize(OUT, OUT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

const vignette = Buffer.from(
  `<svg width="${OUT}" height="${OUT}">
     <defs>
       <radialGradient id="v" cx="50%" cy="46%" r="72%">
         <stop offset="45%" stop-color="#000" stop-opacity="0"/>
         <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
       </radialGradient>
     </defs>
     <rect width="${OUT}" height="${OUT}" fill="url(#v)"/>
   </svg>`
);

// Componemos primero y redimensionamos después, en dos pasos: encadenar
// un resize tras el composite hace que sharp reescale las capas y falle
// con "Image to composite must have same dimensions or smaller".
const composed = await sharp(background)
  .composite([
    { input: robot, gravity: "center" },
    { input: vignette, blend: "over" },
  ])
  .png()
  .toBuffer();

await sharp(composed)
  .resize(128, 128)
  .webp({ quality: 90 })
  .toFile(join(DIR, "yvr-avatar-sm.webp"));

await report("yvr-avatar-sm.webp");
