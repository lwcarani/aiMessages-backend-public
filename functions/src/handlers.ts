// // standard imports
// The Cloud Functions for Firebase SDK to create Cloud Functions
// and set up triggers.
// // custom imports
// constants.ts
import {
  Collection,
  AlertType,
  MessageType,
  WELCOME_MESSAGE_NEW_GROUP,
  WELCOME_NEW_PRIVATE_USER,
  LoggingObject,
  LoggingEventProvider,
  LoggingEventStatus,
  LoggingEventType,
} from "./globals";
// apis.ts
import {
  OpenaiApiManager,
} from "./apis/openaiApiManager";
import {
  LoopApiManager,
} from "./apis/loopApiManager";
// utils.ts
import {
  formatOpenAIApiMessages,
  doesTextContainBotName,
  verifyLengthAndTrimMessagesArray,
} from "./utils/utils";

// dataManager.ts
import {
  DataManager,
  DocumentData,
} from "./utils/dataManager";

import {
  createReceiptForSuccessfulGroupMessageDelivery,
  createReceiptForSuccessfulPrivateMessageDelivery,
  getUIDGivenIMessageAccount,
} from "./utils/firebaseUtils";

/**
 * if alertType === "conversation_inited", send a welcome message
 * with a deeplink to appstore for aiMessages app download
 * after sending welcome message, exit control flow
 * @param {string} sessionId
 * @param {string} messageRecipient
 * @param {AlertType} alertType
 * @param {LoopApiManager} loopApiManager
 */
export async function privateConversationInitedWebhookHandler(
  sessionId: string,
  messageRecipient: string,
  alertType: AlertType,
  loopApiManager: LoopApiManager
): Promise<void> {
  const uid: string = await getUIDGivenIMessageAccount(
    messageRecipient,
    sessionId
  );
  const passthrough: string =
    `{"uid": "${uid}", ` +
    `"sessionId": "${sessionId}", ` +
    `"incomingMessageType": "${MessageType.PRIVATE_WELCOME_MESSAGE}"}`;
  try {
    await loopApiManager.sendLoopMessage(
      uid,
      sessionId,
      messageRecipient,
      undefined,
      WELCOME_NEW_PRIVATE_USER,
      alertType,
      undefined,
      passthrough
    );
  } catch (error: any) {
    console.log(
      "Failed to send private user welcome message.\n",
      error.message + "\n",
      error.cause
    );
  }
  return;
}

/**
 * if alertType === "group_created", send a welcome message
 * with a deeplink to appstore for aiMessages app download
 * after sending welcome message, exit control flow
 * @param {string} sessionId
 * @param {string} messageRecipient
 * @param {string} groupID
 * @param {AlertType} alertType
 * @param {LoopApiManager} loopApiManager
 */
export async function groupCreatedWebhookHandler(
  sessionId: string,
  messageRecipient: string,
  groupID: string,
  alertType: AlertType,
  loopApiManager: LoopApiManager
): Promise<void> {
  const uid: string = await getUIDGivenIMessageAccount(
    messageRecipient,
    sessionId
  );
  console.log("uid:", uid);
  const passthrough: string =
    `{"uid": "${uid}", ` +
    `"sessionId": "${sessionId}", ` +
    `"incomingMessageType": "${MessageType.GROUP_WELCOME_MESSAGE}"}`;
  try {
    await loopApiManager.sendLoopMessage(
      uid,
      sessionId,
      undefined,
      groupID,
      WELCOME_MESSAGE_NEW_GROUP,
      alertType,
      undefined,
      passthrough
    );
  } catch (error: any) {
    console.log(
      "Failed to send group created welcome message.\n",
      error.message + "\n",
      error.cause
    );
  }
  return;
}

/**
 *
 * @param {any} requestBodyData
 */
export async function messageSentWebhookHandler(
  requestBodyData: any
): Promise<void> {
  // Initalize the data manager
  const dataManager = new DataManager();

  // extract data from request body
  const alertType: AlertType = requestBodyData.alert_type ?? AlertType.UNKNOWN;
  const messageDeliveredSuccessfully: boolean =
    requestBodyData.success ?? false;
  const passthroughData: string = requestBodyData.passthrough ?? "";

  let passthroughDataJSON: any;
  let uid: string;
  let sessionId: string;
  let incomingMessageType: string;
  let isValidSubscription: boolean;
  let hasValidMessagesRemaining: boolean;

  if (passthroughData) {
    passthroughDataJSON = JSON.parse(passthroughData);
    uid = passthroughDataJSON.uid ?? "";
    sessionId = passthroughDataJSON.sessionId ?? "";
    incomingMessageType = passthroughDataJSON.incomingMessageType ?? "";
    isValidSubscription = passthroughDataJSON.isValidSubscription ?? false;
    hasValidMessagesRemaining =
      passthroughDataJSON.hasValidMessagesRemaining ?? false;
  } else {
    console.log(
      "No uid or passthrough data present! Cannot charge user. BREAK!"
    );
    const toLog: LoggingObject = {
      session_id: "",
      event_type: LoggingEventType.INCOMING_WEBHOOK,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.FAILED,
      http_info: alertType,
      http_type: 400,
    };
    console.log(JSON.stringify(toLog));
    return;
  }

  if (messageDeliveredSuccessfully) {
    // Begin switch statement to check how/if we should charge user
    switch (incomingMessageType) {
    case MessageType.PRIVATE_MESSAGE: {
      console.log("Charging user for private message.");
      await createReceiptForSuccessfulPrivateMessageDelivery(
        dataManager,
        requestBodyData,
        isValidSubscription,
        hasValidMessagesRemaining,
        uid
      );
      console.log(
        "Completed processing of 'message_sent' webhook for private message."
      );
      break;
    }
    case MessageType.GROUP_MESSAGE: {
      console.log("Charging user for group message.");
      await createReceiptForSuccessfulGroupMessageDelivery(
        dataManager,
        requestBodyData,
        isValidSubscription,
        hasValidMessagesRemaining,
        uid
      );
      console.log(
        "Completed processing of 'message_sent' webhook for group message."
      );
      break;
    }
    default: {
      console.log(
        "Not charging user since message was of type", incomingMessageType
      );
    }
    }
  } else { // !messageDeliveredSuccessfully
    console.log(
      "Message was not successfully delivered to user." +
      "Examples: your recipient blocked you or uses " +
      "filters from unknown senders, or user has an Android phone."
    );
    const toLog: LoggingObject = {
      uid: uid,
      session_id: sessionId,
      event_type: LoggingEventType.INCOMING_WEBHOOK,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.FAILED,
      http_info: alertType,
      http_type: 400,
    };
    console.log(JSON.stringify(toLog));
  }
}

/**
 *
 * @param {any} requestBodyData
 */
export async function messageFailedOrTimeoutWebhookHandler(
  requestBodyData: any
): Promise<void> {
  // extract data from request body
  const passthroughData: string = requestBodyData.passthrough ?? "";
  const passthroughDataJSON: any = JSON.parse(passthroughData);
  const uid: string = passthroughDataJSON.uid ?? "";
  const sessionId: string = passthroughDataJSON.sessionId ?? "";
  const alertType: AlertType = requestBodyData.alert_type ?? AlertType.UNKNOWN;
  const toLog: LoggingObject = {
    uid: uid,
    session_id: sessionId,
    event_type: LoggingEventType.INCOMING_WEBHOOK,
    event_provider: LoggingEventProvider.LOOP_MESSAGE,
    event_status: LoggingEventStatus.FAILED,
    http_info: alertType,
    http_type: 400,
  };
  console.log(JSON.stringify(toLog));
}

/**
 *
 * @param {any} requestBodyData
 * @param {string} sessionId
 * @param {string} uid
 * @param {boolean} isValidSubscription
 * @param {boolean} hasValidMessagesRemaining
 * @param {LoopApiManager} loopApiManager
 * @param {OpenaiApiManager} openaiApiManager
 */
export async function privateMessageHandler(
  requestBodyData: any,
  sessionId: string,
  uid: string,
  isValidSubscription: boolean,
  hasValidMessagesRemaining: boolean,
  loopApiManager: LoopApiManager,
  openaiApiManager: OpenaiApiManager
): Promise<void> {
  // Initalize the data manager
  const dataManager = new DataManager();

  // Grab parameters from Loop Webhook
  const messageRecipient: string = requestBodyData.recipient ?? "";
  const incomingUserMessage: string = requestBodyData.text ?? "";
  const alertType: AlertType = requestBodyData.alert_type ?? AlertType.UNKNOWN;

  // get the user-specified stored botName from Firebase Firestore
  let botName: string;
  try {
    const result = await dataManager.getDocument(
      Collection.BOT_NAMES,
      uid,
      undefined,
      undefined
    );
    botName = result?.botName ?? "aiMessages";
  } catch (error: any) {
    console.log("Error:", error.message);
    console.log("No botName found. Using default botName: \"aiMessages\"");
    botName = "aiMessages";
  }

  // get the user-specified stored personality from Firebase Firestore
  let personality: string;
  try {
    const result = await dataManager.getDocument(
      Collection.PERSONALITY,
      uid,
      undefined,
      undefined
    );
    personality = result?.prompt ?? "You are a helpful assistant.";
  } catch (error: any) {
    console.log("Error:", error.message);
    console.log("No personality found, using default " +
      "personality prompt: \"You are a helpful assistant.\"");
    personality = "You are a helpful assistant.";
  }
  // Add botName to the end of the personality prompt so that the LLM knows
  personality += ` Your name is ${botName}.`;

  // create the ChatCompletionRequestMessage array to send to OpenAIApi
  // Retrieve array of recent messages sent by user
  // and recent messages responses sent by assistant (i.e., ChatGPT)
  let userMessagesArr: string[];
  let assistantMessagesArr: string[];
  try {
    const result = await dataManager.getDocument(
      Collection.CACHED_PRIVATE_MESSAGES,
      uid,
      undefined,
      undefined
    );
    userMessagesArr = result?.cachedUserMessages ?? [];
    assistantMessagesArr = result?.cachedAssistantMessages ?? [];
  } catch (error: any) {
    console.log("Error:", error.message);
    userMessagesArr = [];
    assistantMessagesArr = [];
  }

  // if the userMessagesArr and assistantMessagesArr are the same length,
  // update array of userMessages by appending new message to end
  // of the array. Now userMessages array should be
  // +1 the length of assistantMessages array, so that we can properly
  // format it to send to OpenAI ChatCompletion API
  if (userMessagesArr.length === assistantMessagesArr.length) {
    userMessagesArr.push(incomingUserMessage);
  } else if (userMessagesArr.length === assistantMessagesArr.length + 1) {
    // If the cached userMessagesArr length is +1 the length of
    // cached assistantMessagesArr, then we append the incoming message
    // to the last element of userMessagesArr, since the number of messages
    // is already appropriate for formatting for the OpenAIApi call
    userMessagesArr[userMessagesArr.length - 1] += ` ${incomingUserMessage}`;
  }

  // format "messages" parameter to send to OpenAIApi
  // Note that userMessagesArr must always have (length + 1) of whatever
  // assistantMessagesArr's length is, since the format for an OpenAIApi
  // message is [{user:}, {assistant:}, {user:}, {assistant:}, ..., {user:}]
  // typically this means assistantMessagesArr is length MAX_MESSAGE_HISTORY
  // (imported from constants.ts)
  // and userMessagesArr is length MAX_MESSAGE_HISTORY + 1
  const {messages, numTokensRequired} = formatOpenAIApiMessages(
    assistantMessagesArr,
    userMessagesArr,
    personality
  );

  // Try to generate a response via OpenAI's API.
  // Exponential backoff is implemented inside the
  // generateResponseToMessage function call.
  // If OpenAI API continues to return HTTPS error messages
  // send a message to the user to try again
  let assistantMessageResponse = "";
  let errorMessage = "";
  try {
    assistantMessageResponse =
      await openaiApiManager.generateResponseWithOpenAiChatCompletionApi(
        uid,
        sessionId,
        messages,
        numTokensRequired,
        uid,
        0
      );
  } catch (error: any) {
    errorMessage = error.message;
  }
  // send response back to user
  // Exponential backoff is implemented inside sendLoopMessage function call.
  // If Loop continues to return HTTPS error messages nothing is sent to user.
  if (assistantMessageResponse) {
    try {
      const passthrough: string =
        `{"uid": "${uid}", ` +
        `"sessionId": "${sessionId}", ` +
        `"incomingMessageType": "${MessageType.PRIVATE_MESSAGE}", ` +
        `"isValidSubscription": ${isValidSubscription}, ` +
        `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;
      await loopApiManager.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        undefined,
        assistantMessageResponse,
        alertType,
        undefined,
        passthrough
      );
    } catch (error: any) {
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
    }
  } else {
    try {
      const passthrough: string =
        `{"uid": "${uid}", ` +
        `"sessionId": "${sessionId}", ` +
        `"incomingMessageType": "${MessageType.PRIVATE_ERROR_MESSAGE}", ` +
        `"isValidSubscription": ${isValidSubscription}, ` +
        `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;
      await loopApiManager.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        undefined,
        errorMessage,
        alertType,
        undefined,
        passthrough
      );
    } catch (error: any) {
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
    }
  }
  // if we receive an OpenAi Api response,
  // add the new assistant response to recent assistant messages array
  // if we now exceed MAX_MESSAGE_HISTORY, it will get trimmed below
  // when we call the `verifyLengthAndTrimMessagesArray` helper function
  if (assistantMessageResponse) {
    assistantMessagesArr.push(assistantMessageResponse);

    // make sure message arrays are proper lengths before updating
    userMessagesArr =
      verifyLengthAndTrimMessagesArray(userMessagesArr);
    assistantMessagesArr =
      verifyLengthAndTrimMessagesArray(assistantMessagesArr);
  }

  // push updated arrays to Firebase Firestore
  const cachedDataToUpload: DocumentData = {
    cachedUserMessages: userMessagesArr,
    cachedAssistantMessages: assistantMessagesArr,
  };

  try {
    await dataManager.setDocument(
      cachedDataToUpload,
      Collection.CACHED_PRIVATE_MESSAGES,
      uid,
      undefined,
      undefined
    );
    console.log("cachedPrivateMessages Array successfully " +
      "uploaded to Firestore.");
  } catch (error: any) {
    console.log(
      "Error during cachedPrivateMessages data upload:",
      error.message
    );
  }
}

/**
 *
 * @param {any} requestBodyData
 * @param {string} sessionId
 * @param {string} uid
 * @param {boolean} isValidSubscription
 * @param {boolean} hasValidMessagesRemaining
 * @param {LoopApiManager} loopApiManager
 * @param {OpenaiApiManager} openaiApiManager
 */
export async function groupMessageHandler(
  requestBodyData: any,
  sessionId: string,
  uid: string,
  isValidSubscription: boolean,
  hasValidMessagesRemaining: boolean,
  loopApiManager: LoopApiManager,
  openaiApiManager: OpenaiApiManager
): Promise<void> {
  // Initalize the data manager
  const dataManager = new DataManager();

  // Grab parameters from Loop Webhook
  const messageRecipient: string = requestBodyData.recipient ?? "";
  const groupID: string = requestBodyData.group.group_id ?? "";
  const alertType: AlertType = requestBodyData.alert_type ?? AlertType.UNKNOWN;

  // NOTE: for group messages, we prepend messageRecipient
  // info to the incoming message so ChatGPT can keep track
  // of which user sent which message
  const incomingUserMessage: string = requestBodyData.text === undefined ?
    `${messageRecipient}: ` : `${messageRecipient}: ${requestBodyData.text}`;

  // get the user-specified stored botName from Firebase Firestore
  let botName: string;
  try {
    const result = await dataManager.getDocument(
      Collection.BOT_NAMES,
      uid,
      undefined,
      undefined
    );
    botName = result?.botName ?? "aiMessages";
  } catch (error: any) {
    console.log("Error:", error.message);
    console.log("No botName found. Using default botName: \"aiMessages\"");
    botName = "aiMessages";
  }

  const isBotNamePresent: boolean = doesTextContainBotName(
    botName,
    incomingUserMessage
  );

  // get the user-specified stored personality from Firebase Firestore
  let personality: string;
  try {
    const result = await dataManager.getDocument(
      Collection.PERSONALITY,
      uid,
      undefined,
      undefined
    );
    personality = result?.prompt ?? "You are a helpful assistant.";
  } catch (error: any) {
    console.log("Error:", error.message);
    console.log("No personality found, using default " +
      "personality prompt: \"You are a helpful assistant.\"");
    personality = "You are a helpful assistant.";
  }
  // Add botName to the end of the personality prompt so that the LLM knows
  personality += ` Your name is ${botName}.`;

  // create the ChatCompletionRequestMessage array to send to OpenAIApi
  // Retrieve array of recent messages sent by user and array of recent
  // message responses sent by assistant (i.e., ChatGPT)
  let userMessagesArr: string[];
  let assistantMessagesArr: string[];
  try {
    const result = await dataManager.getDocument(
      Collection.CACHED_GROUP_MESSAGES,
      groupID,
      undefined,
      undefined
    );
    userMessagesArr = result?.cachedUserMessages ?? [];
    assistantMessagesArr = result?.cachedAssistantMessages ?? [];
  } catch (error: any) {
    console.log("Error:", error.message);
    userMessagesArr = [];
    assistantMessagesArr = [];
  }

  // ===============================================================
  // TODO - convert allAssistantMessagesArr to a set, and check if
  // user sent a messageReaction to something the assistant said...
  // ===============================================================

  if (isBotNamePresent) {
    // if botName is present in the text, triggering a response from ChatGPT,
    // and if the cached userMessagesArr and cached assistantMessagesArr
    // are the same length, then we simply append the incoming message
    // to userMessagesArr. Now userMessages array should be
    // +1 the length of assistantMessages array, so that we can properly
    // format it to send to OpenAI ChatCompletion API
    if (userMessagesArr.length === assistantMessagesArr.length) {
      userMessagesArr.push(incomingUserMessage);
    } else if (userMessagesArr.length === assistantMessagesArr.length + 1) {
      // if botName is present in the text, triggering a response from
      // ChatGPT, and if the cached userMessagesArr.length is +1 the length of
      // cached assistantMessagesArr, then we append the incoming message
      // to the last element of userMessagesArr, since the number of messages
      // is already appropriate for formatting for the OpenAIApi call
      userMessagesArr[userMessagesArr.length - 1] += ` ${incomingUserMessage}`;
    }
    // format "messages" parameter to send to OpenAIApi
    // Note that userMessagesArr must always have (length + 1) of whatever
    // assistantMessagesArr's length is, since the format for an OpenAIApi
    // message is [{user:}, {assistant:}, {user:}, {assistant:}, ..., {user:}]
    // typically this means assistantMessagesArr is length MAX_MESSAGE_HISTORY
    // (imported from constants.ts)
    // and userMessagesArr is length MAX_MESSAGE_HISTORY + 1
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistantMessagesArr,
      userMessagesArr,
      personality
    );

    // Try to generate a response via OpenAI's API
    // Exponential backoff is implemented inside the
    // generateResponseToMessage function call.
    // If OpenAI API continues to return HTTPS error messages
    // send a message to the user to try again
    let assistantMessageResponse = "";
    let errorMessage = "";
    try {
      assistantMessageResponse =
        await openaiApiManager.generateResponseWithOpenAiChatCompletionApi(
          uid,
          sessionId,
          messages,
          numTokensRequired,
          uid,
          0
        );
    } catch (error: any) {
      errorMessage = error.message;
    }
    // send response back to user
    // Exponential backoff is implemented inside sendLoopMessage function call.
    // If Loop continues to return HTTPS error messages nothing is sent to user.
    if (assistantMessageResponse) {
      const passthrough: string =
        `{"uid": "${uid}", ` +
        `"sessionId": "${sessionId}", ` +
        `"group_id": "${groupID}", ` +
        `"incomingMessageType": "${MessageType.GROUP_MESSAGE}", ` +
        `"isValidSubscription": ${isValidSubscription}, ` +
        `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;
      try {
        await loopApiManager.sendLoopMessage(
          uid,
          sessionId,
          undefined,
          groupID,
          assistantMessageResponse,
          alertType,
          undefined,
          passthrough
        );
      } catch (error: any) {
        console.log(
          "Error with sending message via loop.\n",
          error.message + "\n",
          error.cause
        );
      }
    } else {
      const passthrough: string =
        `{"uid": "${uid}", ` +
        `"sessionId": "${sessionId}", ` +
        `"group_id": "${groupID}", ` +
        `"incomingMessageType": "${MessageType.GROUP_ERROR_MESSAGE}", ` +
        `"isValidSubscription": ${isValidSubscription}, ` +
        `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;
      try {
        await loopApiManager.sendLoopMessage(
          uid,
          sessionId,
          undefined,
          groupID,
          errorMessage,
          alertType,
          undefined,
          passthrough
        );
      } catch (error: any) {
        console.log(
          "Error with sending message via loop.\n",
          error.message + "\n",
          error.cause
        );
      }
    }
    // if we receive an OpenAi Api response,
    // add the new assistant response to recent assistant messages array
    // if we now exceed MAX_MESSAGE_HISTORY, it will get trimmed below
    // when we call the `verifyLengthAndTrimMessagesArray` helper function
    if (assistantMessageResponse) {
      assistantMessagesArr.push(assistantMessageResponse);
    }

    // TODO -
    // add hash of new assistant response to assistant messages array
    // containing list of all responses in this group
    // const hashAssistantMessageResponse: string =
    // hashString(assistantMessageResponse);
    // allAssistantMessagesArr.push(hashAssistantMessageResponse);

    // make sure message arrays are proper lengths
    userMessagesArr =
      verifyLengthAndTrimMessagesArray(userMessagesArr);
    assistantMessagesArr =
      verifyLengthAndTrimMessagesArray(assistantMessagesArr);
  } else { // botName not present
    // if botName is NOT present in the text then we don't generate a response.
    // If the cached userMessagesArr and cached assistantMessagesArr
    // are the same length, then we simply append the incoming message
    // to userMessagesArr.
    if (userMessagesArr.length === assistantMessagesArr.length) {
      userMessagesArr.push(incomingUserMessage);
    } else if (userMessagesArr.length === assistantMessagesArr.length + 1) {
      // if botName is NOT present in the text, and if the cached
      // userMessagesArr.length is +1 the length of cached assistantMessagesArr
      // then we append the incoming message to the last element of
      // userMessagesArr. This is to maintain group message chat context
      // for the next time that a response from ChatGPT is triggered
      userMessagesArr[userMessagesArr.length - 1] += ` ${incomingUserMessage}`;
    }
  }

  // push updated arrays to Firebase Firestore
  const data: any = {
    cachedUserMessages: userMessagesArr,
    cachedAssistantMessages: assistantMessagesArr,
  };

  try {
    await dataManager.setDocument(
      data,
      Collection.CACHED_GROUP_MESSAGES,
      groupID,
      undefined,
      undefined
    );
    console.log("cachedGroupMessages Array successfully " +
      "uploaded to Firestore.");
  } catch (error: any) {
    console.log(
      "Error during cachedGroupMessages data upload:",
      error.message
    );
  }
}
