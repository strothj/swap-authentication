import sign from "jsonwebtoken-esm/sign";
import verify from "jsonwebtoken-esm/verify";
import {
  Account,
  generateExpiration,
  IdTokenJwtPayload,
} from "../firebase/auth.js";
import { wait } from "../utils/utils.js";

/**
 * A mock of `globalThis#Response`.
 */
export type Response = Pick<
  globalThis.Response,
  "json" | "ok" | "status" | "statusText"
>;

/**
 * A mock of `globalThis#RequestInit`.
 */
export type RequestInit = {
  readonly body?: string;
  readonly headers?: Record<string, string>;
  readonly method?: string;
};

export type SessionTokensResponse = {
  readonly payload: {
    readonly expires_in: number;
    readonly id_token: string;
    readonly refresh_token: string;
  };
  readonly status: number;
};

const bearerTokenRegex = /^Bearer (.+)/;

function createUnauthorizedResponse(): Promise<Response> {
  return Promise.resolve({
    json: () =>
      Promise.resolve({
        code: 401,
        message: "...",
      }),
    ok: false,
    status: 401,
    statusText: "Unauthorized",
  });
}

/**
 * A mock of `globalThis#fetch`.
 */
export async function fetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  await wait(2000);

  if (
    url === "https://api.groceryswap.app/v1/session" &&
    init?.method === "POST"
  ) {
    const authorizationHeader = init.headers?.["Authorization"];
    if (!authorizationHeader) return createUnauthorizedResponse();

    const idTokenJwtMatch = bearerTokenRegex.exec(authorizationHeader);
    const idTokenJwt = idTokenJwtMatch?.[1];
    if (!idTokenJwt) return createUnauthorizedResponse();

    let idTokenJwtPayload: IdTokenJwtPayload;
    try {
      idTokenJwtPayload = verify(idTokenJwt, "secret");
    } catch {
      return createUnauthorizedResponse();
    }

    const accountString = localStorage.getItem(idTokenJwtPayload.email);
    if (!accountString) return createUnauthorizedResponse();
    let account = JSON.parse(accountString) as Account;

    const refreshToken = Date.now().toString();
    account = {
      ...account,
      refreshTokens: [...account.refreshTokens, refreshToken],
    };
    localStorage.setItem(idTokenJwtPayload.email, JSON.stringify(account));

    const response: SessionTokensResponse = {
      payload: {
        expires_in: idTokenJwtPayload.exp - Math.floor(Date.now() / 1000),
        id_token: idTokenJwt,
        refresh_token: refreshToken,
      },
      status: 201,
    };
    return {
      json: () => Promise.resolve(response),
      ok: true,
      status: 201,
      statusText: "Created",
    };
  }

  if (
    url === "https://api.groceryswap.app/v1/session/refresh" &&
    init?.method === "POST"
  ) {
    const authorizationHeader = init.headers?.["Authorization"];
    if (!authorizationHeader) return createUnauthorizedResponse();

    const refreshTokenMatch = bearerTokenRegex.exec(authorizationHeader);
    const refreshToken = refreshTokenMatch?.[1];
    if (!refreshToken) return createUnauthorizedResponse();

    const accounts: Account[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const accountKey = localStorage.key(i);
      if (accountKey === null || !accountKey.includes("@")) continue;
      const accountString = localStorage.getItem(accountKey);
      if (!accountString) continue;
      const account: Account = JSON.parse(accountString);
      accounts.push(account);
    }

    const account = accounts.find((account) =>
      account.refreshTokens.includes(refreshToken)
    );
    if (!account) return createUnauthorizedResponse();

    const idTokenJwtPayload: IdTokenJwtPayload = {
      email: account.email,
      exp: generateExpiration(),
      refresh_token: refreshToken,
      user_id: account.userId,
    };

    const idTokenJwt: string = sign(idTokenJwtPayload, "secret");
    const response: SessionTokensResponse = {
      payload: {
        expires_in: idTokenJwtPayload.exp - Math.floor(Date.now() / 1000),
        id_token: idTokenJwt,
        refresh_token: refreshToken,
      },
      status: 201,
    };
    return {
      json: () => Promise.resolve(response),
      ok: true,
      status: 201,
      statusText: "Created",
    };
  }

  if (url.startsWith("https://api.groceryswap.app/v1/product/")) {
    const authorizationHeader = init?.headers?.["Authorization"];
    if (!authorizationHeader) return createUnauthorizedResponse();

    const idTokenJwtMatch = bearerTokenRegex.exec(authorizationHeader);
    const idTokenJwt = idTokenJwtMatch?.[1];
    if (!idTokenJwt) return createUnauthorizedResponse();

    // TODO: Reject if parent refresh token has been invalidated.
    try {
      verify(idTokenJwt, "secret");
    } catch {
      return createUnauthorizedResponse();
    }

    return {
      json: () =>
        Promise.resolve({
          title: "Some product",
          current_price: 1.99,
          image: "https://www.example.com/image.jpg",
        }),
      ok: true,
      status: 200,
      statusText: "OK",
    };
  }

  return {
    json: () => Promise.resolve({}),
    ok: false,
    status: 404,
    statusText: "Not Found",
  };
}
