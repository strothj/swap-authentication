import { SessionTokensResponse, fetch } from "#fetch";
import decode from "jsonwebtoken-esm/decode";
import type { IdTokenJwtPayload } from "./firebase/auth.js";
import { assertIsElement } from "./utils/utils.js";

type ElementDefinitions = typeof elementDefinitions;

type Elements = {
  [P in keyof ElementDefinitions]: HTMLElementTagNameMap[ElementDefinitions[P][0]];
};

type Session = {
  readonly idTokenJwt: string;
  readonly refreshToken: string;
};

const elementDefinitions = {
  apiButtonElement: ["button", "api-button"] as const,
  apiTextPreElement: ["pre", "api-text"] as const,
  // invalidateButtonElement: ["button", "invalidate-button"] as const,
  sessionTextPreElement: ["pre", "session-text"] as const,
  signOutButtonElement: ["button", "sign-out-button"] as const,
} as const;

let isApiCallInFlight = false;

function main(): void {
  window.addEventListener("DOMContentLoaded", handleDOMContentLoaded);
}

function getElements(): Elements {
  return Object.entries(elementDefinitions).reduce(
    (accumulator, [key, [tagName, id]]) => {
      const element = document.getElementById(id);
      assertIsElement(tagName, element);
      // @ts-expect-error Ignore generic typing issue.
      accumulator[key] = element;
      return accumulator;
    },
    {} as Elements
  );
}

function setButtons(elements: Elements, disabled: boolean) {
  Object.values(elements)
    .filter(
      (element): element is HTMLButtonElement => element.tagName === "BUTTON"
    )
    .forEach((element) => {
      if (disabled) {
        element.setAttribute("disabled", "");
        return;
      }

      if (isApiCallInFlight) return;

      element.removeAttribute("disabled");
    });
}

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

async function handleDOMContentLoaded(): Promise<void> {
  const elements = getElements();

  // To log out the user from the browser extension, we just clear the persisted
  // session information.
  elements.signOutButtonElement.addEventListener("click", () => {
    localStorage.removeItem("session");
  });

  // Dispatch an API call using the current credentials, refreshing it if it is
  // expired.
  elements.apiButtonElement.addEventListener("click", async () => {
    function createApiRequest(session: Session) {
      return fetch("https://api.groceryswap.app/v1/product/abc123", {
        headers: {
          Authorization: `Bearer ${session.idTokenJwt}`,
        },
      });
    }

    try {
      isApiCallInFlight = true;
      setButtons(elements, true);

      const sessionString = localStorage.getItem("session");
      if (!sessionString) throw new Error("Signed out.");
      let session: Session = JSON.parse(sessionString);

      // Attempt the initial API request with the current credentials.
      let response = await createApiRequest(session);

      // If the ID Token is expired, attempt to refresh it.
      if (response.status === 401 || response.status === 403) {
        response = await fetch(
          "https://api.groceryswap.app/v1/session/refresh",
          {
            headers: { Authorization: `Bearer ${session.refreshToken}` },
            method: "POST",
          }
        );
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
      elements.apiTextPreElement.textContent = `Date: ${new Date().toString()}\n\n${JSON.stringify(
        await response.json(),
        null,
        2
      )}`;
    } catch (error) {
      elements.apiTextPreElement.textContent = `Date: ${new Date().toString()}\n\n${
        error instanceof Error ? error.message : error
      }`;
    } finally {
      isApiCallInFlight = false;
      setButtons(elements, false);
    }
  });

  // On installation of the extension, it should receive a valid Firebase ID
  // Token. It should exchange it for a refresh token so that it can remain
  // logged in.
  const url = new URL(document.location.href);
  const idTokenJwt = url.searchParams.get("id-token");
  if (idTokenJwt) {
    history.replaceState({}, "", document.location.href.replace(/\?.*/, ""));

    try {
      const refreshToken = await fetchRefreshToken(idTokenJwt);
      const session: Session = {
        idTokenJwt,
        refreshToken,
      };
      localStorage.setItem("session", JSON.stringify(session));
    } catch {
      elements.sessionTextPreElement.textContent = "Session invalid.";
      return;
    }
  }

  // Display the current session's ID Token. This is an example in case there's
  // a reason to know the ID Token expiration time.
  setInterval(() => {
    const sessionString = localStorage.getItem("session");
    if (!sessionString) {
      elements.sessionTextPreElement.textContent = "Signed out.";
      setButtons(elements, true);
      return;
    }
    const session: Session = JSON.parse(sessionString);

    const idTokenJwtPayload: IdTokenJwtPayload = decode(session.idTokenJwt);
    const expiresIn = idTokenJwtPayload.exp - Math.floor(Date.now() / 1000);
    elements.sessionTextPreElement.textContent = `Date: ${new Date().toString()}\n\nID Token JWT Payload:\n${JSON.stringify(
      {
        ...idTokenJwtPayload,
        expires_in: expiresIn >= 0 ? expiresIn : "(expired)",
      },
      null,
      2
    )}`;
    setButtons(elements, false);
  }, 1000);
}

main();
