// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

test("createSession sets an httpOnly auth-token cookie", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "user@example.com");

  expect(mockCookieStore.set).toHaveBeenCalledOnce();
  const [name, , options] = mockCookieStore.set.mock.calls[0];
  expect(name).toBe("auth-token");
  expect(options.httpOnly).toBe(true);
  expect(options.sameSite).toBe("lax");
  expect(options.path).toBe("/");
});

test("createSession stores a valid JWT with userId and email", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "user@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("createSession sets cookie expiry to ~7 days", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Date.now();

  await createSession("user-1", "user@example.com");

  const after = Date.now();
  const [, , options] = mockCookieStore.set.mock.calls[0];
  const expiresMs = new Date(options.expires).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDays);
});

// --- verifySession ---

async function makeToken(payload: object, secret = JWT_SECRET, expiresIn = "7d") {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(secret);
}

function makeRequest(token: string | undefined) {
  return {
    cookies: { get: vi.fn().mockReturnValue(token ? { value: token } : undefined) },
  } as any;
}

test("verifySession returns session payload for a valid token", async () => {
  const { verifySession } = await import("@/lib/auth");
  const token = await makeToken({ userId: "user-42", email: "a@b.com" });

  const session = await verifySession(makeRequest(token));

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-42");
  expect(session!.email).toBe("a@b.com");
});

test("verifySession returns null when no auth-token cookie", async () => {
  const { verifySession } = await import("@/lib/auth");

  const session = await verifySession(makeRequest(undefined));

  expect(session).toBeNull();
});

test("verifySession returns null for a tampered token", async () => {
  const { verifySession } = await import("@/lib/auth");

  const session = await verifySession(makeRequest("not.a.valid.token"));

  expect(session).toBeNull();
});

test("verifySession returns null for an expired token", async () => {
  const { verifySession } = await import("@/lib/auth");
  const token = await makeToken({ userId: "u", email: "e" }, JWT_SECRET, "-1s");

  const session = await verifySession(makeRequest(token));

  expect(session).toBeNull();
});

test("verifySession returns null for a token signed with wrong secret", async () => {
  const { verifySession } = await import("@/lib/auth");
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await makeToken({ userId: "u", email: "e" }, wrongSecret);

  const session = await verifySession(makeRequest(token));

  expect(session).toBeNull();
});

test("verifySession returns null for an empty string token", async () => {
  const { verifySession } = await import("@/lib/auth");

  const session = await verifySession(makeRequest(""));

  expect(session).toBeNull();
});

test("verifySession returns expiresAt in the session payload", async () => {
  const { verifySession } = await import("@/lib/auth");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await makeToken({ userId: "u1", email: "e@e.com", expiresAt });

  const session = await verifySession(makeRequest(token));

  expect(session).not.toBeNull();
  expect(session!.expiresAt).toBeDefined();
});

// --- getSession ---

test("getSession returns session payload when auth-token cookie is valid", async () => {
  const { getSession } = await import("@/lib/auth");
  const token = await makeToken({ userId: "user-99", email: "x@y.com" });
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).not.toBeNull();
  expect(session!.userId).toBe("user-99");
  expect(session!.email).toBe("x@y.com");
});

test("getSession returns null when no auth-token cookie is present", async () => {
  const { getSession } = await import("@/lib/auth");
  mockCookieStore.get.mockReturnValue(undefined);

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const { getSession } = await import("@/lib/auth");
  const token = await makeToken({ userId: "u", email: "e" }, JWT_SECRET, "-1s");
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for a tampered token", async () => {
  const { getSession } = await import("@/lib/auth");
  mockCookieStore.get.mockReturnValue({ value: "tampered.token.value" });

  const session = await getSession();

  expect(session).toBeNull();
});

test("getSession returns null for a token signed with wrong secret", async () => {
  const { getSession } = await import("@/lib/auth");
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await makeToken({ userId: "u", email: "e" }, wrongSecret);
  mockCookieStore.get.mockReturnValue({ value: token });

  const session = await getSession();

  expect(session).toBeNull();
});

// --- deleteSession ---

test("deleteSession deletes the auth-token cookie", async () => {
  const { deleteSession } = await import("@/lib/auth");

  await deleteSession();

  expect(mockCookieStore.delete).toHaveBeenCalledOnce();
  expect(mockCookieStore.delete).toHaveBeenCalledWith("auth-token");
});

test("deleteSession does not throw when called multiple times", async () => {
  const { deleteSession } = await import("@/lib/auth");

  await expect(deleteSession()).resolves.toBeUndefined();
  await expect(deleteSession()).resolves.toBeUndefined();

  expect(mockCookieStore.delete).toHaveBeenCalledTimes(2);
});

// --- createSession additional edge cases ---

test("createSession includes expiresAt in the JWT payload", async () => {
  const { createSession } = await import("@/lib/auth");
  const before = Date.now();

  await createSession("user-1", "user@example.com");

  const [, token] = mockCookieStore.set.mock.calls[0];
  const { payload } = await jwtVerify(token, JWT_SECRET);

  expect(payload.expiresAt).toBeDefined();
  const expiresAt = new Date(payload.expiresAt as string).getTime();
  expect(expiresAt).toBeGreaterThanOrEqual(before);
});

test("createSession sets secure: false outside of production", async () => {
  const { createSession } = await import("@/lib/auth");

  await createSession("user-1", "user@example.com");

  const [, , options] = mockCookieStore.set.mock.calls[0];
  expect(options.secure).toBe(false);
});
