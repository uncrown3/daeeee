import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieName,
  getSessionTtlSeconds,
  validateCredentials,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email ?? "";
  const password = body.password ?? "";

  const user = validateCredentials(email, password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await createSessionToken(user);

  const response = NextResponse.json({ user });
  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getSessionTtlSeconds(),
  });

  return response;
}
