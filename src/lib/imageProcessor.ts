import sharp from 'sharp';

export interface ProcessLogoOptions {
  tolerance?: number; // 0 to 255 Euclidean distance tolerance (default: 32)
  feather?: boolean;  // enable soft edge alpha matting (default: true)
  autoTrim?: boolean; // remove outer transparent padding (default: true)
  paddingRatio?: number; // relative padding around trimmed artwork (default: 0.02)
  maxDimension?: number; // max width/height to constrain processing (default: 2000)
}

export interface ProcessLogoResult {
  success: boolean;
  isTransparentAlready: boolean;
  backgroundRemoved: boolean;
  detectedBackgroundColor?: { r: number; g: number; b: number; hex: string };
  originalDataUrl: string;
  processedDataUrl: string;
  originalDimensions: { width: number; height: number };
  processedDimensions: { width: number; height: number };
  aspectRatio: number;
  originalBuffer?: Buffer;
  processedBuffer?: Buffer;
}

/**
 * Calculates Euclidean color distance between two RGB colors.
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Checks whether an image buffer has significant pre-existing transparency.
 */
function detectExistingTransparency(rawBuffer: Buffer, width: number, height: number): boolean {
  let transparentPixelCount = 0;
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(totalPixels / 5000)); // Sample up to 5000 pixels

  for (let i = 0; i < totalPixels; i += step) {
    const alpha = rawBuffer[i * 4 + 3];
    if (alpha < 240) {
      transparentPixelCount++;
    }
  }

  const sampleCount = Math.floor(totalPixels / step);
  return (transparentPixelCount / sampleCount) > 0.03; // > 3% is transparent
}

/**
 * Samples outer border and corner pixels to detect solid or uniform background color.
 */
function detectBorderBackgroundColor(
  rawBuffer: Buffer,
  width: number,
  height: number
): { r: number; g: number; b: number; hex: string; uniform: boolean } | null {
  // Sample the 4 corners
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  const cornerColors = corners.map((c) => {
    const idx = (c.y * width + c.x) * 4;
    return {
      r: rawBuffer[idx],
      g: rawBuffer[idx + 1],
      b: rawBuffer[idx + 2],
      a: rawBuffer[idx + 3],
    };
  });

  // Calculate median / average of corners
  const avgR = Math.round(cornerColors.reduce((s, c) => s + c.r, 0) / 4);
  const avgG = Math.round(cornerColors.reduce((s, c) => s + c.g, 0) / 4);
  const avgB = Math.round(cornerColors.reduce((s, c) => s + c.b, 0) / 4);

  // Check how many corners match within reasonable distance (35)
  let matchingCorners = 0;
  for (const c of cornerColors) {
    if (colorDistance(c.r, c.g, c.b, avgR, avgG, avgB) < 35) {
      matchingCorners++;
    }
  }

  // If at least 3 of 4 corners match, background is uniform
  const uniform = matchingCorners >= 3;
  if (!uniform) {
    return null; // Highly non-uniform or photographic border
  }

  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`.toUpperCase();

  return { r: avgR, g: avgG, b: avgB, hex, uniform: true };
}

/**
 * Performs boundary-connected flood fill to remove outer solid background
 * while strictly preserving internal white text, symbols, and brand artwork.
 */
function performConnectedBackgroundRemoval(
  rawBuffer: Buffer,
  width: number,
  height: number,
  bgR: number,
  bgG: number,
  bgB: number,
  tolerance = 32,
  feather = true
): Buffer {
  const output = Buffer.from(rawBuffer);
  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const isMatchingBg = (idx: number, tol = tolerance): boolean => {
    const pIdx = idx * 4;
    return colorDistance(output[pIdx], output[pIdx + 1], output[pIdx + 2], bgR, bgG, bgB) <= tol;
  };

  // 1. Seed top and bottom borders
  for (let x = 0; x < width; x++) {
    const topIdx = x;
    if (!visited[topIdx] && isMatchingBg(topIdx)) {
      visited[topIdx] = 1;
      queue[tail++] = topIdx;
    }
    const btmIdx = (height - 1) * width + x;
    if (!visited[btmIdx] && isMatchingBg(btmIdx)) {
      visited[btmIdx] = 1;
      queue[tail++] = btmIdx;
    }
  }

  // 2. Seed left and right borders
  for (let y = 0; y < height; y++) {
    const leftIdx = y * width;
    if (!visited[leftIdx] && isMatchingBg(leftIdx)) {
      visited[leftIdx] = 1;
      queue[tail++] = leftIdx;
    }
    const rightIdx = y * width + (width - 1);
    if (!visited[rightIdx] && isMatchingBg(rightIdx)) {
      visited[rightIdx] = 1;
      queue[tail++] = rightIdx;
    }
  }

  // 3. BFS Flood Fill
  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // 4-way neighbors
    if (cx > 0) {
      const n = curr - 1;
      if (!visited[n] && isMatchingBg(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cx < width - 1) {
      const n = curr + 1;
      if (!visited[n] && isMatchingBg(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cy > 0) {
      const n = curr - width;
      if (!visited[n] && isMatchingBg(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (cy < height - 1) {
      const n = curr + width;
      if (!visited[n] && isMatchingBg(n)) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  // 4. Apply Alpha Transparency to Visited Background Pixels
  for (let i = 0; i < totalPixels; i++) {
    if (visited[i] === 1) {
      output[i * 4 + 3] = 0; // Fully transparent
    }
  }

  // 5. Soft Edge Anti-Aliasing & Defringing (Halo Removal)
  if (feather) {
    const innerTol = tolerance * 0.7;
    const outerTol = tolerance * 1.35;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (visited[i] === 1) continue; // Already transparent

        // Check if pixel is adjacent to a removed background pixel
        const hasTransparentNeighbor =
          visited[i - 1] === 1 ||
          visited[i + 1] === 1 ||
          visited[i - width] === 1 ||
          visited[i + width] === 1;

        if (hasTransparentNeighbor) {
          const pIdx = i * 4;
          const dist = colorDistance(output[pIdx], output[pIdx + 1], output[pIdx + 2], bgR, bgG, bgB);

          if (dist < outerTol) {
            // Smooth transition
            const alphaFactor = Math.max(0, Math.min(1, (dist - innerTol) / (outerTol - innerTol)));
            const newAlpha = Math.round(output[pIdx + 3] * alphaFactor);
            output[pIdx + 3] = newAlpha;

            // Defringe: neutralize background color bleeding on semi-transparent edges
            if (alphaFactor < 0.95 && alphaFactor > 0.05) {
              output[pIdx] = Math.round(Math.max(0, Math.min(255, (output[pIdx] - bgR * (1 - alphaFactor)) / alphaFactor)));
              output[pIdx + 1] = Math.round(Math.max(0, Math.min(255, (output[pIdx + 1] - bgG * (1 - alphaFactor)) / alphaFactor)));
              output[pIdx + 2] = Math.round(Math.max(0, Math.min(255, (output[pIdx + 2] - bgB * (1 - alphaFactor)) / alphaFactor)));
            }
          }
        }
      }
    }
  }

  return output;
}

/**
 * Computes the minimum bounding box of non-transparent artwork and trims outer padding.
 */
async function autoTrimTransparentPadding(
  rawBuffer: Buffer,
  width: number,
  height: number,
  paddingRatio = 0.02
): Promise<{ buffer: Buffer; width: number; height: number }> {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rawBuffer[(y * width + x) * 4 + 3];
      if (alpha > 12) {
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasContent || maxX < minX || maxY < minY) {
    return { buffer: rawBuffer, width, height };
  }

  // Add small 2% uniform padding around bounding box
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const padX = Math.round(contentW * paddingRatio);
  const padY = Math.round(contentH * paddingRatio);

  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const right = Math.min(width - 1, maxX + padX);
  const bottom = Math.min(height - 1, maxY + padY);

  const cropW = right - left + 1;
  const cropH = bottom - top + 1;

  // Don't crop if it's already within 98% of full size
  if (cropW >= width * 0.98 && cropH >= height * 0.98) {
    return { buffer: rawBuffer, width, height };
  }

  const cropped = await sharp(rawBuffer, {
    raw: { width, height, channels: 4 },
  })
    .extract({ left, top, width: cropW, height: cropH })
    .raw()
    .toBuffer();

  return { buffer: cropped, width: cropW, height: cropH };
}

/**
 * Main entrance: processes an uploaded business logo.
 * Detects background, removes it seamlessly, auto-trims whitespace, and produces high-resolution PNG.
 */
export async function processBusinessLogo(
  inputBuffer: Buffer,
  mimeType: string,
  options: ProcessLogoOptions = {}
): Promise<ProcessLogoResult> {
  const tolerance = options.tolerance ?? 32;
  const feather = options.feather ?? true;
  const autoTrim = options.autoTrim ?? true;
  const maxDimension = options.maxDimension ?? 2000;

  // 1. Load image and standardize to RGBA
  let image = sharp(inputBuffer);
  const meta = await image.metadata();

  if (!meta.width || !meta.height) {
    throw new Error('Could not read image dimensions.');
  }

  const originalDimensions = { width: meta.width, height: meta.height };

  // Constrain max processing dimensions if extraordinarily huge (to preserve server CPU/memory)
  if (meta.width > maxDimension || meta.height > maxDimension) {
    image = image.resize({
      width: meta.width > meta.height ? maxDimension : undefined,
      height: meta.height >= meta.width ? maxDimension : undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Export original as data URL for persistent storage
  const normalizedMime = mimeType === 'image/svg+xml' ? 'image/svg+xml' : 'image/png';
  let originalDataUrl: string;
  if (mimeType === 'image/svg+xml') {
    originalDataUrl = `data:image/svg+xml;base64,${inputBuffer.toString('base64')}`;
  } else {
    const origPng = await sharp(inputBuffer).png().toBuffer();
    originalDataUrl = `data:image/png;base64,${origPng.toString('base64')}`;
  }

  // Get raw RGBA buffer
  const { data: rawBuffer, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;

  // 2. Check if image is already transparent
  const isTransparentAlready = detectExistingTransparency(rawBuffer, width, height);

  let processedBuffer = rawBuffer;
  let backgroundRemoved = false;
  let detectedBgInfo: { r: number; g: number; b: number; hex: string } | undefined = undefined;

  if (isTransparentAlready) {
    // Already has transparency: preserve existing transparency
    backgroundRemoved = false;
  } else {
    // 3. Detect background color from boundary
    const bgInfo = detectBorderBackgroundColor(rawBuffer, width, height);
    if (bgInfo && bgInfo.uniform) {
      detectedBgInfo = { r: bgInfo.r, g: bgInfo.g, b: bgInfo.b, hex: bgInfo.hex };
      // 4. Perform connected flood fill with edge smoothing
      processedBuffer = Buffer.from(performConnectedBackgroundRemoval(
        rawBuffer,
        width,
        height,
        bgInfo.r,
        bgInfo.g,
        bgInfo.b,
        tolerance,
        feather
      ));
      backgroundRemoved = true;
    }
  }

  // 5. Auto-trim outer empty padding for best-fit sizing in document headers
  let finalWidth = width;
  let finalHeight = height;

  if (autoTrim) {
    const trimmed = await autoTrimTransparentPadding(
      processedBuffer,
      width,
      height,
      options.paddingRatio ?? 0.02
    );
    processedBuffer = Buffer.from(trimmed.buffer);
    finalWidth = trimmed.width;
    finalHeight = trimmed.height;
  }

  // 6. Encode processed transparent PNG with high resolution
  const finalPngBuffer = await sharp(processedBuffer, {
    raw: { width: finalWidth, height: finalHeight, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const processedDataUrl = `data:image/png;base64,${finalPngBuffer.toString('base64')}`;
  const aspectRatio = Number((finalWidth / finalHeight).toFixed(3));

  return {
    success: true,
    isTransparentAlready,
    backgroundRemoved,
    detectedBackgroundColor: detectedBgInfo,
    originalDataUrl,
    processedDataUrl,
    originalDimensions,
    processedDimensions: { width: finalWidth, height: finalHeight },
    aspectRatio,
    originalBuffer: inputBuffer,
    processedBuffer: finalPngBuffer,
  };
}
