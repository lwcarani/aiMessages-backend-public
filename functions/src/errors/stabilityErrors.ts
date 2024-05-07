type ErrorName =
  | "STABILITY_AI_ERROR";

/**
 * Error class for Stability AI API errors
 */
export class StabilityError extends Error {
  name: ErrorName;
  message: string;
  cause: string;
  code: number;

  /**
   * @param {{code: number, cause: any}} code - The error code and cause
   */
  constructor({
    message,
    code,
    cause,
  }: {
    message: string
    code: number,
    cause: string
  }) {
    super();
    this.code = code;
    this.cause = cause;
    this.message = message;
    this.name = "STABILITY_AI_ERROR";
  }
}
