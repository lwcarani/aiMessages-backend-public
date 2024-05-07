// // standard imports
// The Cloud Functions for Firebase SDK to create Cloud Functions
// and set up triggers.
import * as functions from "firebase-functions";
// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";
import {PubSub} from "@google-cloud/pubsub";
import {v4 as uuidv4} from "uuid";
// // custom imports
// dataManager.ts
import {
  DataManager,
  DocumentData,
} from "./utils/dataManager";
// stabilityApiManager
import {
  StabilityApiManager,
} from "./apis/stabilityApiManager";
// clipdropApiManager
import {
  ClipdropApiManager,
} from "./apis/clipdropApiManager";
// openaiApiManager
import {
  OpenaiApiManager,
} from "./apis/openaiApiManager";

// constants.ts
import {
  ChargeType,
  ImageRequestType,
  AlertType,
  Collection,
  SubCollection,
  PROMOTIONAL_MESSAGE_CREDIT_ISSUE,
  LoggingEventProvider,
  LoggingEventStatus,
  LoggingObject,
  LoggingEventType,
} from "./globals";

// handlers.ts for handling Loop Webhook responses
import {
  privateMessageHandler,
  groupMessageHandler,
  messageSentWebhookHandler,
  privateConversationInitedWebhookHandler,
  groupCreatedWebhookHandler,
  messageFailedOrTimeoutWebhookHandler,
} from "./handlers";

// apis
import {
  LoopApiManager,
} from "./apis/loopApiManager";

// utils.ts
import {
  isValidConsumableProductID,
  isValidPurchaseType,
  verifyAuthHeader,
  parseNumberOfMessageCredits,
} from "./utils/utils";

// firebase-utils.ts
import {
  checkValidSubscriptionOrMessagesRemaining,
  getUIDGivenIMessageAccount,
  getNumMessagesRemainingAndLatestReceipt,
} from "./utils/firebaseUtils";

import * as serviceAccount
  from "../chadbot-serviceAccount.json";

admin.initializeApp({
  storageBucket: "chadbot-c97e6.appspot.com",
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
// Init dataManager
const dataManager = new DataManager();

exports.callableExtensionImageHandler = functions
  .runWith({
    secrets: [
      "LOOP_AUTH_SECRET_KEY",
      "LOOP_SECRET_API_KEY_FOR_CONVERSATION",
      "STABILITY_API_KEY",
      "CLIPDROP_API_KEY",
    ],
  })
  .https
  .onCall(async (data, context) => {
    // Checking that the user is authenticated.
    if (!context.auth || !context.auth.uid) {
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        "failed-precondition",
        "The function must be called while authenticated (need a valid uid)."
      );
    }
    // grab the uid and initialize sessionId
    const uid: string = context.auth?.uid || "";
    const sessionId: string = uuidv4();

    // Step 1.)
    // Check user status: valid subscription and/or message credits remaining
    const {
      isValidSubscription,
      hasValidMessagesRemaining,
      wasUserWarnedNoCreditsRemaining,
    } = await checkValidSubscriptionOrMessagesRemaining(dataManager, uid);

    if (
      !isValidSubscription &&
      !hasValidMessagesRemaining &&
      !wasUserWarnedNoCreditsRemaining
    ) {
      // If the customer does not have a valid description, and
      // if the customer does not have valid message tokens remaining,
      // exit control flow, do not send a response

      // lazy load loop api manager - not always needed
      // Get secrets
      const loopAuthSecretKey = process.env.LOOP_AUTH_SECRET_KEY ?? "";
      const loopAuthSecretKeyConvo =
        process.env.LOOP_SECRET_API_KEY_FOR_CONVERSATION ?? "";

      // initialize Loop API Manager
      const loopApiManager = new LoopApiManager(
        loopAuthSecretKey,
        loopAuthSecretKeyConvo
      );
      await loopApiManager.sendNotificationMessageToUserOutOfMessageCredits(
        dataManager,
        uid,
        sessionId
      );
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        "not-found",
        "No valid subscription or message tokens were found for this user."
      );
    } else if (!isValidSubscription && !hasValidMessagesRemaining) {
      console.log("Exiting auth flow: no valid subscription and no valid " +
        "message tokens remaining; no message response sent.");
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        "not-found",
        "No valid subscription or message tokens were found for this user."
      );
    }

    // Step 2.) proceed with API call
    // If user has a validSubscription or validMessagesRemaining,
    // then proceed to openai API call
    let caption: string;
    let image: string | undefined;
    let requestType: ImageRequestType | undefined;
    const idArray: string[] = [];
    let numSamples = 1;
    let eventProvider: LoggingEventProvider;

    if (data) {
      // grab the image caption from the snapshot data
      caption = data.caption ?? "";
      // grab the base64 encoding for the image from the snapshot data
      image = data.image ?? undefined;
      // grab the requestType from the snapshot data
      requestType = data.requestType as ImageRequestType ?? undefined;
      // grab the number of image samples the user requested to be generated
      // to be compatible with old versions of app, if `numSamples` is not
      // present in body, set to 1
      numSamples = Number(data.numSamples ?? 1);
      // now, create a new unique id for every image sample we need to generate
      for (let index = 0; index < numSamples; index++) {
        idArray[index] = uuidv4();
      }
    } else {
      console.log("Exiting image handling, no data found in body of request.");
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        "invalid-argument",
        "No data was passed in the body of the request."
      );
    }

    // requestType is either a Stability.AI API call
    // or a Clipdrop API call
    let imageResponseBase64Array: string[] = [];
    if (
      requestType === ImageRequestType.CREATE ||
      requestType === ImageRequestType.EDIT ||
      requestType === ImageRequestType.EDIT_WITH_MASK
    ) {
      // lazy load stability ai api manager
      // Get secret
      const stabilityApiKey = process.env.STABILITY_API_KEY ?? "";
      // Initalize api manager
      const stabilityApiManager = new StabilityApiManager(
        stabilityApiKey
      );
      // specify the event_provider for logging
      eventProvider = LoggingEventProvider.STABILITY_AI;
      try {
        imageResponseBase64Array = await stabilityApiManager.callStabilityAiApi(
          uid,
          sessionId,
          requestType,
          caption,
          numSamples,
          image
        );
      } catch (error: any) {
        // return stability.ai api error to client
        throw new functions.https.HttpsError(
          "not-found",
          error.cause
        );
      }
    } else if (requestType === ImageRequestType.DOODLE) {
      // lazy load clipdrop api manager
      // Get secret
      const clipdropApiKey = process.env.CLIPDROP_API_KEY ?? "";
      // Initalize api manager
      const clipdropApiManager = new ClipdropApiManager(
        clipdropApiKey
      );
      // specify the event_provider for logging
      eventProvider = LoggingEventProvider.CLIPDROP;
      try {
        imageResponseBase64Array = await clipdropApiManager.callClipdropApi(
          uid,
          sessionId,
          requestType,
          caption,
          image
        );
      } catch (error: any) {
        // return stability.ai api error to client
        throw new functions.https.HttpsError(
          "not-found",
          error.cause
        );
      }
    } else {
      const errorMessage = "No valid ImageRequestType: Please specify one " +
        `of '${ImageRequestType.CREATE}', '${ImageRequestType.EDIT}', ` +
        `'${ImageRequestType.EDIT_WITH_MASK}' or ${ImageRequestType.DOODLE}`;
      // Throwing an HttpsError so that the client gets the error details.
      throw new functions.https.HttpsError(
        "not-found",
        errorMessage
      );
    }

    // make sure that we got a valid array of b64 string(s) back from API call
    // if `imageResponseBase64Array` is empty | null | undefined,
    // or if `imageResponseBase64Array` is not type Array, throw an error
    if (
      !imageResponseBase64Array ||
      !Array.isArray(imageResponseBase64Array)
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Base64 image string array returned by API is invalid or missing."
      );
    }

    // Return image to client then use Pub/Sub to
    // save image to storage and upload cloud URL
    const pubsub = new PubSub();
    const topic = pubsub.topic("image-handler-process");
    const json = {
      imageResponseBase64Array: imageResponseBase64Array,
      uid: uid,
      idArray: idArray,
      caption: caption,
      numSamples: numSamples,
      sessionId: sessionId,
      isValidSubscription: isValidSubscription,
      hasValidMessagesRemaining: hasValidMessagesRemaining,
      wasUserWarnedNoCreditsRemaining: wasUserWarnedNoCreditsRemaining,
    };

    // publish message, then once promise is resolved that
    // message has been published, send image to client

    // Log start of Pub/Sub
    const toLogPubSub: LoggingObject = {
      session_id: sessionId,
      event_type: LoggingEventType.PUBLICATION,
      event_status: LoggingEventStatus.REQUESTED,
      event_provider: eventProvider,
      http_type: 200,
    };
    console.log(JSON.stringify(toLogPubSub));

    return topic.publishMessage({json})
      .then((messageId) => {
        // Log Pub/Sub finish
        const toLogPubSub: LoggingObject = {
          session_id: sessionId,
          event_type: LoggingEventType.PUBLICATION,
          event_status: LoggingEventStatus.COMPLETED,
          event_provider: eventProvider,
          http_type: 200,
          http_info: messageId,
        };
        console.log(JSON.stringify(toLogPubSub));
        // Return the generated image to the client.
        if (numSamples === 1) {
          const imageResponseBase64: string = imageResponseBase64Array[0];
          return {
            caption: caption,
            image: imageResponseBase64,
          };
        } else {
          return {
            caption: caption,
            image: imageResponseBase64Array,
          };
        }
      })
      .catch((error) => {
        // Log Pub/Sub failed (bad gateway)
        const toLogPubSub: LoggingObject = {
          session_id: sessionId,
          event_type: LoggingEventType.PUBLICATION,
          event_status: LoggingEventStatus.FAILED,
          event_provider: eventProvider,
          http_type: 502,
        };
        console.log(JSON.stringify(toLogPubSub));
        // Throwing an HttpsError so that the client gets the error details.
        throw new functions.https.HttpsError(
          "not-found",
          error
        );
      });
  });

exports.callableExtensionImageHandlerPubSub = functions
  .pubsub
  .topic("image-handler-process")
  .onPublish(async (message) => {
    // parse json data
    const requestBodyData: any = message.json;
    const imageResponseBase64Array: string[] =
      requestBodyData.imageResponseBase64Array ?? [];
    const uid: string = requestBodyData.uid ?? "";
    const idArray: string[] = requestBodyData.idArray ?? [];
    const caption: string = requestBodyData.caption ?? "";
    const numSamples: number = requestBodyData.numSamples ?? 1;
    const sessionId: string = requestBodyData.sessionId ?? "";
    const isValidSubscription: boolean =
      requestBodyData.isValidSubscription ?? false;
    const hasValidMessagesRemaining: boolean =
      requestBodyData.hasValidMessagesRemaining ?? false;


    // NOTE: Must do Timestamp this way (known issue on GitHub)
    // as opposed to admin.firestore().Timestamp...
    // lazy load Timestamp
    const {Timestamp} = await import("firebase-admin/firestore");
    const messageTimestamp = Timestamp.now().toDate();

    let cloudURL: string;
    // push all images to Cloud storage generating a cloudURL for each one
    // then save that cloudURL to Firebase Firestore
    for (let index = 0; index < imageResponseBase64Array.length; index++) {
      const imageResponseBase64 = imageResponseBase64Array[index];
      const id = idArray[index];
      try {
        cloudURL = await dataManager.pushImageToStorageBucket(
          imageResponseBase64,
          uid,
          id,
          sessionId
        );
      } catch (error: any) {
        console.log(
          "Error while uploading the image to Firebase Cloud storage:" +
          error.message + " Please try again."
        );
        return null;
      }

      // Try to update extensionMessage edits doc with ChatGPT response
      // use the id from the request (client) to update the response doc
      const dataToUpload: DocumentData = {
        caption: caption,
        cloudURL: cloudURL,
        messageTimestamp: messageTimestamp,
      };

      try {
        await dataManager.setDocument(
          dataToUpload,
          Collection.EXTENSION_IMAGE_HISTORY,
          uid,
          SubCollection.IMAGE_RESPONSES,
          id
        );
      } catch (error: any) {
        console.log(
          "Error during extensionImageHistory data upload:" + error.message +
          " Please try again."
        );
        return null;
      }
    }

    // Now update customerExpenses collection to track the current transaction
    const chargeType = isValidSubscription ?
      ChargeType.SUBSCRIPTION : hasValidMessagesRemaining ?
        ChargeType.TOKEN : "";

    // only add doc to customerExpenses collection if we actually charge user
    // and if message was successfully sent to user
    const expenseDataToUpload: DocumentData = {
      messageTimestamp: messageTimestamp,
      paidWithSubscriptionOrToken: chargeType,
      responseType: "iMessage extension image generation",
      amount: numSamples,
    };

    try {
      return dataManager.addDocument(
        expenseDataToUpload,
        Collection.CUSTOMER_EXPENSES,
        uid,
        SubCollection.EXTENSION_MESSAGE_IMAGES
      );
    } catch (error: any) {
      console.log(
        "Error during customerExpenses data upload " +
        "for charging user for image extension use:",
        error.message
      );
      return null;
    }
  });

exports.imageHistoryDeleteFromStorage = functions
  .firestore
  .document("/extensionImageHistory/{uid}/imageResponses/{documentID}")
  .onDelete(async (snap, context) => {
    // grab the uid and documentID from context.params
    const uid: string = context.params.uid;
    const documentID: string = context.params.documentID;

    return admin.storage().bucket().deleteFiles({
      prefix: `historyImages/${uid}/${documentID}/`,
    })
      .catch((error: any) => {
        console.log(error.message);
        console.log(`Failed to delete all images of user ${uid}`);
      });
  });

exports.updateMessageTokenCountFromEvents = functions
  .firestore
  .document("/events/{documentID}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore
    const data: admin.firestore.DocumentData = snap.data();
    const productID: string = data.product_id ?? "";
    const uid: string = data.app_user_id ?? "";
    const type: string = data.type ?? "";
    const docID: string = context.params.documentID ?? "";

    const validType: boolean = isValidPurchaseType(type);
    const validMessagesPurchased: boolean = isValidConsumableProductID(
      productID
    );

    // Check here for all relevant webhook types to check:
    // https://www.revenuecat.com/docs/webhooks
    if (validType && validMessagesPurchased) {
      // parse out the number of messages that were purchased
      const numberOfMessagesPurchased = parseNumberOfMessageCredits(productID);

      console.log("Updating user's number of messages...");
      console.log(`product_id: ${productID}`);
      console.log(
        `Number of purchased messages: ${numberOfMessagesPurchased}`
      );
      console.log(`type: ${type}`);

      const {
        numberOfMessagesRemaining,
        latestReceipt,
      } = await getNumMessagesRemainingAndLatestReceipt(dataManager, uid);
      const newMessageCount: number =
        numberOfMessagesRemaining + numberOfMessagesPurchased;

      // check latest receipt to ensure idempotency
      if (docID === latestReceipt) {
        console.log(
          "Duplicate receipts found, already updated balance. Exiting."
        );
        return null;
      }

      // anytime user purchases more message credits, reset the
      // `wasUserWarnedNoCreditsRemaining` field to false
      const dataToUpload: DocumentData = {
        numberOfMessagesRemaining: newMessageCount,
        wasUserWarnedNoCreditsRemaining: false,
        latestReceipt: docID,
      };

      try {
        return dataManager.setDocument(
          dataToUpload,
          Collection.CONSUMABLE_BALANCE,
          uid
        );
      } catch (error: any) {
        console.log(
          "Error during consumableBalance data upload:",
          error.message
        );
        return null;
      }
    } else {
      console.log("Product type not valid or this is " +
        "not message purchase; exiting function.");
      return null;
    }
  });

exports.updateMessageTokenCountFromPromotions = functions
  .firestore
  .document("/customerExpenses/{uid}/promotions/{documentID}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore
    const data: admin.firestore.DocumentData = snap.data();
    const promotionAmount = Number(data.amount ?? 0);
    const uid: string = context.params.uid ?? "";
    const docID: string = context.params.documentID ?? "";
    const {
      numberOfMessagesRemaining,
      latestReceipt,
    } = await getNumMessagesRemainingAndLatestReceipt(dataManager, uid);
    const updatedNumberOfMessagesRemaining: number =
      promotionAmount + numberOfMessagesRemaining;

    // check latest receipt to ensure idempotency
    if (docID === latestReceipt) {
      console.log(
        "Duplicate receipts found, already updated balance. Exiting."
      );
      return null;
    }

    // `PROMOTIONAL_MESSAGE_CREDIT_ISSUE` is a global constant
    // currently set to 25 as of 10May2023
    // currently set to 10 as of 13June2023
    const dataToUpload: DocumentData = {
      numberOfMessagesRemaining: updatedNumberOfMessagesRemaining,
      wasUserWarnedNoCreditsRemaining: false,
      latestReceipt: docID,
    };
    try {
      return dataManager.setDocument(
        dataToUpload,
        Collection.CONSUMABLE_BALANCE,
        uid
      );
    } catch (error: any) {
      console.log(
        "Error during consumableBalance data upload " +
        "for promotion token issuance (first-time user):",
        error.message
      );
      return null;
    }
  });

exports.chargeUserForExtensionImageUse = functions
  .firestore
  .document("/customerExpenses/{uid}/extensionMessageImages/{documentID}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore
    const data: admin.firestore.DocumentData = snap.data();
    const amount = Number(data.amount ?? 1);
    const chargeType: ChargeType | undefined =
      data.paidWithSubscriptionOrToken ?? undefined;
    const uid: string = context.params.uid ?? "";
    const docID: string = context.params.documentID ?? "";
    let {
      numberOfMessagesRemaining,
      latestReceipt,
    } = await getNumMessagesRemainingAndLatestReceipt(dataManager, uid);

    // check latest receipt to ensure idempotency
    if (docID === latestReceipt) {
      console.log(
        "Duplicate receipts found, already updated balance. Exiting."
      );
      return null;
    }

    if (chargeType === ChargeType.TOKEN) {
      numberOfMessagesRemaining = numberOfMessagesRemaining - amount;
    }

    const dataToUpload: DocumentData = {
      numberOfMessagesRemaining: numberOfMessagesRemaining,
      wasUserWarnedNoCreditsRemaining: false,
      latestReceipt: docID,
    };
    try {
      return dataManager.setDocument(
        dataToUpload,
        Collection.CONSUMABLE_BALANCE,
        uid
      );
    } catch (error: any) {
      console.log(
        "Error during consumableBalance data upload: ",
        error.message
      );
      return null;
    }
  });

exports.chargeUserForPrivateMessageUse = functions
  .firestore
  .document("/customerExpenses/{uid}/private/{documentID}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore
    const data: admin.firestore.DocumentData = snap.data();
    const chargeType: ChargeType | undefined =
      data.paidWithSubscriptionOrToken ?? undefined;
    const uid: string = context.params.uid ?? "";
    const docID: string = context.params.documentID ?? "";
    let {
      numberOfMessagesRemaining,
      latestReceipt,
    } = await getNumMessagesRemainingAndLatestReceipt(dataManager, uid);

    // check latest receipt to ensure idempotency
    if (docID === latestReceipt) {
      console.log(
        "Duplicate receipts found, already updated balance. Exiting."
      );
      return null;
    }

    if (chargeType === ChargeType.TOKEN) {
      numberOfMessagesRemaining--;
    }

    const dataToUpload: DocumentData = {
      numberOfMessagesRemaining: numberOfMessagesRemaining,
      wasUserWarnedNoCreditsRemaining: false,
      latestReceipt: docID,
    };
    try {
      return dataManager.setDocument(
        dataToUpload,
        Collection.CONSUMABLE_BALANCE,
        uid
      );
    } catch (error: any) {
      console.log(
        "Error during consumableBalance data upload: ",
        error.message
      );
      return null;
    }
  });

exports.chargeUserForGroupMessageUse = functions
  .firestore
  .document("/customerExpenses/{uid}/group/{documentID}")
  .onCreate(async (snap, context) => {
    // Grab the current value of what was written to Firestore
    const data: admin.firestore.DocumentData = snap.data();
    const chargeType: ChargeType | undefined =
      data.paidWithSubscriptionOrToken ?? undefined;
    const uid: string = context.params.uid ?? "";
    const docID: string = context.params.documentID ?? "";
    let {
      numberOfMessagesRemaining,
      latestReceipt,
    } = await getNumMessagesRemainingAndLatestReceipt(dataManager, uid);

    // check latest receipt to ensure idempotency
    if (docID === latestReceipt) {
      console.log(
        "Duplicate receipts found, already updated balance. Exiting."
      );
      return null;
    }

    if (chargeType === ChargeType.TOKEN) {
      numberOfMessagesRemaining--;
    }

    const dataToUpload: DocumentData = {
      numberOfMessagesRemaining: numberOfMessagesRemaining,
      wasUserWarnedNoCreditsRemaining: false,
      latestReceipt: docID,
    };
    try {
      return dataManager.setDocument(
        dataToUpload,
        Collection.CONSUMABLE_BALANCE,
        uid
      );
    } catch (error: any) {
      console.log(
        "Error during consumableBalance data upload: ",
        error.message
      );
      return null;
    }
  });

exports.firstTimeUserMessageCreditIssuance = functions
  .auth
  .user()
  .onCreate(async (user) => {
    // grab the uid from the user data
    const uid: string = user.uid;
    // NOTE: Must do Timestamp this way (known issue on GitHub)
    // as opposed to admin.firestore().Timestamp...
    // lazy load Timestamp
    const {Timestamp} = await import("firebase-admin/firestore");
    const messageTimestamp = Timestamp.now().toDate();
    const expenseDataToUpload: DocumentData = {
      messageTimestamp: messageTimestamp,
      amount: PROMOTIONAL_MESSAGE_CREDIT_ISSUE,
      message: "😊 Trial Credits, Welcome!",
    };
    try {
      return dataManager.addDocument(
        expenseDataToUpload,
        Collection.CUSTOMER_EXPENSES,
        uid,
        SubCollection.PROMOTIONS
      );
    } catch (error: any) {
      console.log(
        "Error during customerExpenses data upload " +
        "for promotion token issuance (first-time user):",
        error.message
      );
      return null;
    }
  });

// Take the Loop Webhook event passed to this HTTP endpoint and insert it into
// Firestore under the path /messages/:documentId/original
// Loop servers send POST requests, with the body in JSON representation
// We must return a 200 status code
// Loop requires we respond quickly so we do not timeout (15 seconds)
// Loop recommends that apps defer processing until after the response is sent
exports.loopMessageWebhookHandler = functions
  .runWith({
    secrets: [
      "LOOP_AUTH_BEARER_TOKEN",
    ],
  })
  .https
  .onRequest(async (request, response) => {
    // Get secret(s)
    const loopAuthBearerToken = process.env.LOOP_AUTH_BEARER_TOKEN ?? "";

    // Step 1.)
    // if request has proper auth header, immediately send 200 status code,
    // then commence processing
    const authHeader = request.get("authorization");
    const {statusCode, httpsResponseMessage} =
      verifyAuthHeader(authHeader, loopAuthBearerToken);
    console.log("Completed auth step!");

    // Set session_id and get alert_type of webhook
    const alertType: AlertType = request.body.alert_type ?? AlertType.UNKNOWN;
    let sessionId: string;
    // if sessionId is present in passthrough data of request body,
    // use that, otherwise, assign new sessionId to use for this webhook
    // Generally, passthrough.sessionId is present if this
    // is a "message_sent" webhook
    if ("passthrough" in request.body) {
      const passthroughData: string = request.body.passthrough ?? "";
      let passthroughDataJSON: any;
      if (passthroughData) {
        passthroughDataJSON = JSON.parse(passthroughData);
        sessionId = passthroughDataJSON.sessionId ?? "";
      } else {
        sessionId = "";
      }
    } else {
      sessionId = uuidv4();
    }

    // Log start of webhook processing
    const toLog: LoggingObject = {
      session_id: sessionId,
      event_type: LoggingEventType.INCOMING_WEBHOOK,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.RECEIVED,
      http_info: alertType,
      http_type: 200,
    };
    console.log(JSON.stringify(toLog));

    // Publish loop webhook body to the Pub/Sub
    const pubsub = new PubSub();
    const topic = pubsub.topic("loop-webhook-process");
    const json = request.body;
    json["session_id"] = sessionId;
    const typing: number = (alertType === AlertType.MESSAGE_INBOUND) ? 5 : 0;

    // publish message, then once promise is resolved that
    // message has been published, return statusCode back to loop
    // if there is an error, send loop a 500 code so that they retry

    // Log start of Pub/Sub
    const toLogPubSub: LoggingObject = {
      session_id: sessionId,
      event_type: LoggingEventType.PUBLICATION,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.REQUESTED,
      http_type: 200,
    };
    console.log(JSON.stringify(toLogPubSub));

    topic.publishMessage({json})
      .then((messageId) => {
        // Log Pub/Sub finish
        const toLogPubSub: LoggingObject = {
          session_id: sessionId,
          event_type: LoggingEventType.PUBLICATION,
          event_provider: LoggingEventProvider.LOOP_MESSAGE,
          event_status: LoggingEventStatus.COMPLETED,
          http_type: 200,
          http_info: messageId,
        };
        console.log(JSON.stringify(toLogPubSub));
        response.status(statusCode).send(
          {
            message: httpsResponseMessage,
            typing: typing,
            read: true,
          }
        );
      })
      .catch((error: any) => {
        console.log(error);
        // Log Pub/Sub failed (bad gateway)
        const toLogPubSub: LoggingObject = {
          session_id: sessionId,
          event_type: LoggingEventType.PUBLICATION,
          event_provider: LoggingEventProvider.LOOP_MESSAGE,
          event_status: LoggingEventStatus.FAILED,
          http_type: 502,
        };
        console.log(JSON.stringify(toLogPubSub));
        response.status(502).send("Error publishing message.");
      });
  });

exports.loopMessageWebhookHandlerPubSub = functions
  .runWith({
    secrets: [
      "LOOP_AUTH_SECRET_KEY",
      "LOOP_SECRET_API_KEY_FOR_CONVERSATION",
      "OPENAI_API_KEY",
    ],
  })
  .pubsub
  .topic("loop-webhook-process")
  .onPublish(async (message) => {
    // Get secret(s)
    const loopAuthSecretKey = process.env.LOOP_AUTH_SECRET_KEY ?? "";
    const loopAuthSecretKeyConvo =
      process.env.LOOP_SECRET_API_KEY_FOR_CONVERSATION ?? "";
    const openaiApiKey = process.env.OPENAI_API_KEY ?? "";
    // Initalize api managers
    const openaiApiManager = new OpenaiApiManager(openaiApiKey);
    const loopApiManager = new LoopApiManager(
      loopAuthSecretKey,
      loopAuthSecretKeyConvo
    );

    // message is just request.body from Loop webhook, parse accordingly
    const requestBodyData: any = message.json;
    const alertType: AlertType =
      requestBodyData.alert_type ?? AlertType.UNKNOWN;
    const messageRecipient: string = requestBodyData.recipient ?? "";
    const sessionId: string = requestBodyData.session_id ?? "";

    switch (alertType) {
    case AlertType.CONVERSATION_INITED: {
      console.log("Entering case statement for AlertType.CONVERSATION_INITED");
      await privateConversationInitedWebhookHandler(
        sessionId,
        messageRecipient,
        alertType,
        loopApiManager
      );
      break;
    }
    case AlertType.GROUP_CREATED: {
      console.log(
        "Entering case statement for AlertType.GROUP_CREATED"
      );
      const groupID: string = requestBodyData.group.group_id ?? "";
      await groupCreatedWebhookHandler(
        sessionId,
        messageRecipient,
        groupID,
        alertType,
        loopApiManager
      );
      break;
    }
    case AlertType.MESSAGE_SENT: {
      console.log("Entering case statement for AlertType.MESSAGE_SENT");
      await messageSentWebhookHandler(requestBodyData);
      break;
    }
    case AlertType.MESSAGE_FAILED: {
      console.log("Entering case statement for AlertType.MESSAGE_FAILED");
      await messageFailedOrTimeoutWebhookHandler(requestBodyData);
      break;
    }
    case AlertType.MESSAGE_TIMEOUT: {
      console.log("Entering case statement for AlertType.MESSAGE_TIMEOUT");
      await messageFailedOrTimeoutWebhookHandler(requestBodyData);
      break;
    }
    case AlertType.MESSAGE_INBOUND: {
      console.log("Entering case statement for AlertType.MESSAGE_INBOUND");
      const uid: string = await getUIDGivenIMessageAccount(
        messageRecipient,
        sessionId
      );
      if (!uid) {
        // If uid is null / empty at this point, incoming messageRecipient
        // is not a valid customer, exit control flow, do not send a response
        console.log("Exiting auth flow (no uid), no message response sent.");
        break;
      }
      const {
        isValidSubscription,
        hasValidMessagesRemaining,
        wasUserWarnedNoCreditsRemaining,
      } = await checkValidSubscriptionOrMessagesRemaining(dataManager, uid);

      if (
        !isValidSubscription &&
        !hasValidMessagesRemaining &&
        !wasUserWarnedNoCreditsRemaining
      ) {
        // If the customer does not have a valid description, and
        // if the customer does not have valid message tokens remaining,
        // exit control flow, do not send a response
        await loopApiManager.sendNotificationMessageToUserOutOfMessageCredits(
          dataManager,
          uid,
          sessionId
        );
        break;
      } else if (!isValidSubscription && !hasValidMessagesRemaining) {
        console.log("Exiting auth flow, no message response sent.");
        break;
      }

      if ("group" in requestBodyData) {
        // If valid account with active messages or subscription, proceed
        // Check if this is a group chat with incoming message
        // TODO - currently no response will be generated for
        // a message_reaction within a group. In the future,
        // Loop plans to include the message_id
        // of the message the user is "reacting" to. When this happens, we
        // will handle group message_reaction alerts.
        console.log("Entering groupMessageHandler code block");
        await groupMessageHandler(
          requestBodyData,
          sessionId,
          uid,
          isValidSubscription,
          hasValidMessagesRemaining,
          loopApiManager,
          openaiApiManager
        );
      } else {
        // This is a private chat with incoming message
        // TODO - currently no response will be generated for
        // a message_reaction within private chat.
        // In the future, Loop plans to include the message_id
        // of the message the user is "reacting" to. When this happens, we
        // will handle group message_reaction alerts.
        console.log("Entering privateMessageHandler code block");
        await privateMessageHandler(
          requestBodyData,
          sessionId,
          uid,
          isValidSubscription,
          hasValidMessagesRemaining,
          loopApiManager,
          openaiApiManager
        );
      }
      break;
    }
    default: {
      console.log(
        "Entering default case statement for Loop Webhook Handler AlertType"
      );
      console.log(`Incoming alert didn't trigger a response: ${alertType}.`);
      console.log("Exiting auth flow, no message response sent.");
    }
    }
    // Log completion of webhook processing
    const toLog: LoggingObject = {
      session_id: sessionId,
      event_type: LoggingEventType.INCOMING_WEBHOOK,
      event_provider: LoggingEventProvider.LOOP_MESSAGE,
      event_status: LoggingEventStatus.COMPLETED,
      http_info: alertType,
      http_type: 200,
    };
    console.log(JSON.stringify(toLog));
    return null;
  });
