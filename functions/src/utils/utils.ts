// // standard imports
import {encode} from "gpt-3-encoder";
import {ChatCompletionRequestMessage} from "openai";

// // custom imports
// constants.ts
import {
  MAX_MESSAGE_HISTORY,
  LOOP_CHARACTER_LIMIT,
  Status,
  ConsumableProductID,
  PurchaseType,
  TOKEN_BUFFER,
  GPT35_TURBO_MAX_TOKENS,
} from "../globals";

/**
 * Checks auth header from incoming webhook request and returns
 * an object with the status code and message to send back to the webhook
 * @param {string | undefined} authHeader
 * @param {string} loopAuthBearerToken
 * @return {{number, string}}
 */
export function verifyAuthHeader(
  authHeader: string | undefined,
  loopAuthBearerToken: string
): {statusCode: number, httpsResponseMessage: string} {
  if (!authHeader) {
    console.log("Authorization header is missing");
    console.log("Exiting auth flow, no message response sent.");
    return {
      statusCode: 401,
      httpsResponseMessage: "Authorization header is missing",
    };
  } else {
    const [authType, authToken] = authHeader.split(" ");
    if (authType !== "Bearer" || !authToken) {
      console.log("Invalid authorization token");
      console.log("Exiting auth flow, no message response sent.");
      return {
        statusCode: 401,
        httpsResponseMessage: "Invalid authorization header",
      };
    } else if (authToken !== loopAuthBearerToken) {
      console.log("Invalid authorization token");
      console.log("Exiting auth flow, no message response sent.");
      return {
        statusCode: 401,
        httpsResponseMessage: "Invalid authorization token",
      };
    } else {
      console.log("Received message with valid authorization header!");
      return {
        statusCode: 200,
        httpsResponseMessage: "Message received!",
      };
    }
  }
}

/**
 * Converts a base64 string to a File object containing a png image
 * that we can send to OpenAI's API
 * @param {string} base64String
 * @return {File}
 */
export function base64StringToPngFile(base64String: string): File {
  // Convert the Base64 string to a Buffer object
  const buffer: Buffer = Buffer.from(base64String, "base64");
  // Cast the buffer to `any` so that we can set the `name` property
  const file: any = buffer;
  // Set a `name` that ends with .png so that the API knows it's a PNG image
  file.name = "image.png";
  return file;
}

/**
 * Breaks a string into an array of strings if it exceeds Loop's
 * character limit for messages
 * @param {string} inputString
 * @return {string[]}
 */
export function breakStringIntoChunks(inputString: string): string[] {
  const chunks: string[] = [];
  const length = inputString.length;
  let start = 0;

  if (length > LOOP_CHARACTER_LIMIT) {
    while (start < length) {
      const end = Math.min(start + LOOP_CHARACTER_LIMIT, length);
      chunks.push(inputString.substring(start, end));
      start += LOOP_CHARACTER_LIMIT;
    }
  } else {
    chunks.push(inputString);
  }

  return chunks;
}

/**
 * Checks if string passed as parameter is a valid Status,
 * i.e., checks if it complies with the established enum Status
 * @param {string} value
 * @return {boolean}
 */
export function isValidStatus(value: string): value is Status {
  return Object.values(Status).includes(value as Status);
}

/**
 * Checks if string passed as parameter is a valid ConsumableProductID,
 * i.e., checks if it complies with the established enum ConsumableProductID
 * @param {string} value
 * @return {boolean}
 */
export function isValidConsumableProductID(
  value: string): value is ConsumableProductID {
  return Object
    .values(ConsumableProductID)
    .includes(value as ConsumableProductID);
}

/**
 * @param {string} productID
 * @return {number}
 */
export function parseNumberOfMessageCredits(productID: string): number {
  return Number(productID.match(/\d+/));
}

/**
 * Checks if string passed as parameter is a valid PurchaseType,
 * i.e., checks if it complies with the established enum PurchaseType
 * @param {string} value
 * @return {boolean}
 */
export function isValidPurchaseType(
  value: string): value is PurchaseType {
  return Object
    .values(PurchaseType)
    .includes(value as PurchaseType);
}

/**
 * @param {string} str
 * @return {Promise<string>}
*/
export async function hashString(str: string): Promise<string> {
  // lazy load crypto
  const crypto = await import("crypto");

  const hash = crypto.createHash("sha256").update(str.slice(0, 50)).digest();
  const hashString = hash.toString("hex");
  return hashString.slice(0, 50);
}

/**
 * @param {string} str
 * @return {string}
 */
export function extractQuotedText(str: string): string {
  const start = str.indexOf("\"");
  const end = str.lastIndexOf("\"");
  if (start === -1 || end === -1 || start === end) {
    return "";
  }

  str = str.slice(start + 1, end);

  return str.replace(/\.{3,}/g, "");
}

/**
 *
 * @param {string} botName
 * @param {string} text
 * @return {boolean}
 */
export function doesTextContainBotName(botName: string, text: string): boolean {
  // Match whole word, case-insensitive
  const regex = new RegExp(`\\b${botName}\\b`, "i");
  return regex.test(text);
}

/**
 * Returns a string of the current date and time in the format
 * @param {string[]} arr
 * @return {string[]} array of messages trimmed to appropriate length
 */
export function verifyLengthAndTrimMessagesArray(
  arr: string[]): string[] {
  if (arr.length > MAX_MESSAGE_HISTORY) {
    arr = arr.slice(
      arr.length - MAX_MESSAGE_HISTORY,
      arr.length);
  }
  return arr;
}

/**
 * Translated from https://platform.openai.com/docs/guides/chat/introduction
 * Procedure for counting the number of tokens in a message
 * @param {ChatCompletionRequestMessage[]} messages
 * @return {number}
 */
export function encodeAndCountTokens(
  messages: string | ChatCompletionRequestMessage[]): number {
  if (typeof messages === "string") {
    return encode(messages).length;
  } else {
    let numTokens = 0;
    for (const message of messages) {
      // every message follows <im_start>{role/name}\n{content}<im_end>\n
      numTokens += 4;
      numTokens += encode(message.content).length;
    }
    // every reply is primed with <im_start>assistant
    numTokens += 2;

    return numTokens;
  }
}

/**
 * Formats system content, previous user messages, and previous ChatGPT
 * responses into proper format to send ChatGPT API message context
 * to make it more effective at performing chat completion
 * @param {string[]} assistantArr messageResponses sent by OpenAI / ChatGPT
 * @param {string[]} userArr incomingMessages sent by user
 * @param {string} system spec of how ChatGPT should respond to user
 * @return {{ChatCompletionRequestMessage, number}}
 */
export function formatOpenAIApiMessages(
  assistantArr: string[],
  userArr: string[],
  system: string
): {messages: ChatCompletionRequestMessage[], numTokensRequired: number} {
  let messages: ChatCompletionRequestMessage[] = [];

  // add system message
  messages.push({role: "system", content: system});

  // add user and assistant messages
  // use assistant.length as upper limit since it will be shorter than userArr
  // the final userArr entry will be pushed after this for loop
  for (let i = 0; i < assistantArr.length; i++) {
    messages.push({role: "user", content: userArr[i]});
    messages.push({role: "assistant", content: assistantArr[i]});
  }

  // user array should always be one longer than assistant,
  // now push the final user message to the array
  const lastUserMessage: string = userArr[userArr.length - 1] ?? "";
  messages.push({role: "user", content: lastUserMessage});

  // compute the number of tokens this message will require
  let numTokensRequired: number = encodeAndCountTokens(messages);

  // Make sure that messages arr is not too long. If too many
  // tokens are required, trim messages arr until we conform
  // in the worst case, drop all message history, and just send
  // the current new user message to Openai

  // make sure we never try while loop more than 20 times
  let numAttempts = 0;
  while (numTokensRequired + TOKEN_BUFFER > GPT35_TURBO_MAX_TOKENS) {
    console.log(
      "=====Trimming length of messages array...too many tokens====="
    );
    if (messages.length >= 4) {
      // Remove oldest user message and corresponding assistant response
      // messages[0] is the personality
      // messages.slice(3) creates a new arr with elems from index 3 to end
      // i.e., it removes elements 1 and 2
      messages = [messages[0], ...messages.slice(3)];
    } else if (numAttempts < 20) {
      // if we have < 4 messages, just send the most recent user message
      messages = [
        {role: "system", content: system},
        {role: "user", content: lastUserMessage},
      ];
    } else {
      // if the user message alone is too long, just send personality
      messages = [
        {role: "system", content: system},
      ];
    }

    // Compute new number of tokens required
    numTokensRequired = encodeAndCountTokens(messages);
    numAttempts++;
  }

  return {
    messages: messages,
    numTokensRequired: numTokensRequired,
  };
}
