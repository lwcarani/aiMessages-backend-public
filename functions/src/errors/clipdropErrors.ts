type ErrorName =
  | "CLIPDROP_ERROR";

/**
 * Error class for Clipdrop API errors
 */
export class ClipdropError extends Error {
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
    this.name = "CLIPDROP_ERROR";
  }
}
