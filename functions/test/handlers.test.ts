import {
  MAX_RETRIES,
  AlertType,
  MessageType,
} from "../src/globals";

import * as admin from "firebase-admin";

import {
  OpenAIApi,
} from "openai";

import {
  DataManager,
} from "../src/utils/dataManager";
import {
  LoopApiManager,
} from "../src/apis/loopApiManager";
import {
  OpenaiApiManager,
} from "../src/apis/openaiApiManager";

import {
  privateMessageHandler,
  groupMessageHandler,
  groupCreatedWebhookHandler,
  privateConversationInitedWebhookHandler,
  messageSentWebhookHandler,
} from "../src/handlers";

import {expect} from "chai";
import {describe} from "mocha";
import * as sinon from "sinon";
import axios from "axios";
import {
  SinonSandbox,
  SinonStub,
} from "sinon";

import * as serviceAccount
  from "../chadbot-serviceAccount.json";

admin.initializeApp({
  storageBucket: "chadbot-c97e6.appspot.com",
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

// privateMessageHandler
describe("privateMessageHandler", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  let loopStub: SinonStub;
  let getDocumentStub: SinonStub;
  let setDocumentStub: SinonStub;
  // Get secret(s)
  // doesn't matter what the keys are...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "123";
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createChatCompletion");
    loopStub = sandbox.stub(axios, "post");
    getDocumentStub = sandbox.stub(DataManager.prototype, "getDocument");
    setDocumentStub = sandbox.stub(DataManager.prototype, "setDocument");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should successfully execute privateMessageHandling block", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: [
        "What do walruses eat?".repeat(5000),
        "What color are walrus?".repeat(5000),
      ],
      cachedAssistantMessages: [
        "Seashells".repeat(5000),
        "Walruses are brown.".repeat(5000),
      ],
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await privateMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(loopStub.callCount).to.equal(1);
    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(1);
  });

  it("should retry on loopMessage error", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.rejects(new Error("Something went wrong"));
    openaiStub.resolves(openaiCompletionResponse);

    await privateMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(1);
  });

  it("should retry on openai error", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const uid = "12345";
    const sessionId = "12345";

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    openaiStub.rejects(new Error("Something went wrong"));
    loopStub.resolves(loopCompletionResponse);

    await privateMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(loopStub.callCount).to.equal(1);
  });

  it("should retry on loop and openai errors", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const uid = "12345";
    const sessionId = "12345";

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    openaiStub.rejects(new Error("Something went wrong"));
    loopStub.rejects(new Error("Something went wrong"));

    await privateMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
  });
});

// privateConversationInitedWebhookHandler
describe("privateConversationInitedWebhookHandler", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  let loopStub: SinonStub;
  let getDocumentStub: SinonStub;
  let setDocumentStub: SinonStub;
  // Get secret(s)
  // doesn't matter what the keys are...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "123";
  // Initalize the api managers
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createChatCompletion");
    loopStub = sandbox.stub(axios, "post");
    getDocumentStub = sandbox.stub(DataManager.prototype, "getDocument");
    setDocumentStub = sandbox.stub(DataManager.prototype, "setDocument");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should execute privateConversationInitedWebhookHandler", async () => {
    const messageRecipient = "+15555555555";
    const sessionId = "12345";
    const loopCompletionResponse = {
      data: {
        success: true,
      },
      status: 200,
    };
    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };
    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await privateConversationInitedWebhookHandler(
      sessionId,
      messageRecipient,
      AlertType.CONVERSATION_INITED,
      loopApiManager
    );

    expect(loopStub.callCount).to.equal(1);
    expect(getDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
    expect(openaiStub.callCount).to.equal(0);
  });

  it("should retry on loopMessage error", async () => {
    const messageRecipient = "+15555555555";
    const sessionId = "12345";
    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.rejects(new Error("Something went wrong"));

    await privateConversationInitedWebhookHandler(
      sessionId,
      messageRecipient,
      AlertType.CONVERSATION_INITED,
      loopApiManager
    );

    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(getDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
  });
});

// messageSentWebhookHandler
describe("messageSentWebhookHandler", () => {
  let sandbox: SinonSandbox;
  let getDocumentStub: SinonStub;
  let setDocumentStub: SinonStub;
  let addDocumentStub: SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    getDocumentStub = sandbox.stub(DataManager.prototype, "getDocument");
    setDocumentStub = sandbox.stub(DataManager.prototype, "setDocument");
    addDocumentStub = sandbox.stub(DataManager.prototype, "addDocument");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("messageSentWebhookHandler - privateMessage", async () => {
    const messageRecipient = "+15555555555";
    const uid = "uid12345";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = true;
    const passthrough: string =
      `{"uid": "${uid}", ` +
      `"incomingMessageType": "${MessageType.PRIVATE_MESSAGE}", ` +
      `"isValidSubscription": ${isValidSubscription}, ` +
      `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;

    const request: any = {
      body: {
        recipient: messageRecipient,
        success: true,
        text: "Hello, BAYAZ, how are you?",
        alert_type: AlertType.MESSAGE_SENT,
        passthrough: passthrough,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    setDocumentStub.resolves(true);
    addDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);

    await messageSentWebhookHandler(
      request.body
    );

    expect(addDocumentStub.callCount).to.equal(1);
    expect(getDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
  });

  it("messageSentWebhookHandler - groupMessage", async () => {
    const messageRecipient = "+15555555555";
    const uid = "uid12345";
    const groupID = "group12345";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = true;

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const passthrough: string =
      `{"uid": "${uid}", ` +
      `"group_id": "${groupID}", ` +
      `"incomingMessageType": "${MessageType.GROUP_MESSAGE}", ` +
      `"isValidSubscription": ${isValidSubscription}, ` +
      `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;

    const request: any = {
      body: {
        recipient: messageRecipient,
        success: true,
        text: "Hello, BAYAZ, how are you?",
        alert_type: AlertType.MESSAGE_SENT,
        group: {group_id: "123"},
        passthrough: passthrough,
      },
    };

    setDocumentStub.resolves(true);
    addDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);

    await messageSentWebhookHandler(
      request.body
    );

    expect(getDocumentStub.callCount).to.equal(0);
    expect(addDocumentStub.callCount).to.equal(1);
    expect(setDocumentStub.callCount).to.equal(0);
  });

  it("messageSentWebhookHandler - groupWelcomeMessage", async () => {
    const messageRecipient = "+15555555555";
    const uid = "uid12345";
    const groupID = "group12345";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = true;

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const passthrough: string =
      `{"uid": "${uid}", ` +
      `"group_id": "${groupID}", ` +
      `"incomingMessageType": "${MessageType.GROUP_WELCOME_MESSAGE}", ` +
      `"isValidSubscription": ${isValidSubscription}, ` +
      `"hasValidMessagesRemaining": ${hasValidMessagesRemaining}}`;

    const request: any = {
      body: {
        recipient: messageRecipient,
        success: true,
        text: "Hello, BAYAZ, how are you?",
        alert_type: AlertType.MESSAGE_SENT,
        passthrough: passthrough,
      },
    };

    setDocumentStub.resolves(true);
    addDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);

    await messageSentWebhookHandler(
      request.body
    );

    expect(getDocumentStub.callCount).to.equal(0);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
  });
});

// groupMessageHandler
describe("groupMessageHandler", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  let loopStub: SinonStub;
  let getDocumentStub: SinonStub;
  let setDocumentStub: SinonStub;
  let addDocumentStub: SinonStub;
  // Get secret(s)
  // doesn't matter what the keys are...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "123";
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createChatCompletion");
    loopStub = sandbox.stub(axios, "post");
    getDocumentStub = sandbox.stub(DataManager.prototype, "getDocument");
    setDocumentStub = sandbox.stub(DataManager.prototype, "setDocument");
    addDocumentStub = sandbox.stub(DataManager.prototype, "addDocument");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should successfully execute groupMessageHandling block", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, BAYAZ, how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: [
        "What do walruses eat?",
        "What color are walrus?",
      ],
      cachedAssistantMessages: [
        "Seashells".repeat(5000),
        "Walruses are brown.".repeat(5000),
      ],
      botName: "Bayaz",
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(openaiStub.callCount).to.equal(1);
    expect(loopStub.callCount).to.equal(1);
  });

  it("should successfully execute groupMessageHandling block", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, aimessages, how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(1);
    expect(loopStub.callCount).to.equal(1);
  });

  it("should not execute groupMessageHandling - no botName", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(openaiStub.callCount).to.equal(0);
    expect(loopStub.callCount).to.equal(0);
  });

  it("should not execute groupMessageHandling - no botName", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(0);
    expect(loopStub.callCount).to.equal(0);
  });

  it("should retry on loopMessage error", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, BaYaZ, how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const uid = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.rejects(new Error("Something went wrong"));
    openaiStub.resolves(openaiCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(1);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
  });

  it("should retry on openai error", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, bayaz - how are you?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const uid = "12345";
    const sessionId = "12345";

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    openaiStub.rejects(new Error("Something went wrong"));
    loopStub.resolves(loopCompletionResponse);

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(getDocumentStub.callCount).to.equal(3);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(loopStub.callCount).to.equal(1);
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });

  it("should retry on loop and openai errors", async () => {
    const messageRecipient = "+15555555555";
    const isValidSubscription = true;
    const hasValidMessagesRemaining = false;

    const request: any = {
      body: {
        recipient: messageRecipient,
        text: "Hello, how are you, bayaz?",
        alert_type: AlertType.MESSAGE_INBOUND,
        group: {group_id: "123"},
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const uid = "12345";
    const sessionId = "12345";

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    openaiStub.rejects(new Error("Something went wrong"));
    loopStub.rejects(new Error("Something went wrong"));

    await groupMessageHandler(
      request.body,
      sessionId,
      uid,
      isValidSubscription,
      hasValidMessagesRemaining,
      loopApiManager,
      openaiApiManager
    );

    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
    expect(getDocumentStub.callCount).to.equal(3);
    expect(setDocumentStub.callCount).to.equal(1);
    expect(addDocumentStub.callCount).to.equal(0);
  });
});

// groupCreatedWebhookHandler
describe("groupCreatedWebhookHandler", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  let loopStub: SinonStub;
  let getDocumentStub: SinonStub;
  let setDocumentStub: SinonStub;
  let addDocumentStub: SinonStub;
  // Get secret(s)
  // doesn't matter what the keys are...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "123";
  // Initalize the api managers
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createChatCompletion");
    loopStub = sandbox.stub(axios, "post");
    getDocumentStub = sandbox.stub(DataManager.prototype, "getDocument");
    setDocumentStub = sandbox.stub(DataManager.prototype, "setDocument");
    addDocumentStub = sandbox.stub(DataManager.prototype, "addDocument");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should execute groupMessageHandling (group created)", async () => {
    const messageRecipient = "+15555555555";

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const groupID = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    setDocumentStub.resolves(true);
    addDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupCreatedWebhookHandler(
      sessionId,
      messageRecipient,
      groupID,
      AlertType.GROUP_CREATED,
      loopApiManager
    );

    expect(getDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
    expect(openaiStub.callCount).to.equal(0);
    expect(loopStub.callCount).to.equal(1);
  });

  it("should not execute - no botName (group created)", async () => {
    const messageRecipient = "+15555555555";

    const loopCompletionResponse = {
      data: {
        success: true,
      },
    };

    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };

    const groupID = "12345";
    const sessionId = "12345";

    const openaiCompletionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 90,
          total_tokens: 100,
        },
      },
    };

    addDocumentStub.resolves(true);
    setDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.resolves(loopCompletionResponse);
    openaiStub.resolves(openaiCompletionResponse);

    await groupCreatedWebhookHandler(
      sessionId,
      messageRecipient,
      groupID,
      AlertType.GROUP_CREATED,
      loopApiManager
    );

    expect(getDocumentStub.callCount).to.equal(0);
    expect(setDocumentStub.callCount).to.equal(0);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(openaiStub.callCount).to.equal(0);
    expect(loopStub.callCount).to.equal(1);
  });

  it("should retry on loopMessage error", async () => {
    const messageRecipient = "+15555555555";
    const mockDocument = {
      prompt: "You are a super happy cowboy - yeehaw!",
      cachedUserMessages: ["What do walruses eat?", "What color are walrus?"],
      cachedAssistantMessages: ["Seashells", "Walruses are brown."],
      botName: "Bayaz",
    };
    const groupID = "12345";
    const sessionId = "12345";

    addDocumentStub.resolves(true);
    getDocumentStub.resolves(mockDocument);
    loopStub.rejects(new Error("Something went wrong"));

    await groupCreatedWebhookHandler(
      sessionId,
      messageRecipient,
      groupID,
      AlertType.GROUP_CREATED,
      loopApiManager
    );

    expect(getDocumentStub.callCount).to.equal(0);
    expect(addDocumentStub.callCount).to.equal(0);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});
