import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/** Admin tərəfindən yüklənmiş şəkillər (STORAGE_DIR) */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  const root = path.resolve(env.storageDir);
  const file = path.resolve(root, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !type) return new NextResponse("Tapılmadı", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse("Tapılmadı", { status: 404 });
  }
}
