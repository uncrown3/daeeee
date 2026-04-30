import type { ListBlobResultBlob } from "@vercel/blob";

const ROOM_PATTERN = /^[a-z0-9-]{3,40}$/;

export function normalizeRoomCode(room: string) {
  return room.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function isValidRoomCode(room: string) {
  return ROOM_PATTERN.test(room);
}

export function makeBlobPath(room: string, fileName: string, expiresAtMs: number) {
  const safeName = fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(-80);

  return `uploads/${room}/${expiresAtMs}-${crypto.randomUUID()}-${safeName || "file"}`;
}

export function getExpiryFromPath(pathname: string) {
  const file = pathname.split("/").pop();
  if (!file) {
    return null;
  }

  const [timestamp] = file.split("-");
  const expiresAt = Number(timestamp);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }

  return expiresAt;
}

export function isExpiredBlob(blob: ListBlobResultBlob, nowMs: number) {
  const expiresAt = getExpiryFromPath(blob.pathname);
  return typeof expiresAt === "number" && expiresAt <= nowMs;
}
