// // standard imports
// Package for handling Webhooks / POST and other https requests
import axios from "axios";
import FormData from "form-data";

// // custom imports
// constants.ts
import {
  BASE_DELAY,
  MAX_RETRIES,
  ImageRequestType,
  GenerationResponse,
  LoggingObject,
  LoggingEventType,
  LoggingEventProvider,
  LoggingEventStatus,
  NUM_TRAINING_STEPS,
} from "../globals";
import {
  StabilityError,
} from "../errors/stabilityErrors";

/**
 * Class for managing stability.ai api calls
 * @class
 * @classdesc Class for managing stability.ai api calls
 * @hideconstructor
 * @memberof module:apis
 * @category Apis
 */
export class StabilityApiManager {
  private readonly stabilityApiKey: string | undefined;
  private readonly stabilityApiHost: string | undefined;

  /**
   * @constructor
   * @param {string | undefined} stabilityApiKey
   */
  constructor(
    stabilityApiKey: string | undefined
  ) {
    // Initialize the api key for stability.ai
    this.stabilityApiKey = stabilityApiKey;
    this.stabilityApiHost = process.env.STABILITY_API_HOST ?? undefined;
  }

  /**
   * Generates an image from the appropriate Stability.ai api
   * @param {string} uid
   * @param {string} sessionId
   * @param {ImageRequestType} requestType
   * @param {string} caption
   * @param {number} numSamples
   * @param {string | undefined} image
   * @return {Promise<string>}
   * @throws {StabilityError}
   */
  async callStabilityAiApi(
    uid: string,
    sessionId: string,
    requestType: ImageRequestType,
    caption: string,
    numSamples: number,
    image?: string | undefined
  ): Promise<string[]> {
    let imageResponseArray: string[] = [];
    let httpType = 0;
    const userProvidedImage = image ?? "";

    switch (requestType) {
    case ImageRequestType.CREATE: {
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.IMAGE_CREATE,
        event_provider: LoggingEventProvider.STABILITY_AI,
        event_status: LoggingEventStatus.REQUESTED,
        num_steps: NUM_TRAINING_STEPS,
      };
      console.log(JSON.stringify(toLog));
      try {
        ({imageResponseArray, httpType} =
          await this.generateResponseWithStabilityAiTextToImageApi(
            caption,
            numSamples,
            0
          ));
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_CREATE,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: httpType,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
      } catch (error: any) {
        // if error, log status, then throw error to populate up the stack
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_CREATE,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.FAILED,
          http_type: error.code,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
        throw new StabilityError({
          message: error.message,
          code: error.code,
          cause: error.cause,
        });
      }
      break;
    }
    case ImageRequestType.EDIT_WITH_MASK: {
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.IMAGE_EDIT_WITH_MASK,
        event_provider: LoggingEventProvider.STABILITY_AI,
        event_status: LoggingEventStatus.REQUESTED,
        num_steps: NUM_TRAINING_STEPS,
      };
      console.log(JSON.stringify(toLog));
      try {
        ({imageResponseArray, httpType} =
          await this.generateResponseWithStabilityAiImageToImageWithMaskApi(
            caption,
            userProvidedImage,
            numSamples,
            0
          ));
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_EDIT_WITH_MASK,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: httpType,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
      } catch (error: any) {
        // if error, log status, then throw error to populate up the stack
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_EDIT_WITH_MASK,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.FAILED,
          http_type: error.code,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
        throw new StabilityError({
          message: error.message,
          code: error.code,
          cause: error.cause,
        });
      }
      break;
    }
    case ImageRequestType.EDIT: {
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.IMAGE_EDIT,
        event_provider: LoggingEventProvider.STABILITY_AI,
        event_status: LoggingEventStatus.REQUESTED,
        num_steps: NUM_TRAINING_STEPS,
      };
      console.log(JSON.stringify(toLog));
      try {
        ({imageResponseArray, httpType} =
          await this.generateResponseWithStabilityAiImageToImageApi(
            caption,
            userProvidedImage,
            numSamples,
            0
          ));
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_EDIT,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: httpType,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
      } catch (error: any) {
        // if error, log status, then throw error to populate up the stack
        const toLog: LoggingObject = {
          uid: uid,
          session_id: sessionId,
          event_type: LoggingEventType.IMAGE_EDIT,
          event_provider: LoggingEventProvider.STABILITY_AI,
          event_status: LoggingEventStatus.FAILED,
          http_type: error.code,
          num_steps: NUM_TRAINING_STEPS,
        };
        console.log(JSON.stringify(toLog));
        throw new StabilityError({
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
   * @param {number} numSamples
   * @param {number} retries
   * @throws {StabilityError}
   * @return {Promise<{string, number}>} A response to send back to user. Calls
   * Stability.AI's text-to-image REST API. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES.
   */
  private async generateResponseWithStabilityAiTextToImageApi(
    prompt: string,
    numSamples: number,
    retries: number
  ): Promise<{imageResponseArray: string[], httpType: number}> {
    const engineId = process.env.STABILITY_DIFFUSION_XL_BETA_ENGINE;

    if (!this.stabilityApiKey) {
      throw new StabilityError({
        message: "Missing Stability API key.",
        code: 401,
        cause: "Missing Stability API key.",
      });
    }

    try {
      const response = await axios.post(
        `${this.stabilityApiHost}/v1/generation/${engineId}/text-to-image`,
        {
          text_prompts: [
            {
              text: prompt,
            },
          ],
          cfg_scale: 7,
          clip_guidance_preset: "FAST_BLUE",
          height: 512,
          width: 512,
          samples: numSamples,
          steps: NUM_TRAINING_STEPS,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${this.stabilityApiKey}`,
          },
        }
      );
      const responseJSON = response.data as GenerationResponse;
      const imageResponse: string[] = [];
      responseJSON.artifacts.forEach((image, index) => {
        imageResponse[index] = image.base64 ?? "";
      });

      return {imageResponseArray: imageResponse, httpType: response.status};
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        console.log(`Maximum retries exceeded: ${retries}`);
        console.log("Error cause: ", error?.response?.data?.message);
        throw new StabilityError({
          message: "Non-200 response: maximum retries exceeded.",
          code: error?.response?.status,
          cause: error?.response?.data?.message,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log(
        `Error: Non-200 response (${error?.response?.status}).
        Retry number: ${retries}`
      );
      return this.generateResponseWithStabilityAiTextToImageApi(
        prompt,
        numSamples,
        retries + 1
      );
    }
  }

  /**
   * @param {string} prompt
   * @param {string} image
   * @param {number} numSamples
   * @param {number} retries
   * @throws {StabilityError}
   * @return {Promise<{string, number}>}
   * A response to send back to the user. Calls
   * Stability.AI's image-to-image REST API. In the case of errors we implement
   * exponential backoff until we get a successful response, or until we exceed
   * the number of MAX_RETRIES.
   */
  private async generateResponseWithStabilityAiImageToImageApi(
    prompt: string,
    image: string,
    numSamples: number,
    retries: number
  ): Promise<{imageResponseArray: string[], httpType: number}> {
    const engineId = process.env.STABILITY_DIFFUSION_XL_BETA_ENGINE;

    if (!this.stabilityApiKey) {
      throw new StabilityError({
        message: "Missing Stability API key.",
        code: 401,
        cause: "Missing Stability API key.",
      });
    }

    const imageBuffer = Buffer.from(image, "base64");
    const formData = new FormData();
    formData.append("init_image", imageBuffer);
    formData.append("init_image_mode", "IMAGE_STRENGTH");
    formData.append("image_strength", 0.35);
    formData.append("text_prompts[0][text]", prompt);
    formData.append("cfg_scale", 7);
    formData.append("clip_guidance_preset", "FAST_BLUE");
    formData.append("samples", numSamples);
    formData.append("steps", NUM_TRAINING_STEPS);

    try {
      const response =
        await axios
          .post(
            this.stabilityApiHost +
            `/v1/generation/${engineId}/image-to-image`,
            formData, {
              headers: {
                ...formData.getHeaders(),
                "Accept": "application/json",
                "Authorization": `Bearer ${this.stabilityApiKey}`,
              },
            });

      const responseJSON = response.data as GenerationResponse;
      const imageResponse: string[] = [];
      responseJSON.artifacts.forEach((image, index) => {
        imageResponse[index] = image.base64 ?? "";
      });

      return {imageResponseArray: imageResponse, httpType: response.status};
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        console.log(`Maximum retries exceeded: ${retries}`);
        console.log("Error cause: ", error?.response?.data?.message);
        throw new StabilityError({
          message: "Non-200 response: maximum retries exceeded.",
          code: error?.response?.status,
          cause: error?.response?.data?.message,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log(
        `Error: Non-200 response (${error?.response?.status}).
        Retry number: ${retries}`
      );
      return this.generateResponseWithStabilityAiImageToImageApi(
        prompt,
        image,
        numSamples,
        retries + 1
      );
    }
  }

  /**
   * @param {string} prompt
   * @param {string} image
   * @param {number} numSamples
   * @param {number} retries
   * @throws {StabilityError}
   * @return {Promise<{string, number}>} A response to send back to the user.
   * Calls Stability.AI"s image-to-image w/ mask REST API.
   * In the case of errors we implement exponential backoff until
   * we get a successful response, or until we exceed
   * the number of MAX_RETRIES.
   */
  private async generateResponseWithStabilityAiImageToImageWithMaskApi(
    prompt: string,
    image: string,
    numSamples: number,
    retries: number
  ): Promise<{imageResponseArray: string[], httpType: number}> {
    const engineId = process.env.STABILITY_DIFFUSION_XL_BETA_ENGINE;

    if (!this.stabilityApiKey) {
      throw new StabilityError({
        message: "Missing Stability API key.",
        code: 401,
        cause: "Missing Stability API key.",
      });
    }
    const imageBuffer = Buffer.from(image, "base64");
    const formData = new FormData();
    formData.append("init_image", imageBuffer);
    formData.append("mask_source", "INIT_IMAGE_ALPHA");
    formData.append("text_prompts[0][text]", prompt);
    formData.append("cfg_scale", "7");
    formData.append("clip_guidance_preset", "FAST_BLUE");
    formData.append("samples", numSamples);
    formData.append("steps", NUM_TRAINING_STEPS);

    try {
      const response =
        await axios
          .post(
            this.stabilityApiHost +
            `/v1/generation/${engineId}/image-to-image/masking`,
            formData, {
              headers: {
                ...formData.getHeaders(),
                "Accept": "application/json",
                "Authorization": `Bearer ${this.stabilityApiKey}`,
              },
            });

      const responseJSON = response.data as GenerationResponse;
      const imageResponse: string[] = [];
      responseJSON.artifacts.forEach((image, index) => {
        imageResponse[index] = image.base64 ?? "";
      });

      return {imageResponseArray: imageResponse, httpType: response.status};
    } catch (error: any) {
      if (retries >= MAX_RETRIES) {
        console.log(`Maximum retries exceeded: ${retries}`);
        console.log("Error cause: ", error?.response?.data?.message);
        throw new StabilityError({
          message: "Non-200 response: maximum retries exceeded.",
          code: error?.response?.status,
          cause: error?.response?.data?.message,
        });
      }
      const delay = BASE_DELAY * 2 ** retries;
      await new Promise((resolve) => setTimeout(resolve, delay));
      console.log(
        `Error: Non-200 response (${error?.response?.status}).
        Retry number: ${retries}`
      );
      return this.generateResponseWithStabilityAiImageToImageWithMaskApi(
        prompt,
        image,
        numSamples,
        retries + 1
      );
    }
  }
} // end `StabilityApiManager` class
