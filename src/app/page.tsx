import { cookies } from "next/headers";
import ConnectApp from "@/components/connect-app";
import { getSessionCookieName, readSessionToken } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const sessionUser = await readSessionToken(token);

  return <ConnectApp initialUser={sessionUser} />;
}
