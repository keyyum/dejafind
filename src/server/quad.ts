import sharp from "sharp";

// @techstark/opencv-js's default export is a Promise that resolves to the cv
// namespace once its WASM runtime finishes initializing (~200ms). Load once per
// process and reuse; cv has no useful TypeScript types for this build, hence any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cvPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCv(): Promise<any> {
  if (!cvPromise) {
    cvPromise = import("@techstark/opencv-js").then((mod) => {
      const candidate = mod.default;
      return candidate instanceof Promise ? candidate : candidate;
    });
  }
  return cvPromise;
}

interface Point {
  x: number;
  y: number;
}

function orderPoints(pts: Point[]): [Point, Point, Point, Point] {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]]; // tl, tr, br, bl
}

/**
 * Detects the largest roughly-quadrilateral contour (a slide, a sheet of paper, a
 * whiteboard) and perspective-warps it flat. Returns null when no confident quad is
 * found, so the caller can fall back to a plain crop. Step 8.
 */
export async function detectAndWarpQuad(imageBuffer: Buffer): Promise<Buffer | null> {
  const cv = await getCv();

  const { data, info } = await sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const imageArea = width * height;

  const mats: { delete?: () => void }[] = [];
  const track = <T extends { delete?: () => void }>(m: T): T => {
    mats.push(m);
    return m;
  };

  try {
    const src = track(new cv.Mat(height, width, cv.CV_8UC4));
    src.data.set(data);

    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const blurred = track(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    const edges = track(new cv.Mat());
    cv.Canny(blurred, edges, 50, 150);

    const kernel = track(cv.Mat.ones(3, 3, cv.CV_8U));
    const dilated = track(new cv.Mat());
    cv.dilate(edges, dilated, kernel);

    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestQuad: { data32S: Int32Array; delete?: () => void } | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const area = Math.abs(cv.contourArea(approx));
        // Require the quad to cover a meaningful slice of the frame but not the
        // whole thing (which usually means the frame border itself was picked up).
        if (area > bestArea && area > imageArea * 0.15 && area < imageArea * 0.97) {
          bestArea = area;
          bestQuad?.delete?.();
          bestQuad = approx.clone();
        }
      }
      approx.delete();
      cnt.delete();
    }

    if (!bestQuad) return null;
    track(bestQuad);

    const pts: Point[] = [];
    for (let i = 0; i < 4; i++) {
      pts.push({ x: bestQuad.data32S[i * 2], y: bestQuad.data32S[i * 2 + 1] });
    }
    const [tl, tr, br, bl] = orderPoints(pts);

    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
    const outW = Math.round(Math.max(widthTop, widthBottom));
    const outH = Math.round(Math.max(heightLeft, heightRight));
    if (outW < 50 || outH < 50) return null;

    const srcTri = track(
      cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y])
    );
    const dstTri = track(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]));
    const M = track(cv.getPerspectiveTransform(srcTri, dstTri));
    const warped = track(new cv.Mat());
    cv.warpPerspective(src, warped, M, new cv.Size(outW, outH));

    const warpedBuffer = Buffer.from(warped.data as Uint8Array);
    return await sharp(warpedBuffer, { raw: { width: outW, height: outH, channels: 4 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  } finally {
    for (const m of mats) m.delete?.();
  }
}
