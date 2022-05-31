/**
 * A utility function which performs a type assertion on the passed `element`.
 * It asserts that is the HTMLElement type specified by `tagName`.
 */
export function assertIsElement<
  HTMLElementTagName extends keyof HTMLElementTagNameMap
>(
  tagName: HTMLElementTagName,
  element: HTMLElement | null
): asserts element is HTMLElementTagNameMap[HTMLElementTagName] {
  const expectedTagName = tagName.toUpperCase();
  const actualTagName = element?.tagName.toUpperCase();
  if (element === null || actualTagName !== expectedTagName) {
    throw new Error(
      `Expected element to not be null and have a tag name of "${expectedTagName}", was "${actualTagName}".`
    );
  }

  setTimeout(() => {}, 0);
}

/**
 * A wrapper around `setTimeout` which is promisified.
 */
export function setTimeoutPromise(
  callback: () => Promise<void> | void,
  ms?: number,
  abortSignal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      if (abortSignal?.aborted) return;
      try {
        await callback();
        resolve();
      } catch (error) {
        reject(error);
      }
    }, ms);
  });
}

/**
 * A utility function which adds an artificial delay to emulate network and
 * processing latency.
 */
export function wait(ms: number) {
  return setTimeoutPromise(() => {}, ms);
}
