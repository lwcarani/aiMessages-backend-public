type ErrorName =
  | "OPENAI_API_ERROR"
  | "OPENAI_API_ERROR_CODE_401"
  | "OPENAI_API_ERROR_CODE_429"
  | "OPENAI_API_ERROR_CODE_500"
  | "OPENAI_API_ERROR_CODE_UNKNOWN";

type ErrorMessages = {
  [name in ErrorName]: string;
};

export const OPENAI_ERROR_MESSAGES: ErrorMessages = {
  OPENAI_API_ERROR: "OpenAI error.",
  OPENAI_API_ERROR_CODE_401: "OpenAI servers had an error " +
    "while processing your request. Please retry your request " +
    "after a brief wait, and contact us if the issue persists.",
  OPENAI_API_ERROR_CODE_429: "OpenAI servers are currently " +
    "experiencing higher than normal traffic. Please retry " +
    "your request after a brief wait.",
  OPENAI_API_ERROR_CODE_500: "OpenAI servers had an error " +
    "while processing your request. Please retry your request " +
    "after a brief wait, and contact us if the issue persists.",
  OPENAI_API_ERROR_CODE_UNKNOWN: "OpenAI servers had an unknown error " +
    "while processing your request. Please retry your request " +
    "after a brief wait, and contact us if the issue persists.",
};

/**
 * Error class for Openai API errors
 */
export class OpenAIApiError extends Error {
  name: ErrorName;
  message: string;
  cause: any;
  code: number;

  /**
   * @param {{code: number, cause: any}} code - The error code and cause
   */
  constructor({
    code,
    cause,
  }: {
    code: number,
    cause?: any
  }) {
    super();
    this.code = code;
    this.cause = cause;
    // check to see if OpenAI returned an error message
    // otherwise, just user one of the generic error messages
    const openaiErrorMessage: string =
      cause?.response?.data?.error?.message ?? "";
    if (openaiErrorMessage) {
      this.name = "OPENAI_API_ERROR";
      this.message = openaiErrorMessage;
    } else {
      switch (code) {
      case 401:
        this.name = "OPENAI_API_ERROR_CODE_401";
        this.message = OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_401;
        break;
      case 429:
        this.name = "OPENAI_API_ERROR_CODE_429";
        this.message = OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_429;
        break;
      case 500:
        this.name = "OPENAI_API_ERROR_CODE_500";
        this.message = OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_500;
        break;
      default:
        this.name = "OPENAI_API_ERROR_CODE_UNKNOWN";
        this.message = OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_UNKNOWN;
      }
    }
  }
}
