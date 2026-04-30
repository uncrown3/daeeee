import { del, list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { isExpiredBlob } from "@/lib/blob-utils";

function isAuthorizedCron(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${configuredSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const nowMs = Date.now();
  const result = await list({
    prefix: "uploads/",
    mode: "folded",
  });

  const expiredFiles = result.blobs.filter((blob) => isExpiredBlob(blob, nowMs));

  if (expiredFiles.length > 0) {
    await del(expiredFiles.map((blob) => blob.url));
  }

  return NextResponse.json({
    scanned: result.blobs.length,
    deleted: expiredFiles.length,
    nowMs,
  });
}
