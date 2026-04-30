import { jwtVerify, SignJWT } from "jose";

const SESSION_COOKIE_NAME = "vc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24;

export type SessionUser = {
  email: string;
  name: string;
};

type ConfigUser = SessionUser & {
  password: string;
};

function getSecretKey() {
  const fallback = "dev-only-secret-change-in-production";
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? fallback);
}

function getConfiguredUsers(): ConfigUser[] {
  const raw = process.env.APP_USERS_JSON;

  if (!raw) {
    return [
      {
        email: "demo1@example.com",
        name: "Demo User 1",
        password: "Pass123!",
      },
      {
        email: "demo2@example.com",
        name: "Demo User 2",
        password: "Pass123!",
      },
    ];
  }

  try {
    const parsed = JSON.parse(raw) as ConfigUser[];
    return parsed.filter((user) =>
      Boolean(user.email && user.name && user.password),
    );
  } catch {
    return [];
  }
}

export function validateCredentials(
  email: string,
  password: string,
): SessionUser | null {
  const normalizedEmail = email.trim().toLowerCase();
  const matchedUser = getConfiguredUsers().find(
    (user) =>
      user.email.toLowerCase() === normalizedEmail && user.password === password,
  );

  if (!matchedUser) {
    return null;
  }

  return {
    email: matchedUser.email,
    name: matchedUser.name,
  };
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    email: user.email,
    name: user.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function readSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSecretKey());

    if (typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      email: payload.email,
      name: payload.name,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function getSessionTtlSeconds() {
  return SESSION_TTL_SECONDS;
}
