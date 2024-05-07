// global constants
export const LOOP_CHARACTER_LIMIT: number =
  process.env.NODE_ENV === "test" ? 10.0 : 9999.0;
export const MAX_MESSAGE_HISTORY: number =
  process.env.NODE_ENV === "test" ? 5 : 10;
export const MAX_RETRIES: number =
  process.env.NODE_ENV === "test" ? 2 : 5;
// 1000 === 1 second
export const BASE_DELAY: number =
  process.env.NODE_ENV === "test" ? 100 : 500;
export const TOKEN_BUFFER: number =
  process.env.NODE_ENV === "test" ? 1500 : 50;
export const PROMOTIONAL_MESSAGE_CREDIT_ISSUE = 10;
export const GPT35_TURBO_MAX_TOKENS = 4096;
export const DAVINCI3_MAX_TOKENS = 4097;
export const NUM_TRAINING_STEPS = 30;
const WELCOME_VIDEO_URL = "https://www.youtube.com/shorts/-SgvJ0D5wGI";
export const WELCOME_MESSAGE_NEW_GROUP: string =
  "Hello!!! I see a new group was created 😏\n\n" +
  "I will only respond if mentioned by name " +
  "(that's aiMessages if you haven't given me one yet), " +
  "to anyone with an aiMessages account.\n\n" +
  "Oh! And if you don't have the app yet, follow the link 👇 to get started! " +
  "https://apps.apple.com/us/app/aimessages/id6446336518";
export const WELCOME_NEW_PRIVATE_USER: string =
  "Hello!!! 🥳🥳🥳 \n\n" +
  "I will only respond with text after you message me, and make sure " +
  "you're only charged for the messages I get back to you.\n\n" +
  "To generate images, launch the iMessage extension app below " +
  "👇 (I also sent a video to help you find it).\n\n" +
  "⚠️ Prepare to have fun!\n\n" +
  "Try asking me to write you a song, or recommend places to travel " +
  "based on your interests. I can also help with " +
  "professional or educational topics! " + WELCOME_VIDEO_URL;
export const NO_CREDITS_REMAINING_MESSAGE: string =
  "Uh oh! It looks like you are out of message credits.\n\n" +
  "To purchase more message credits please follow this 👇 link! " +
  "https://chadbot-c97e6.web.app/redirects?path=credits";

export interface LoggingObject {
  session_id: string;
  uid?: string | undefined;
  event_type?: LoggingEventType | undefined;
  event_provider?: LoggingEventProvider | undefined;
  event_status?: LoggingEventStatus | undefined;
  http_type?: number | undefined;
  http_info?: string | undefined;
  num_steps?: number | undefined;
}

export interface GenerationResponse {
  artifacts: Array<{
    base64: string;
    seed: number;
    finishReason: string;
  }>;
}

export enum LoggingEventType {
  IMAGE_CREATE = "image_create",
  IMAGE_EDIT = "image_edit",
  IMAGE_EDIT_WITH_MASK = "image_edit_with_mask",
  DOODLE = "doodle",
  TEXT_EDIT = "text_edit",
  CHAT_COMPLETION = "chat_completion",
  COMPLETION = "completion",
  INCOMING_WEBHOOK = "incoming_webhook",
  MESSAGE_AUTH = "message_auth",
  SEND_MESSAGE = "send_message",
  FIREBASE_QUERY = "firebase_query",
  FIREBASE_STORAGE_UPLOAD = "firebase_storage_upload",
  FIREBASE_CLOUD_URL_RETRIEVAL = "firebase_cloud_url_retrieval",
  PUBLICATION = "publication",
}

export enum LoggingEventProvider {
  LOOP_MESSAGE = "loop_message",
  STABILITY_AI = "stability_ai",
  CLIPDROP = "clipdrop",
  OPEN_AI = "openai",
  FIREBASE = "firebase",
}

export enum LoggingEventStatus {
  REQUESTED = "requested",
  RECEIVED = "received",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum Status {
  PENDING = "pending",
  PROCESSING = "processing",
  TIMEOUT = "timeout",
  COMPLETED = "completed",
}

export enum FinishReason {
  STOP = "stop",
  LENGTH = "length",
  CONTENT_FILTER = "content_filter",
  UNKNOWN = "unknown",
}

export enum ChargeType {
  SUBSCRIPTION = "subscription",
  TOKEN = "token",
}

export enum MessageType {
  GROUP_MESSAGE = "groupMessage",
  PRIVATE_MESSAGE = "privateMessage",
  GROUP_WELCOME_MESSAGE = "groupWelcomeMessage",
  PRIVATE_WELCOME_MESSAGE = "privateWelcomeMessage",
  GROUP_ERROR_MESSAGE = "groupErrorMessage",
  PRIVATE_ERROR_MESSAGE = "privateErrorMessage",
  NO_CREDITS_REMAINING = "noCreditsRemaining",
}

export enum ImageRequestType {
  CREATE = "create",
  EDIT = "edit",
  EDIT_WITH_MASK = "editWithMask",
  DOODLE = "doodle",
}

export enum ConsumableProductID {
  MESSAGES25 = "aiMessages_25_messages",
  MESSAGES50 = "aiMessages_50_messages",
  MESSAGES100 = "aiMessages_100_messages",
  MESSAGES200 = "aiMessages_200_messages",
  MESSAGES250 = "aiMessages_250_messages",
  MESSAGES300 = "aiMessages_300_messages",
  MESSAGES500 = "aiMessages_500_messages",
  MESSAGES1000 = "aiMessages_1000_messages",
}

export enum PurchaseType {
  NON_RENEWING_PURCHASE = "NON_RENEWING_PURCHASE",
  INITIAL_PURCHASE = "INITIAL_PURCHASE",
  PRODUCT_CHANGE = "PRODUCT_CHANGE",
  RENEWAL = "RENEWAL",
}

export enum AlertType {
  MESSAGE_SCHEDULED = "message_schedule",
  MESSAGE_SENT = "message_sent",
  MESSAGE_FAILED = "message_failed",
  MESSAGE_INBOUND = "message_inbound",
  MESSAGE_TIMEOUT = "message_timeout",
  MESSAGE_REACTION = "message_reaction",
  CONVERSATION_INITED = "conversation_inited",
  GROUP_CREATED = "group_created",
  UNKNOWN = "unknown",
}

export enum Collection {
  BOT_NAMES = "botNames",
  PERSONALITY = "personality",
  IMESSAGE_ACCOUNTS = "iMessageAccounts",
  CONSUMABLE_BALANCE = "consumableBalance",
  CUSTOMER_EXPENSES = "customerExpenses",
  CUSTOMERS = "customers",
  EVENTS = "events",
  EXTENSION_MESSAGES = "extensionMessages",
  EXTENSION_IMAGE_HISTORY = "extensionImageHistory",
  CACHED_PRIVATE_MESSAGES = "cachedPrivateMessages",
  CACHED_GROUP_MESSAGES = "cachedGroupMessages",
}

export enum SubCollection {
  PRIVATE = "private",
  GROUP = "group",
  COMPLETIONS = "completions",
  EDITS = "edits",
  IMAGE_RESPONSES = "imageResponses",
  PROMOTIONS = "promotions",
  EXTENSION_MESSAGE_IMAGES = "extensionMessageImages",
  EXTENSION_MESSAGE_COMPLETIONS = "extensionMessageCompletions",
  EXTENSION_MESSAGE_EDITS = "extensionMessageEdits",
}
