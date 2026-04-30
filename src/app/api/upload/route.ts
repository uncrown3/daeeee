import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, readSessionToken } from "@/lib/auth";
import { isValidRoomCode, makeBlobPath, normalizeRoomCode } from "@/lib/blob-utils";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const FILE_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const user = await readSessionToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const formData = await request.formData();
  const roomInput = String(formData.get("room") ?? "");
  const room = normalizeRoomCode(roomInput);

  if (!isValidRoomCode(room)) {
    return NextResponse.json({ error: "Invalid room code." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 20MB limit." },
      { status: 413 },
    );
  }

  const expiresAt = Date.now() + FILE_TTL_MS;
  const pathname = makeBlobPath(room, file.name, expiresAt);

  const uploadedBlob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type || "application/octet-stream",
  });

  return NextResponse.json({
    file: {
      url: uploadedBlob.url,
      pathname: uploadedBlob.pathname,
      uploadedBy: user.name,
      uploadedAt: Date.now(),
      expiresAt,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      originalName: file.name,
    },
  });
}
