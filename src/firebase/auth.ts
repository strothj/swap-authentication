import sign from "jsonwebtoken-esm/sign";
import type { Opaque } from "type-fest";
import { wait } from "../utils/index.js";

/**
 * A mock of `firebase/auth#Auth`.
 */
export type Auth = Opaque<string, "Auth">;

/**
 * A mock of `firebase/auth#User`.
 */
export type User = {
  getIdToken(): Promise<string>;
};

/**
 * A mock of `firebase/auth#UserCredential`.
 */
export type UserCredential = {
  user: User;
};

/**
 * A mock of `firebase/auth#getAuth`.
 */
export function getAuth(): Auth {
  return "" as Auth;
}

/**
 * A mock Firebase account record.
 */
export type Account = {
  readonly email: string;
  readonly password: string;
  readonly refreshTokens: readonly string[];
  readonly userId: string;
};

/**
 * A mock Firebase ID Token encoded JWT.
 *
 * A real one looks something like this:
 *
 * ```json
 * {
 *   "email": "postman@example.com",
 *   "email_verified": false,
 *   "auth_time": 1651860020,
 *   "user_id": "GXNKLvy36muGzN7zkgcQ8reRJbfx",
 *   "firebase": {
 *     "identities": {
 *       "email": [
 *         "postman@example.com"
 *       ]
 *     },
 *    "sign_in_provider": "password"
 *   },
 *   "iat": 1651860020,
 *   "exp": 1651863620,
 *   "aud": "swap-api-336521",
 *   "iss": "https://securetoken.google.com/swap-api-336521",
 *   "sub": "GXNKLvy36muGzN7zkgcQ8reRJbfx"
 * }
 * ```
 */
export type IdTokenJwtPayload = {
  readonly email: string;
  readonly exp: number;
  readonly refresh_token: string;
  readonly user_id: string;
};

/**
 * Generates the JWT `exp` field as a date 60 seconds in the future.
 */
export function generateExpiration(): number {
  return Math.floor(Date.now() / 1000) + 60;
}

/**
 * A mock of `firebase/auth#createUserWithEmailAndPassword`.
 */
export async function createUserWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  await wait(2000);

  const accountString = localStorage.getItem(email);
  if (accountString) throw new Error("Email not available.");

  const refreshToken = Date.now().toString();

  const userId = Date.now().toString();

  const account: Account = {
    email,
    password,
    refreshTokens: [refreshToken],
    userId,
  };
  localStorage.setItem(email, JSON.stringify(account));

  const idTokenJwtPayload: IdTokenJwtPayload = {
    email,
    exp: generateExpiration(),
    refresh_token: refreshToken,
    user_id: userId,
  };

  const idTokenJwt: string = sign(idTokenJwtPayload, "secret");

  return Promise.resolve({
    user: {
      getIdToken: () => Promise.resolve(idTokenJwt),
    },
  });
}

export async function signInWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
): Promise<UserCredential> {
  await wait(2000);

  const accountString = localStorage.getItem(email);
  if (!accountString) throw new Error("Wrong email or password.");

  let account = JSON.parse(accountString) as Account;
  if (password !== account.password) {
    throw new Error("Wrong email or password.");
  }

  const refreshToken = Date.now().toString();

  account = {
    ...account,
    refreshTokens: [...account.refreshTokens, refreshToken],
  };
  localStorage.setItem(email, JSON.stringify(account));

  const idTokenJwtPayload: IdTokenJwtPayload = {
    email,
    exp: generateExpiration(),
    refresh_token: refreshToken,
    user_id: account.userId,
  };

  const idTokenJwt: string = sign(idTokenJwtPayload, "secret");

  return Promise.resolve({
    user: {
      getIdToken: () => Promise.resolve(idTokenJwt),
    },
  });
}
