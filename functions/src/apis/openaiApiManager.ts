// // standard imports
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionResponse,
  CreateEditResponse,
  CreateCompletionResponse,
  Configuration,
  OpenAIApi,
  ImagesResponse,
} from "openai";

// // custom imports
// utils.ts
import {
  base64StringToPngFile,
  encodeAndCountTokens,
} from "../utils/utils";
// errors.ts
import {OpenAIApiError} from "../errors/openaiErrors";
// constants.ts
import {
  BASE_DELAY,
  MAX_RETRIES,
  GPT35_TURBO_MAX_TOKENS,
  DAVINCI3_MAX_TOKENS,
  TOKEN_BUFFER,
  FinishReason,
  LoggingObject,
  LoggingEventType,
  LoggingEventProvider,
  LoggingEventStatus,
} from "../globals";

/**
 * Class for managing openai api calls
 * @class
 * @classdesc Class for managing openai api calls
 * @hideconstructor
 * @memberof module:apis
 * @category Apis
 */
export class OpenaiApiManager {
  private readonly apiKey: string | undefined;

  /**
   * @constructor
   * @param {string} openaiApiKey
   */
  constructor(openaiApiKey: string) {
    // Initialize the api key for openai
    this.apiKey = openaiApiKey;
  }

  /**
   * @param {string} uid
   * @param {string} sessionId
   * @param {ChatCompletionRequestMessage[]} messages
   * @param {number} numTokensRequired
   * @param {string} user - the uid of the user
   * @param {number} retries
   * @throws {OpenAIApiError}
   * @return {Promise<string>} A response to send back to the user. Calls
   * OpenAI's createChatCompletion api. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that something
   * is wrong with OpenAI's api, and to please try again.
   */
  async generateResponseWithOpenAiChatCompletionApi(
    uid: string,
    sessionId: string,
    messages: ChatCompletionRequestMessage[],
    numTokensRequired: number,
    user: string,
    retries: number
  ): Promise<string> {
    const MODEL_ID = process.env.OPENAI_CHAT_COMPLETION_MODEL ?? "";
    const maxTokens = GPT35_TURBO_MAX_TOKENS - numTokensRequired - TOKEN_BUFFER;
    console.log("maxTokens:", maxTokens);
    console.log("numTokensRequired:", numTokensRequired);
    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }
    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    const toLog: LoggingObject = {
      uid: uid,
      session_id: sessionId,
      event_type: LoggingEventType.CHAT_COMPLETION,
      event_provider: LoggingEventProvider.OPEN_AI,
      event_status: LoggingEventStatus.REQUESTED,
    };
    console.log(JSON.stringify(toLog));

    try {
      const response = await openai.createChatCompletion({
        model: MODEL_ID,
        messages: messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        user: user,
      });

      const responseJSON = response.data as CreateChatCompletionResponse;

      const assistantMessageResponse =
        responseJSON.choices[0].message?.content ?? "";
      const finishReason =
        responseJSON.choices[0].finish_reason ?? FinishReason.UNKNOWN;

      // If the finishReason is content filter, it means that OpenAI API
      // response was omitted due to a flag from their content filters.
      // If finishReason is length, it means that OpenAI API response was
      // too long, so we retry with a smaller messages array. Specifically,
      // we remove the oldest user message and the corresponding assistant
      // response, compute a new number of tokens contained in this shorter
      // messages array, then recall the function with the new messages array
      // and new num of tokens required. NOTE: we only do this if the length
      // of the messages array is at least 4, since we need at least the
      // system prompt (i.e., bot personality) and one user message.
      if (finishReason === FinishReason.CONTENT_FILTER) {
        return "OpenAI's has omitted the response due " +
            "to a flag from their content filters. Please reword your " +
            "request, and try again.";
      } else if (
        finishReason === FinishReason.LENGTH &&
        retries < MAX_RETRIES &&
        messages.length >= 4
      ) {
        console.log("finishReason === length, retrying " +
            "API call with shorter array");
        // Remove oldest user message and corresponding assistant response
        // messages[0] is the personality
        // messages.slice(3) creates a new arr with elems from index 3 to end
        const shortenedMessages = [messages[0], ...messages.slice(3)];
        // Compute new number of tokens required
        const newNumTokensRequired: number =
            encodeAndCountTokens(shortenedMessages);
        return this.generateResponseWithOpenAiChatCompletionApi(
          uid,
          sessionId,
          shortenedMessages,
          newNumTokensRequired,
          user,
          retries + 1
        );
      } else {
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.CHAT_COMPLETION,
          event_provider: LoggingEventProvider.OPEN_AI,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: response.status,
        };
        console.log(JSON.stringify(toLog));
        return assistantMessageResponse;
      }
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.CHAT_COMPLETION,
          event_provider: LoggingEventProvider.OPEN_AI,
          event_status: LoggingEventStatus.FAILED,
          http_type: error?.response?.status,
        };
        console.log(JSON.stringify(toLog));
        // pass the code and the error
        throw new OpenAIApiError({
          code: error?.response?.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateResponseWithOpenAiChatCompletionApi(
        uid,
        sessionId,
        messages,
        numTokensRequired,
        user,
        retries + 1
      );
    }
  }

  /**
   * @param {string} input
   * @param {string} instruction
   * @param {number} retries
   * @return {Promise<string>}
   * @throws {OpenAIApiError}
   * A response to send back to the user. Calls
   * OpenAI's createEdit API. In the case of errors we implement exponential
   * backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that
   * something is wrong with OpenAI's api, and to please try again.
   */
  async generateResponseWithOpenAiTextEditApi(
    input: string,
    instruction: string,
    retries: number
  ): Promise<string> {
    // no max_tokens parameter for text-edit
    const MODEL_ID = process.env.OPENAI_TEXT_EDIT_MODEL ?? "";

    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }

    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    try {
      const response = await openai.createEdit({
        model: MODEL_ID,
        input: input,
        instruction: instruction,
        temperature: 0.7,
      });

      const responseJSON = response.data as CreateEditResponse;
      const assistantMessageResponse = responseJSON.choices[0].text ?? "";
      return assistantMessageResponse;
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        console.log(error.response);
        // pass the code and the error
        throw new OpenAIApiError({
          code: error.response.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateResponseWithOpenAiTextEditApi(
        input,
        instruction,
        retries + 1
      );
    }
  }

  /**
   * @param {string} query
   * @param {string} numTokensRequired
   * @param {string} user - the uid of the user
   * @param {number} retries
   * @throws {OpenAIApiError}
   * @return {Promise<string>} A response to send back to the user. Calls
   * OpenAI's createCompletion API. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that
   * something is wrong with OpenAI's api, and to please try again.
   */
  async generateResponseWithOpenAiCompletionApi(
    query: string,
    numTokensRequired: number,
    user: string,
    retries: number
  ): Promise<string> {
    const MODEL_ID = process.env.OPENAI_COMPLETION_MODEL ?? "";
    const maxTokens = DAVINCI3_MAX_TOKENS - numTokensRequired - TOKEN_BUFFER;

    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }

    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    try {
      const response = await openai.createCompletion({
        model: MODEL_ID,
        prompt: query,
        temperature: 0.7,
        max_tokens: maxTokens,
        user: user,
      });

      const responseJSON = response.data as CreateCompletionResponse;
      const assistantMessageResponse = responseJSON.choices[0].text ?? "";
      const finishReason = responseJSON.choices[0].finish_reason ?? "";

      // If the finishReason is content filter, it means that OpenAI API
      // response was omitted due to a flag from their content filters.
      // If finishReason is length, it means that OpenAI API response was
      // too long, so we retry with a large numTokensRequired, which will
      // force the API to return a shorter response (i.e., use less tokens)
      if (finishReason === FinishReason.CONTENT_FILTER) {
        return "OpenAI's has omitted the response due " +
          "to a flag from their content filters. Please reword your " +
          "request, and try again.";
      } else if (
        finishReason === FinishReason.LENGTH &&
        retries < MAX_RETRIES
      ) {
        return this.generateResponseWithOpenAiCompletionApi(
          query,
          numTokensRequired + 100,
          user,
          retries + 1
        );
      } else {
        return assistantMessageResponse;
      }
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        // pass the code and the error
        throw new OpenAIApiError({
          code: error.response.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateResponseWithOpenAiCompletionApi(
        query,
        numTokensRequired,
        user,
        retries + 1
      );
    }
  }

  /**
   * @param {string} prompt
   * @param {string} image
   * @param {string} user - the uid of the user
   * @param {number} retries
   * @throws {OpenAIApiError}
   * @return {Promise<string>} A response to send back to the user. Calls
   * OpenAI's createImageEdit API. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that
   * something is wrong with OpenAI's api, and to please try again.
   */
  async generateImageWithOpenAiEditImageApi(
    prompt: string,
    image: string,
    user: string,
    retries: number): Promise<string> {
    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }

    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    // OpenAI API requires a PNG file, so we convert the base64 string to a PNG
    const pngImage: File = base64StringToPngFile(image);

    try {
      const response = await openai.createImageEdit(
        pngImage,
        prompt,
        undefined,
        1,
        "512x512",
        "b64_json",
        user,
      );
      const responseJSON = response.data as ImagesResponse;
      const imageResponse: string = responseJSON.data[0].b64_json ?? "";
      return imageResponse;
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        // pass the code and the error
        throw new OpenAIApiError({
          code: error.response.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateImageWithOpenAiEditImageApi(
        prompt,
        image,
        user,
        retries + 1
      );
    }
  }

  /**
   * @param {string} image
   * @param {string} user - the uid of the user
   * @param {number} retries
   * @throws {OpenAIApiError}
   * @return {Promise<string>} A response to send back to the user. Calls
   * OpenAI's createImageVariation API. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that
   * something is wrong with OpenAI's api, and to please try again.
   */
  async generateImageWithOpenAiImageVariationApi(
    image: string,
    user: string,
    retries: number
  ): Promise<string> {
    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }

    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    // OpenAI API requires a PNG file, so we convert the base64 string to a PNG
    const pngImage: File = base64StringToPngFile(image);

    try {
      const response = await openai.createImageVariation(
        pngImage,
        1,
        "512x512",
        "b64_json",
        user,
      );
      const responseJSON = response.data as ImagesResponse;
      const imageResponse: string = responseJSON.data[0].b64_json ?? "";
      return imageResponse;
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        // pass the code and the error
        throw new OpenAIApiError({
          code: error.response.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateImageWithOpenAiImageVariationApi(
        image,
        user,
        retries + 1
      );
    }
  }

  /**
   * @param {string} prompt
   * @param {string} user - the uid of the user
   * @param {number} retries
   * @throws {OpenAIApiError}
   * @return {Promise<string>} A response to send back to the user. Calls
   * OpenAI's createImage API. In the case of errors we implement exponential
   * backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES. If we never get a successful response back
   * from OpenAIApi, we send a message to the user that
   * something is wrong with OpenAI's api, and to please try again.
   */
  async generateImageWithOpenAiCreateImageApi(
    prompt: string,
    user: string,
    retries: number
  ): Promise<string> {
    if (!this.apiKey) {
      throw new OpenAIApiError({
        code: 401,
        cause: "Missing Openai API key.",
      });
    }

    const configuration = new Configuration({
      apiKey: this.apiKey,
    });
    const openai = new OpenAIApi(configuration);

    try {
      const response = await openai.createImage({
        prompt: prompt,
        size: "512x512",
        n: 1,
        response_format: "b64_json",
        user: user,
      });
      const responseJSON = response.data as ImagesResponse;
      const imageResponse: string = responseJSON.data[0].b64_json ?? "";
      return imageResponse;
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        // pass the code and the error
        throw new OpenAIApiError({
          code: error.response.status ?? 400,
          cause: error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log("Error", error.message);
      console.log(`Retry number: ${retries}`);
      return this.generateImageWithOpenAiCreateImageApi(
        prompt,
        user,
        retries + 1
      );
    }
  }
}
