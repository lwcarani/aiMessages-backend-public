// // standard imports
// Package for handling Webhooks / POST and other https requests
import axios from "axios";
import FormData from "form-data";

// // custom imports
import {
  base64StringToPngFile,
} from "../utils/utils";
// constants.ts
import {
  BASE_DELAY,
  MAX_RETRIES,
  ImageRequestType,
  LoggingObject,
  LoggingEventType,
  LoggingEventProvider,
  LoggingEventStatus,
  NUM_TRAINING_STEPS,
} from "../globals";
import {
  ClipdropError,
} from "../errors/clipdropErrors";

/**
 * Class for managing clipdrop api calls
 * @class
 * @classdesc Class for managing clipdrop api calls
 * @hideconstructor
 * @memberof module:apis
 * @category Apis
 */
export class ClipdropApiManager {
  private readonly clipdropApiKey: string | undefined;
  private readonly clipdropApiHost: string | undefined;

  /**
   * @constructor
   * @param {string | undefined} clipdropApiKey
   */
  constructor(
    clipdropApiKey: string | undefined
  ) {
    // Initialize the api key for clipdrop
    this.clipdropApiKey = clipdropApiKey;
    this.clipdropApiHost = process.env.CLIPDROP_API_HOST ?? undefined;
  }

  /**
   * Generates an image from the appropriate clipdrop api
   * @param {string} uid
   * @param {string} sessionId
   * @param {ImageRequestType} requestType
   * @param {string} caption
   * @param {string | undefined} image
   * @return {Promise<string>}
   * @throws {ClipdropError}
   */
  async callClipdropApi(
    uid: string,
    sessionId: string,
    requestType: ImageRequestType,
    caption: string,
    image?: string | undefined
  ): Promise<string[]> {
    let imageResponseArray: string[] = [];
    let httpType = 0;
    const userProvidedImage = image ?? "";

    switch (requestType) {
    case ImageRequestType.DOODLE: {
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.DOODLE,
        event_provider: LoggingEventProvider.CLIPDROP,
        event_status: LoggingEventStatus.REQUESTED,
      };
      console.log(JSON.stringify(toLog));
      try {
        ({imageResponseArray, httpType} =
          await this.generateResponseWithClipdropSketchToImageApi(
            caption,
            userProvidedImage,
            0
          ));
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.DOODLE,
          event_provider: LoggingEventProvider.CLIPDROP,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: httpType,
        };
        console.log(JSON.stringify(toLog));
      } catch (error: any) {
        // if error, log status, then throw error to populate up the stack
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.DOODLE,
          event_provider: LoggingEventProvider.CLIPDROP,
          event_status: LoggingEventStatus.FAILED,
          http_type: error.code,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
        throw new ClipdropError({
          message: error.message,
          code: error.code,
          cause: error.cause,
        });
      }
      break;
    }
    default: {
      console.log("Entering default case statement for ImageRequestType");
      imageResponseArray = [];
    }
    }
    return imageResponseArray;
  }

  /**
   * @param {string} prompt
   * @param {string} image
   * @param {number} retries
   * @throws {StabilityError}
   * @return {Promise<{string, number}>} A response to send back to the user.
   * Calls Clipdrop's sketch-to-image API (Clipdrop is by Stability AI).
   * In the case of errors we implement exponential backoff until we get a
   * successful response, or until we exceed the number of MAX_RETRIES.
   */
  private async generateResponseWithClipdropSketchToImageApi(
    prompt: string,
    image: string,
    retries: number
  ): Promise<{imageResponseArray: string[], httpType: number}> {
    const imageResponse = [];

    if (!this.clipdropApiKey) {
      throw new ClipdropError({
        message: "Missing Clipdrop API key.",
        code: 401,
        cause: "Missing Clipdrop API key.",
      });
    }
    const pngImage: File = base64StringToPngFile(image);
    // const imageBuffer = Buffer.from(image, "base64");
    const form = new FormData();
    form.append("sketch_file", pngImage);
    form.append("prompt", prompt);

    try {
      const response =
        await axios
          .post(
            `${this.clipdropApiHost}/sketch-to-image/v1/sketch-to-image`,
            form, {
              headers: {
                "x-api-key": this.clipdropApiKey,
                ...form.getHeaders(),
              },
              responseType: "arraybuffer",
            });

      const buffer: Buffer = Buffer.from(response.data, "binary");
      const base64String: string = buffer.toString("base64");
      imageResponse.push(base64String);

      return {imageResponseArray: imageResponse, httpType: response.status};
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        console.log(`Maximum retries exceeded: ${retries}`);
        console.log("Error cause: ", error?.response?.data?.error);
        throw new ClipdropError({
          message: "Non-200 response: maximum retries exceeded.",
          code: error?.response?.status,
          cause: error?.response?.data?.error,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log(
        `Error: Non-200 response (${error?.response?.status}).
        Retry number: ${retries}`
      );
      return this.generateResponseWithClipdropSketchToImageApi(
        prompt,
        image,
        retries + 1
      );
    }
  }
} // end `ClipdropApiManager` class
