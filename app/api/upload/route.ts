import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024; // 1 MB

// Detect the real type from the file's first bytes, not from its name or the browser's label.
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { ext: "gif", type: "image/gif" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { ext: "webp", type: "image/webp" };
  return null;
}

/** Stores a token image (PNG, JPG, GIF or WebP, up to 1 MB) and returns its public URL. */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Image uploads aren't set up yet." }, { status: 503 });
  }
  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    /* fall through */
  }
  if (!file) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The image must be 1 MB or smaller." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return NextResponse.json({ error: "Use a PNG, JPG, GIF or WebP image." }, { status: 415 });

  const blob = await put(`tokens/${crypto.randomUUID()}.${kind.ext}`, Buffer.from(bytes), {
    access: "public",
    contentType: kind.type,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ url: blob.url });
}
