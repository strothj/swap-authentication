import { getAuth, signInWithEmailAndPassword } from "#firebase/auth";
import { assertIsElement } from "./utils/index.js";

/**
 * Main entry point to the signup page.
 *
 * Attaches a listener to the `DOMContentLoaded` event, which in this example is
 * similar in function to something like `ReactDOM.render` or
 * `ReactDOM.createRoot`.
 */
function main(): void {
  window.addEventListener("DOMContentLoaded", handleDOMContentLoaded);
}

/**
 * Resolves references to the HTML elements and adds the form submit event
 * handler.
 */
function handleDOMContentLoaded(): void {
  const formElement = document.getElementById("form");
  assertIsElement("form", formElement);
  const emailInputElement = document.getElementById("email");
  assertIsElement("input", emailInputElement);
  const passwordInputElement = document.getElementById("password");
  assertIsElement("input", passwordInputElement);
  const submitButtonElement = document.getElementById("submit-button");
  assertIsElement("button", submitButtonElement);
  const submitSpinnerSpanElement = document.getElementById("submit-spinner");
  assertIsElement("span", submitSpinnerSpanElement);
  const submitTextSpanElement = document.getElementById("submit-text");
  assertIsElement("span", submitTextSpanElement);
  const toastDivElement = document.getElementById("toast");
  assertIsElement("div", toastDivElement);
  const toastBodyDivElement = document.getElementById("toast-body");
  assertIsElement("div", toastBodyDivElement);

  formElement.addEventListener(
    "submit",
    createSubmitHandler(
      emailInputElement,
      passwordInputElement,
      submitButtonElement,
      submitSpinnerSpanElement,
      submitTextSpanElement,
      toastDivElement,
      toastBodyDivElement
    )
  );
}

/**
 * Displays an error toast message.
 */
function displayErrorToast(
  toastDivElement: HTMLDivElement,
  toastBodyDivElement: HTMLDivElement,
  message: string
): void {
  toastBodyDivElement.textContent = message;
  const toast = new bootstrap.Toast(toastDivElement);
  toast.show();
}

/**
 * Signs in the user using the fields from the sign in form, then passes the ID
 * token to the browser extension.
 */
function createSubmitHandler(
  emailInputElement: HTMLInputElement,
  passwordInputElement: HTMLInputElement,
  submitButtonElement: HTMLButtonElement,
  submitSpinnerSpanElement: HTMLSpanElement,
  submitTextSpanElement: HTMLSpanElement,
  toastDivElement: HTMLDivElement,
  toastBodyDivElement: HTMLDivElement
): (event: SubmitEvent) => void {
  return async function handleSubmit(event) {
    event.preventDefault();

    const email = emailInputElement.value;
    if (email.length === 0) {
      displayErrorToast(
        toastDivElement,
        toastBodyDivElement,
        "Please enter an email."
      );
      return;
    }
    const password = passwordInputElement.value;
    if (password.length === 0) {
      displayErrorToast(
        toastDivElement,
        toastBodyDivElement,
        "Please enter an password."
      );
      return;
    }

    emailInputElement.setAttribute("disabled", "");
    passwordInputElement.setAttribute("disabled", "");
    submitButtonElement.setAttribute("disabled", "");
    submitSpinnerSpanElement.classList.remove("d-none");

    const originalSubmitTextSpanTextContent = submitTextSpanElement.textContent;
    submitTextSpanElement.textContent = "Submitting...";

    const auth = getAuth();

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const idToken = await userCredential.user.getIdToken();
      document.location.href = `/extension.html?id-token=${idToken}`;
    } catch (error) {
      emailInputElement.removeAttribute("disabled");
      passwordInputElement.removeAttribute("disabled");
      submitButtonElement.removeAttribute("disabled");
      submitSpinnerSpanElement.classList.add("d-none");
      submitTextSpanElement.textContent = originalSubmitTextSpanTextContent;

      displayErrorToast(
        toastDivElement,
        toastBodyDivElement,
        error instanceof Error ? error.message : ""
      );
    }
  };
}

main();
