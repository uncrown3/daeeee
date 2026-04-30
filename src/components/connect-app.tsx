"use client";

import { JitsiMeeting } from "@jitsi/react-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeRoomCode } from "@/lib/blob-utils";
import type { SessionUser } from "@/lib/auth";

type FileItem = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  expiresAt: number | null;
  isExpired: boolean;
};

type Props = {
  initialUser: SessionUser | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ConnectApp({ initialUser }: Props) {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roomInput, setRoomInput] = useState("private-room");
  const [activeRoom, setActiveRoom] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isUploadLoading, setIsUploadLoading] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState("");

  const roomCode = useMemo(() => normalizeRoomCode(roomInput), [roomInput]);
  const inviteRoom = activeRoom || roomCode;

  const inviteUrl = useMemo(() => {
    if (!inviteRoom || typeof window === "undefined") {
      return "";
    }

    return `${window.location.origin}/?room=${encodeURIComponent(inviteRoom)}`;
  }, [inviteRoom]);

  const copyInviteLink = useCallback(async () => {
    if (!inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 1500);
  }, [inviteUrl]);

  const loadFiles = useCallback(async (roomOverride?: string) => {
    const roomToLoad = roomOverride ?? activeRoom;
    if (!roomToLoad) {
      return;
    }

    const response = await fetch(`/api/files?room=${encodeURIComponent(roomToLoad)}`);
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { files: FileItem[] };
    setFiles(data.files);
  }, [activeRoom]);

  const joinRoom = useCallback(
    async (nextRoomRaw: string) => {
      const nextRoom = normalizeRoomCode(nextRoomRaw);
      if (nextRoom.length < 3) {
        return;
      }

      setRoomInput(nextRoom);
      setActiveRoom(nextRoom);
      setError("");
      await loadFiles(nextRoom);
    },
    [loadFiles],
  );

  useEffect(() => {
    if (!activeRoom) {
      return;
    }

    const timer = setInterval(loadFiles, 30000);
    return () => clearInterval(timer);
  }, [activeRoom, loadFiles]);

  useEffect(() => {
    const roomFromLink = normalizeRoomCode(searchParams.get("room") ?? "");

    if (!user || !roomFromLink || activeRoom === roomFromLink) {
      return;
    }

    const timer = window.setTimeout(() => {
      void joinRoom(roomFromLink);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeRoom, joinRoom, searchParams, user]);

  async function onLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsAuthLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Login failed.");
        return;
      }

      const data = (await response.json()) as { user: SessionUser };
      setUser(data.user);
      setPassword("");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function onLogout() {
    await fetch("/api/logout", { method: "POST" });
    setUser(null);
    setActiveRoom("");
    setFiles([]);
    setError("");
  }

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRoom) {
      return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      setError("Please choose a file.");
      return;
    }

    setIsUploadLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("room", activeRoom);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Upload failed.");
        return;
      }

      form.reset();
      await loadFiles();
    } finally {
      setIsUploadLoading(false);
    }
  }

  async function removeFile(file: FileItem) {
    if (!activeRoom) {
      return;
    }

    const response = await fetch("/api/files", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        room: activeRoom,
        pathname: file.pathname,
        url: file.url,
      }),
    });

    if (response.ok) {
      await loadFiles();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-sky-50 to-emerald-50 text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <section className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
                Vercel Connect
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">
                Secure two-person call and file share
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                Files uploaded in a room are auto-deleted after 2 hours.
              </p>
            </div>
            {user ? (
              <button
                onClick={onLogout}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Logout
              </button>
            ) : null}
          </div>
        </section>

        {!user ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-lg font-semibold">Login</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use one of the configured users from APP_USERS_JSON.
            </p>
            <form className="mt-4 grid gap-3 sm:max-w-md" onSubmit={onLogin}>
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                disabled={isAuthLoading}
                className="rounded-lg bg-sky-700 px-4 py-2 font-medium text-white hover:bg-sky-600 disabled:opacity-60"
              >
                {isAuthLoading ? "Logging in..." : "Login"}
              </button>
            </form>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          </section>
        ) : (
          <>
            <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[2fr_1fr] sm:items-end sm:p-7">
              <div>
                <p className="text-sm text-slate-600">Logged in as {user.name}</p>
                <label className="mt-2 block text-sm font-medium text-slate-800">
                  Room code
                </label>
                <input
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <button
                onClick={() => void joinRoom(roomCode)}
                disabled={roomCode.length < 3}
                className="h-11 rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                Join room
              </button>
            </section>

            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-base font-semibold">Invite link</h3>
              <p className="text-xs text-slate-600">
                Share this link so the other person opens the exact same room instantly.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={inviteUrl || "Join a room to generate link"}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                />
                <button
                  onClick={() => void copyInviteLink()}
                  disabled={!inviteUrl}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {inviteCopied ? "Copied" : "Copy"}
                </button>
              </div>
            </section>

            {activeRoom ? (
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-4">
                  <JitsiMeeting
                    roomName={`vercel-connect-${activeRoom}`}
                    configOverwrite={{
                      prejoinPageEnabled: false,
                    }}
                    getIFrameRef={(node) => {
                      node.style.height = "68vh";
                      node.style.width = "100%";
                      node.style.borderRadius = "12px";
                    }}
                  />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <h3 className="text-base font-semibold">Room files</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Files are deleted automatically within 2 hours.
                  </p>

                  <form className="mt-3 grid gap-2" onSubmit={onUpload}>
                    <input
                      name="file"
                      type="file"
                      className="rounded-lg border border-slate-300 p-2 text-sm"
                    />
                    <button
                      disabled={isUploadLoading}
                      className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-60"
                    >
                      {isUploadLoading ? "Uploading..." : "Upload"}
                    </button>
                  </form>

                  <ul className="mt-4 grid gap-2">
                    {files.map((file) => (
                      <li
                        key={file.pathname}
                        className="rounded-lg border border-slate-200 p-3 text-sm"
                      >
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-sky-700 hover:underline"
                        >
                          Open file
                        </a>
                        <p className="mt-1 text-xs text-slate-600">
                          {formatBytes(file.size)}
                        </p>
                        {file.expiresAt ? (
                          <p className="mt-1 text-xs text-slate-600">
                            Expires {new Date(file.expiresAt).toLocaleTimeString()}
                          </p>
                        ) : null}
                        <button
                          onClick={() => removeFile(file)}
                          className="mt-2 text-xs font-medium text-red-600 hover:underline"
                        >
                          Delete now
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
