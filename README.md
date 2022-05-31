# Authorization Requirements Document

## Overview

### Purpose

The purpose of this document is to lay out the workings of the API request
authorization process.

### Problems

The problems this feature solves are:

- Ensuring that data can only be retrieved and modified by the user who it
  belongs to
- Allowing a smooth web signup to installed extension transition with session
  persistence

### Vision

The vision for this feature is that a user should be able to sign up using the
website and be signed into the extension. The extension should be signed in
using the credential provided by the signup flow. The user should not be
prompted to login in the extension after signing up from the website. The
extension should be able to persist the session, i.e., not have a session
expire.

## Users

### Stories

| Story                                                                                                       | Notes | Priority  |
| ----------------------------------------------------------------------------------------------------------- | ----- | --------- |
| As a User, I want to be able to sign up on the website and be immediately signed into the browser extension |       | Must-Have |

## Functional Requirements

- The website signup process acquires a Firebase ID Token.
- The website makes a request to the API to acquire a Refresh Token.
- The website passes the extension both the ID Token and the Refresh Token.
- The browser extension requests new ID Tokens upon expiry using the Refresh Token.

## Non-Functional Requirements

None

## Risks

- Increased development and deployment complexity
- Flows are required to handle invalided Refresh Tokens.
  - Refresh Tokens may be invalided by password resets or account security
    breaches.

## Additional Links

An example of a possible flow is available at the following repository, with a
live example:

- Mock implementation code samples
  - https://github.com/strothj/swap-authentication
- Mock implementation live example
  - https://app.netlify.com/sites/swap-authentication/overview
- Mock extension code sample:
  - https://github.com/strothj/swap-authentication/blob/6e89dafdd08236f40c28c4d4c8d4e62e7fdc5d35/src/extension.ts

## Implementation

### Website

The website sign in and sign up flows will pass the Firebase _ID Token_ to the
browser extension.

### Extension

#### Extension Installation

- The extension checks if it was passed a Firebase _ID Token_. If it was, it
  exchanges the _ID Token_ for a _Refresh Token_.
- It stores both the _ID Token_ and _Refresh Token_ for future API requests.

##### Session Token Request Response Type

```typescript
/**
 * The response from either a Create Session Tokens request or a Refresh Session
 * Token request.
 */
type SessionTokensResponse = {
  /**
   * Response payload.
   */
  readonly payload: {
    /**
     * The number of seconds before the returned ID Token expires.
     */
    readonly expires_in: number;

    /**
     * An ID Token.
     */
    readonly id_token: string;

    /**
     * An Refresh Token.
     */
    readonly refresh_token: string;
  };

  /**
   * HTTP response status code.
   */
  readonly status: number;
};
```

##### Request for a Refresh Token

```typescript
/**
 * Given an ID Token, a Refresh Token is returned.
 */
async function fetchRefreshToken(idTokenJwt: string): Promise<string> {
  const response = await fetch("https://api.groceryswap.app/v1/session", {
    headers: { Authorization: `Bearer ${idTokenJwt}` },
    method: "POST",
  });
  if (!response.ok) throw new Error("Session invalid.");

  const createSessionTokensResponse: SessionTokensResponse =
    await response.json();
  return createSessionTokensResponse.payload.refresh_token;
}
```

##### Persisting the Session

```typescript
type Session = {
  readonly idTokenJwt: string;
  readonly refreshToken: string;
};

const refreshToken = await fetchRefreshToken(idTokenJwt);
const session: Session = {
  idTokenJwt,
  refreshToken,
};
localStorage.setItem("session", JSON.stringify(session));
```

#### Extension API Request

The extension will retrieve its persisted session and use its stored credentials
to make an API request.

If the initial request returns an authorization error, is should request a
refreshed _ID Token_.

```typescript
function createApiRequest(session: Session) {
  return fetch("https://api.groceryswap.app/v1/product/abc123", {
    headers: {
      Authorization: `Bearer ${session.idTokenJwt}`,
    },
  });
}

const sessionString = localStorage.getItem("session");
if (!sessionString) throw new Error("Signed out.");
let session: Session = JSON.parse(sessionString);

// Attempt the initial API request with the current credentials.
let response = await createApiRequest(session);

// If the ID Token is expired, attempt to refresh it.
if (response.status === 401 || response.status === 403) {
  response = await fetch("https://api.groceryswap.app/v1/session/refresh", {
    headers: { Authorization: `Bearer ${session.refreshToken}` },
    method: "POST",
  });
  if (!response.ok) throw new Error("Session invalid.");

  // Persist the retrieved credentials.
  const responseBody: SessionTokensResponse = await response.json();
  session = {
    idTokenJwt: responseBody.payload.id_token,
    refreshToken: responseBody.payload.refresh_token,
  };
  localStorage.setItem("session", JSON.stringify(session));

  // Retry with refreshed credentials.
  response = await createApiRequest(session);
}

if (!response.ok) throw new Error("Request failed.");

// Use successful response.
```
