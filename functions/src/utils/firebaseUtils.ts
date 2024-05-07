// // standard imports
// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";

// // custom imports
// constants.ts
import {
  ChargeType,
  Collection,
  SubCollection,
  LoggingEventProvider,
  LoggingEventStatus,
  LoggingEventType,
  LoggingObject,
} from "../globals";

// dataManager.ts
import {
  DataManager,
  DocumentData,
} from "./dataManager";

/**
 * NOTE that Firestore does not have decrement function, so use increment(-1)
 * @param {string} uid - the unique identifier for the user
 */
export async function toggleUserWarningOutOfMessageCredits(
  uid: string
): Promise<void> {
  await admin.firestore()
    .collection("consumableBalance")
    .doc(`${uid}`)
    .update({
      wasUserWarnedNoCreditsRemaining: true,
    });
}

/**
 * @param {DataManager} dataManager
 * @param {any} requestBodyData
 * @param {boolean} isValidSubscription
 * @param {boolean} hasValidMessagesRemaining
 * @param {string} uid
 * @return {Promise<void>}
 */
export async function createReceiptForSuccessfulPrivateMessageDelivery(
  dataManager: DataManager,
  requestBodyData: any,
  isValidSubscription: boolean,
  hasValidMessagesRemaining: boolean,
  uid: string
): Promise<void> {
  // NOTE: Must do Timestamp this way (known issue on GitHub)
  // as opposed to admin.firestore().Timestamp...
  // lazy load Timestamp
  const {Timestamp} = await import("firebase-admin/firestore");
  const messageTimestamp = Timestamp.now().toDate();
  const messageID: string = requestBodyData.message_id ?? "";
  const messageRecipient: string = requestBodyData.recipient ?? "";
  const chargeType = isValidSubscription ?
    ChargeType.SUBSCRIPTION : hasValidMessagesRemaining ?
      ChargeType.TOKEN : "";

  const responseType = "private iMessage chat";
  const expenseDataToUpload: DocumentData = {
    messageTimestamp: messageTimestamp,
    messageID: messageID,
    account: messageRecipient,
    paidWithSubscriptionOrToken: chargeType,
    responseType: responseType,
  };

  try {
    await dataManager.addDocument(
      expenseDataToUpload,
      Collection.CUSTOMER_EXPENSES,
      uid,
      SubCollection.PRIVATE
    );
    console.log("customerExpense successfully " +
      "uploaded to Firestore.");
  } catch (error: any) {
    console.log(
      "Error during customerExpense data upload:",
      error.message
    );
  }
}

/**
 * @param {DataManager} dataManager
 * @param {any} requestBodyData
 * @param {boolean} isValidSubscription
 * @param {boolean} hasValidMessagesRemaining
 * @param {string} uid
 * @return {Promise<void>}
 */
export async function createReceiptForSuccessfulGroupMessageDelivery(
  dataManager: DataManager,
  requestBodyData: any,
  isValidSubscription: boolean,
  hasValidMessagesRemaining: boolean,
  uid: string
): Promise<void> {
  // NOTE: Must do Timestamp this way (known issue on GitHub)
  // as opposed to admin.firestore().Timestamp...
  // lazy load Timestamp
  const {Timestamp} = await import("firebase-admin/firestore");
  const messageTimestamp = Timestamp.now().toDate();
  const messageID: string = requestBodyData.message_id ?? "";
  const messageRecipient: string = requestBodyData.recipient ?? "";
  const chargeType = isValidSubscription ?
    ChargeType.SUBSCRIPTION : hasValidMessagesRemaining ?
      ChargeType.TOKEN : "";

  const responseType = "group iMessage chat";
  const groupID = requestBodyData.group.group_id ?? "";
  const expenseDataToUpload: DocumentData = {
    messageTimestamp: messageTimestamp,
    messageID: messageID,
    account: messageRecipient,
    groupID: groupID,
    paidWithSubscriptionOrToken: chargeType,
    responseType: responseType,
  };

  try {
    await dataManager.addDocument(
      expenseDataToUpload,
      Collection.CUSTOMER_EXPENSES,
      uid,
      SubCollection.GROUP
    );
    console.log("customerExpense successfully " +
      "uploaded to Firestore.");
  } catch (error: any) {
    console.log(
      "Error during customerExpense data upload:",
      error.message
    );
  }
}

/**
 * Returns uid of user given an iMessageAccount (phone/email)
 * @param {string} messageRecipient
 * @param {string} sessionId
 * @return {string}
 */
export async function getUIDGivenIMessageAccount(
  messageRecipient: string,
  sessionId: string
): Promise<string> {
  let uid = "";
  const toLogInit: LoggingObject = {
    session_id: sessionId,
    event_type: LoggingEventType.FIREBASE_QUERY,
    event_provider: LoggingEventProvider.FIREBASE,
    event_status: LoggingEventStatus.REQUESTED,
  };
  console.log(JSON.stringify(toLogInit));
  // Grab the iMessageAccount document with this user"s info
  const accountDoc = await admin
    .firestore()
    .collection("iMessageAccounts")
    .where("contact", "==", messageRecipient)
    .get();

  if (accountDoc.empty) {
    // If this doc does not exist, they are not a valid customer
    // Exit control flow
    console.log("No docs in iMessageAccounts collection; not valid customer.");
    console.log("Exiting control flow");
    return "";
  }
  accountDoc.forEach((currentDoc: any) => {
    const currentAccount = currentDoc.data()?.contact ?? "";
    if (currentAccount === messageRecipient) {
      // if this contact number / email matches the one that sent the Loop
      // message, then grab this uid
      uid = currentDoc.id;
      console.log("Found target uid!", uid);
    }
  });
  const toLogFin: LoggingObject = {
    uid: uid,
    session_id: sessionId,
    event_type: LoggingEventType.FIREBASE_QUERY,
    event_provider: LoggingEventProvider.FIREBASE,
    event_status: LoggingEventStatus.COMPLETED,
  };
  console.log(JSON.stringify(toLogFin));
  return uid;
}

/**
 * Returns the number of message credits remaining for a given user
 * @param {DataManager} dataManager
 * @param {string} uid
 * @return {{number, string}}
 */
export async function getNumMessagesRemainingAndLatestReceipt(
  dataManager: DataManager,
  uid: string
): Promise<{
  numberOfMessagesRemaining: number,
  latestReceipt: string
}> {
  let numberOfMessagesRemaining: number;
  let latestReceipt: string;
  try {
    const result = await dataManager.getDocument(
      Collection.CONSUMABLE_BALANCE,
      uid
    );
    numberOfMessagesRemaining = Number(result?.numberOfMessagesRemaining ?? 0);
    latestReceipt = result?.latestReceipt ?? "";
  } catch (error: any) {
    console.log("Error:", error.message);
    console.log("No consumableBalance data found, setting to 0.");
    numberOfMessagesRemaining = 0;
    latestReceipt = "";
  }
  return {
    numberOfMessagesRemaining: numberOfMessagesRemaining,
    latestReceipt: latestReceipt,
  };
}

/**
 * @param {DataManager} dataManager
 * @param {string} uid - the unique identifier for the user
 * @return {{boolean, boolean, boolean}}
 */
export async function checkValidSubscriptionOrMessagesRemaining(
  dataManager: DataManager,
  uid: string
): Promise<{
  isValidSubscription: boolean,
  hasValidMessagesRemaining: boolean,
  wasUserWarnedNoCreditsRemaining: boolean,
  }> {
  const isValidSubscription = false; // assume invalid subscription to start
  let numberOfMessagesRemaining = 0; // assume 0 messages remaining to start
  let hasValidMessagesRemaining = false; // assume no messages credits to start
  let wasUserWarnedNoCreditsRemaining = false;

  // if no valid subscription, check if message credits remaining,
  // otherwise, just return the object now, and skip this block
  if (!isValidSubscription) {
    try {
      const result = await dataManager.getDocument(
        Collection.CONSUMABLE_BALANCE,
        uid
      );
      numberOfMessagesRemaining = result?.numberOfMessagesRemaining ?? 0;
      wasUserWarnedNoCreditsRemaining =
        result?.wasUserWarnedNoCreditsRemaining ?? false;
    } catch (error: any) {
      console.log("Error:", error.message);
      console.log("No consumableBalance info found.");
    }

    if (numberOfMessagesRemaining <= 0) {
      // If no message tokens remaining, return false
      console.log("No message tokens remaining! User must purchse more.");
    } else {
      hasValidMessagesRemaining = true;
    }
  }

  // finally, return object
  return {
    isValidSubscription,
    hasValidMessagesRemaining,
    wasUserWarnedNoCreditsRemaining,
  };
}
