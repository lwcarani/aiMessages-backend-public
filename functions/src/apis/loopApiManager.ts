// // standard imports
// Package for handling Webhooks / POST and other https requests
import axios from "axios";

// // custom imports
// constants.ts
import {
  BASE_DELAY,
  MAX_RETRIES,
  LoggingObject,
  LoggingEventProvider,
  LoggingEventStatus,
  AlertType,
  LoggingEventType,
} from "../globals";
import {
  LoopMessageError,
} from "../errors/loopMessageErrors";

// // custom imports
// dataManager.ts
import {
  DataManager,
} from "../utils/dataManager";
// firebaseUtils.ts
import {
  toggleUserWarningOutOfMessageCredits,
} from "../utils/firebaseUtils";
// constants.ts
import {
  Collection,
  MessageType,
  NO_CREDITS_REMAINING_MESSAGE,
} from "../globals";

interface LoopMessageResponse {
  message_id: string;
  success: boolean;
  text: string;
  group?: {
    group_id: string;
    name?: string | undefined;
    participants: string[];
  };
  recipient?: string | undefined;
}

/**
 * Class for managing loop api calls
 * @class
 * @classdesc Class for managing loop api calls
 * @hideconstructor
 * @memberof module:apis
 * @category Apis
 */
export class LoopApiManager {
  private readonly loopAuthSecretKey: string;
  private readonly loopAuthSecretKeyConvo: string | undefined;
  private readonly loopAuthSecretKeyiMessageAuth: string | undefined;

  /**
   * @constructor
   * @param {string} loopAuthSecretKey
   * @param {string | undefined} loopAuthSecretKeyConvo
   * @param {string | undefined} loopAuthSecretKeyiMessageAuth
   */
  constructor(
    loopAuthSecretKey: string,
    loopAuthSecretKeyConvo?: string | undefined,
    loopAuthSecretKeyiMessageAuth?: string | undefined
  ) {
    // Initialize the api key for openai
    this.loopAuthSecretKey = loopAuthSecretKey;
    this.loopAuthSecretKeyConvo = loopAuthSecretKeyConvo;
    this.loopAuthSecretKeyiMessageAuth = loopAuthSecretKeyiMessageAuth;
  }

  /**
   * @param {string} uid
   * @param {string} sessionId
   * @param {string | undefined} messageRecipient
   * @param {string | undefined} groupID
   * @param {string} assistantMessageResponse
   * @param {AlertType | undefined} alertType
   * @param {string[] | undefined} attachments
   * @param {string | undefined} passthrough
   * @throws {LoopApiError}
   * @return {Promise<boolean>}
   * true/false: was message was delivered to customer
   * In the case of errors we implement exponential backoff until we get a
   * successful response, or until we exceed the number of MAX_RETRIES. NOTE:
   * we only decrement the numberOfMessagesRemaining for the user if we get
   * a `success === true` response from the Loop server.
   */
  async sendLoopMessage(
    uid: string,
    sessionId: string,
    messageRecipient: string | undefined,
    groupID: string | undefined,
    assistantMessageResponse: string,
    alertType?: AlertType | undefined,
    attachments?: string[] | undefined,
    passthrough?: string | undefined
  ): Promise<boolean> {
    let currentRetry = 0;

    const URL = process.env.LOOP_API_HOST ?? "";
    const SENDER_NAME = process.env.LOOP_SENDER_NAME ?? "";
    let requestBody: any;
    const headers = {
      "Content-Type": "application/json",
      "Authorization": this.loopAuthSecretKey,
      "Loop-Secret-key": this.loopAuthSecretKeyConvo,
    };

    if (messageRecipient) {
      requestBody = {
        recipient: messageRecipient,
        text: assistantMessageResponse,
        sender_name: SENDER_NAME,
        attachments: attachments,
        passthrough: passthrough,
      };
    } else {
      requestBody = {
        group: groupID,
        text: assistantMessageResponse,
        sender_name: SENDER_NAME,
        attachments: attachments,
        passthrough: passthrough,
      };
    }
    const toLogRequest: LoggingObject = {
      uid: uid,
      session_id: sessionId,
      event_type: LoggingEventType.SEND_MESSAGE,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.REQUESTED,
      http_info: alertType,
    };
    console.log(JSON.stringify(toLogRequest));

    let response: any;
    let responseJSON: LoopMessageResponse;
    let success = false;

    while (!success && currentRetry <= MAX_RETRIES) {
      if (currentRetry > 0) {
        console.log("Message response back to user failed, trying again");
        console.log(`Retry number: ${currentRetry}`);
        const delay = BASE_DELAY * 2 ** currentRetry;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      try {
        response = await axios.post(URL, requestBody, {headers});
        responseJSON = response.data as LoopMessageResponse;
        success = responseJSON.success;
      } catch (error: any) {
        console.error(error.message);
      }
      currentRetry++;
    }
    if (success) {
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.SEND_MESSAGE,
        event_provider: LoggingEventProvider.LOOP_MESSAGE,
        event_status: LoggingEventStatus.COMPLETED,
        http_info: alertType,
        http_type: 200,
      };
      console.log(JSON.stringify(toLog));
      return success;
    } else {
      console.log("Loop did not accept this request. Max retries exceeded.");
      const toLog: LoggingObject = {
        uid: uid,
        session_id: sessionId,
        event_type: LoggingEventType.SEND_MESSAGE,
        event_provider: LoggingEventProvider.LOOP_MESSAGE,
        event_status: LoggingEventStatus.FAILED,
        http_info: alertType,
        http_type: 400,
      };
      console.log(JSON.stringify(toLog));
      throw new LoopMessageError({
        message: "Maximum retries exceeded, no message sent.",
        code: 400,
        cause: "Unknown - Loop error",
      });
    }
  }

  /**
   * @param {string} passthrough
   * @param {number} retries
   * @throws {LoopApiError}
   * @return {Promise<{string, string, boolean}>} This function
   * triggers the iMessage account authentication process via Loop's
   * iMessage auth service. We send an init POST request to the
   * required URL with appropriate secret API key and AUTH key.
   * We also send the UID of the user we are trying to authenticate
   * as passthrough data in the body of the POST request, so that we have access
   * to the UID when we receive the callback from Loop after the user has sent
   * the requisite auth text.
   */
  async sendLoopAuthRequest(
    passthrough: string,
    retries: number
  ): Promise<{
      iMessageLink: string,
      loopRequestID: string,
      success: boolean
    }> {
    const URL = process.env.LOOP_API_AUTH_HOST ?? "";
    const requestBody: any = {
      passthrough: passthrough,
    };

    const headers = {
      "Content-Type": "application/json",
      "Authorization": this.loopAuthSecretKey,
      "Auth-Secret-key": this.loopAuthSecretKeyiMessageAuth,
    };

    try {
      const response = await axios.post(URL, requestBody, {headers});

      if (response.data.success) {
        return {
          iMessageLink: response.data.imessage_link,
          loopRequestID: response.data.request_id,
          success: response.data.success,
        };
      } else if (retries < MAX_RETRIES) {
        console.log("Message response back to user failed, trying again");
        console.log(`Retry number: ${retries}`);
        const delay = BASE_DELAY * 2 ** retries;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendLoopAuthRequest(passthrough, retries + 1);
      } else {
        console.log(
          `Loop message_sent success is ${response.data.success}.
          Maximum retries exceeded.`
        );
        throw new LoopMessageError({
          message: "Maximum retries exceeded, no message sent.",
          code: 400,
          cause: "Unknown - Loop error",
        });
      }
    } catch (error: any) {
      console.log(error.response?.data);
      console.error(error.message);

      if (retries < MAX_RETRIES) {
        console.log("Retrying to send loop message");
        console.log(`Retry number: ${retries}`);
        const delay = BASE_DELAY * 2 ** retries;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.sendLoopAuthRequest(passthrough, retries + 1);
      } else {
        console.log(`Maximum retries exceeded: ${retries}`);
        throw new LoopMessageError({
          message: "Maximum retries exceeded, no message sent.",
          code: error?.response?.data?.code,
          cause: error?.response?.data?.message,
        });
      }
    }
  }

  /**
   * @param {DataManager} dataManager
   * @param {string} uid
   * @param {string} sessionId
   * @return {Promise<void>}
   */
  async sendNotificationMessageToUserOutOfMessageCredits(
    dataManager: DataManager,
    uid: string,
    sessionId: string
  ): Promise<void> {
    let messageRecipient = "";
    try {
      const result = await dataManager.getDocument(
        Collection.IMESSAGE_ACCOUNTS,
        uid
      );
      messageRecipient = result?.contact ?? "";
    } catch (error: any) {
      console.log("Error:", error.message);
      console.log("No iMessageAccount info found, exiting.");
    }

    if (!messageRecipient) {
      return;
    }

    try {
      const passthrough: string =
        `{"uid": "${uid}", ` +
        `"incomingMessageType": "${MessageType.NO_CREDITS_REMAINING}"}`;
      const sendLoopMessageSuccess: boolean = await this.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        undefined,
        NO_CREDITS_REMAINING_MESSAGE,
        undefined,
        undefined,
        passthrough
      );
      if (sendLoopMessageSuccess) {
        console.log("switching toggle to true");
        await toggleUserWarningOutOfMessageCredits(uid);
        console.log("Exiting auth flow, warning sent to user.");
      }
    } catch (error: any) {
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
    }
  }
}
