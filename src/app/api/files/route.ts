import { del, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, readSessionToken } from "@/lib/auth";
import {
  getExpiryFromPath,
  isValidRoomCode,
  normalizeRoomCode,
} from "@/lib/blob-utils";

function readSessionCookie(request: NextRequest) {
  return request.cookies.get(getSessionCookieName())?.value ?? null;
}

export async function GET(request: NextRequest) {
  const user = await readSessionToken(readSessionCookie(request));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const roomInput = request.nextUrl.searchParams.get("room") ?? "";
  const room = normalizeRoomCode(roomInput);
  if (!isValidRoomCode(room)) {
    return NextResponse.json({ error: "Invalid room code." }, { status: 400 });
  }

  const result = await list({
    prefix: `uploads/${room}/`,
    mode: "folded",
  });

  const nowMs = Date.now();
  const files = result.blobs
    .map((blob) => {
      const expiresAt = getExpiryFromPath(blob.pathname);
      const uploadedAt = new Date(blob.uploadedAt);
      return {
        url: blob.url,
        pathname: blob.pathname,
        size: blob.size,
        uploadedAt,
        expiresAt,
        isExpired: typeof expiresAt === "number" ? expiresAt <= nowMs : false,
      };
    })
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());

  return NextResponse.json({ files });
}

export async function DELETE(request: NextRequest) {
  const user = await readSessionToken(readSessionCookie(request));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as {
    url?: string;
    pathname?: string;
    room?: string;
  };

  const room = normalizeRoomCode(body.room ?? "");
  const pathname = body.pathname ?? "";
  const url = body.url ?? "";

  if (
    !isValidRoomCode(room) ||
    !pathname.startsWith(`uploads/${room}/`) ||
    !url.startsWith("https://")
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  await del(url);
  return NextResponse.json({ ok: true });
}
