import {
  OpenaiApiManager,
} from "../../src/apis/openaiApiManager";
import {
  MAX_RETRIES,
} from "../../src/globals";
// errors.ts
import {
  OpenAIApiError,
  OPENAI_ERROR_MESSAGES,
} from "../../src/errors/openaiErrors";
import {
  ChatCompletionRequestMessage,
  OpenAIApi,
} from "openai";
import {expect} from "chai";
import {describe} from "mocha";
import * as sinon from "sinon";
import {
  SinonSandbox,
  SinonStub,
} from "sinon";
import {encodeAndCountTokens} from "../../src/utils/utils";

// OpenAI Image Creation API
describe("generateImageWithOpenAICreateImageApi", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createImage");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";

    const completionResponse = {
      data: {
        data: [
          {
            b64_json: "SGkgdGhlcmUh",
          },
        ],
      },
    };

    openaiStub.resolves(completionResponse);

    const imageResponse =
      await openaiApiManager.generateImageWithOpenAiCreateImageApi(
        prompt,
        uid,
        0
      );

    expect(imageResponse).to.equal("SGkgdGhlcmUh");
    expect(openaiStub.callCount).to.equal(1);
    expect(imageResponse).to.be.a.string;
  });

  it("should retry on error", async () => {
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";

    const errorResponse = {response: {status: 429},
      message: "There was an error with your request"};
    openaiStub.rejects(errorResponse);

    let assistantMessageResponse = "";
    let errorMessage = "";
    try {
      assistantMessageResponse =
        await openaiApiManager.generateImageWithOpenAiCreateImageApi(
          prompt,
          uid,
          0
        );
    } catch (error: any) {
      errorMessage = error.message;
      expect(error).to.be.an.instanceOf(OpenAIApiError);
    }
    expect(assistantMessageResponse).to.equal("");
    expect(errorMessage).to.equal(
      OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_429
    );
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// OpenAI Image Edit API
describe("generateImageWithOpenAIEditImageApi", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createImageEdit");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const prompt = "A cute baby walrus eating seaweed";
    const image = "SGkgdGhlcmUh";
    const uid = "12345";

    const completionResponse = {
      data: {
        data: [
          {
            b64_json: "SGkgdGhlcmUh",
          },
        ],
      },
    };

    openaiStub.resolves(completionResponse);

    const imageResponse =
      await openaiApiManager.generateImageWithOpenAiEditImageApi(
        prompt,
        image,
        uid,
        0
      );

    expect(imageResponse).to.equal("SGkgdGhlcmUh");
    expect(imageResponse).to.be.a.string;
  });

  it("should retry on error", async () => {
    const prompt = "A cute baby walrus eating seaweed";
    const image = "SGkgdGhlcmUh";
    const uid = "12345";

    const errorResponse = {response: {status: 500},
      message: "There was an error with your request"};
    openaiStub.rejects(errorResponse);

    let assistantMessageResponse = "";
    let errorMessage = "";
    try {
      assistantMessageResponse =
        await openaiApiManager.generateImageWithOpenAiEditImageApi(
          prompt,
          image,
          uid,
          0
        );
    } catch (error: any) {
      errorMessage = error.message;
      expect(error).to.be.an.instanceOf(OpenAIApiError);
    }
    expect(assistantMessageResponse).to.equal("");
    expect(errorMessage).to.equal(
      OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_500
    );
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// OpenAI Chat Completion API
describe("generateResponseWithOpenAIChatCompletionApi", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createChatCompletion");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const uid = "12345";
    const sessionId = "12345";
    const messages: ChatCompletionRequestMessage[] = [];
    messages.push(
      {role: "system", content: "a helpful assistant"},
      {role: "user", content: "Hello there!"}
    );
    const numTokensRequired: number = encodeAndCountTokens(messages);

    const completionResponse = {
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
          prompt_tokens: numTokensRequired,
          completion_tokens: 12,
          total_tokens: numTokensRequired + 12,
        },
      },
    };

    openaiStub.resolves(completionResponse);

    const response =
      await openaiApiManager.generateResponseWithOpenAiChatCompletionApi(
        uid,
        sessionId,
        messages,
        numTokensRequired,
        uid,
        0
      );

    expect(numTokensRequired).to.equal(16);
    expect(response).to.equal("\n\nHello there, how may I assist you today?");
    expect(openaiStub.callCount).to.equal(1);
    expect(response).to.be.a.string;
  });

  it("should keep retrying because 'finish_reason: length'", async () => {
    const uid = "12345";
    const sessionId = "12345";
    const messages: ChatCompletionRequestMessage[] = [];
    messages.push(
      {role: "system", content: "a helpful assistant"},
      {role: "user", content: "Hello there!"},
      {role: "assistant", content: "Hi, nice to meet you!"},
      {role: "user", content: "What do walruses eat?"},
      {role: "assistant", content: "Fish, seaweed, and other marine things"},
      {role: "user", content: "What do rhinos eat?"},
      {role: "assistant", content: "Plants, grass, and other land things"},
      {role: "user", content: "What do elephants eat?"},
      {role: "assistant", content: "Elephant food"},
      {role: "user", content: "What color are llamas?"},
      {role: "assistant", content: "Llamas are gray"},
      {role: "user", content: "How many tentacles does a squid have?"}
    );
    const initNumTokensRequired: number = encodeAndCountTokens(messages);

    const completionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today " +
                "[...message is too long...]?",
            },
            finish_reason: "length",
          },
        ],
        usage: {
          prompt_tokens: initNumTokensRequired,
          completion_tokens: 12,
          total_tokens: initNumTokensRequired + 12,
        },
      },
    };

    openaiStub.resolves(completionResponse);

    const response =
      await openaiApiManager.generateResponseWithOpenAiChatCompletionApi(
        uid,
        sessionId,
        messages,
        initNumTokensRequired,
        uid,
        0
      );

    expect(initNumTokensRequired).to.equal(121);
    expect(response).to.equal("\n\nHello there, how may I assist you today " +
      "[...message is too long...]?");
    expect(response).to.be.a.string;
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });

  it("should immediately return even though 'finish_reason: length' " +
    "because the messages array is only length 2", async () => {
    const uid = "12345";
    const sessionId = "12345";
    const messages: ChatCompletionRequestMessage[] = [];
    messages.push(
      {role: "system", content: "a helpful assistant"},
      {role: "user", content: "How many tentacles does a squid have?"}
    );
    const initNumTokensRequired: number = encodeAndCountTokens(messages);

    const completionResponse = {
      data: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "\n\nHello there, how may I assist you today " +
                "[...message is too long...]?",
            },
            finish_reason: "length",
          },
        ],
        usage: {
          prompt_tokens: initNumTokensRequired,
          completion_tokens: 12,
          total_tokens: initNumTokensRequired + 12,
        },
      },
    };

    openaiStub.resolves(completionResponse);

    const response =
      await openaiApiManager.generateResponseWithOpenAiChatCompletionApi(
        uid,
        sessionId,
        messages,
        initNumTokensRequired,
        uid,
        0
      );

    expect(initNumTokensRequired).to.equal(21);
    expect(response).to.equal("\n\nHello there, how may I assist you today " +
      "[...message is too long...]?");
    expect(response).to.be.a.string;
    expect(openaiStub.callCount).to.equal(1);
  });

  it("should retry on error", async () => {
    const uid = "12345";
    const sessionId = "12345";
    const messages: ChatCompletionRequestMessage[] = [];
    messages.push(
      {role: "system", content: "a helpful assistant"},
      {role: "user", content: "What do walruses eat?"}
    );
    const numTokensRequired: number = encodeAndCountTokens(messages);

    const errorResponse = {response: {status: 401},
      message: "There was an error with your request"};
    openaiStub.rejects(errorResponse);

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
      expect(error).to.be.an.instanceOf(OpenAIApiError);
    }

    expect(assistantMessageResponse).to.equal("");
    expect(errorMessage).to.equal(
      OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_401
    );
    expect(numTokensRequired).to.equal(20);
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// OpenAI Completion API
describe("generateResponseWithOpenAICompletionApi", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createCompletion");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const uid = "12345";
    const prompt = "Say this is a test";
    const numTokensRequired: number = encodeAndCountTokens(prompt);

    const completionResponse = {
      data: {
        choices: [
          {
            text: "This is indeed a test",
          },
        ],
        usage: {
          prompt_tokens: numTokensRequired,
          completion_tokens: 5,
          total_tokens: numTokensRequired + 5,
        },
      },
    };

    openaiStub.resolves(completionResponse);

    const response =
      await openaiApiManager.generateResponseWithOpenAiCompletionApi(
        prompt,
        numTokensRequired,
        uid,
        0
      );

    expect(numTokensRequired).to.equal(5);
    expect(response).to.equal("This is indeed a test");
    expect(openaiStub.callCount).to.equal(1);
    expect(response).to.be.a.string;
  });

  it("should retry on error", async () => {
    const uid = "12345";
    const prompt = "Say this is a test";
    const numTokensRequired: number = encodeAndCountTokens(prompt);

    const errorResponse = {response: {status: 444},
      message: "There was an error with your request"};
    openaiStub.rejects(errorResponse);

    let assistantMessageResponse = "";
    let errorMessage = "";
    try {
      assistantMessageResponse =
        await openaiApiManager.generateResponseWithOpenAiCompletionApi(
          prompt,
          numTokensRequired,
          uid,
          0
        );
    } catch (error: any) {
      errorMessage = error.message;
      expect(error).to.be.an.instanceOf(OpenAIApiError);
    }
    expect(assistantMessageResponse).to.equal("");
    expect(errorMessage).to.equal(
      OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_UNKNOWN
    );
    expect(numTokensRequired).to.equal(5);
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// OpenAI Text Edit API
describe("generateResponseWithOpenAITextEditApi", () => {
  let sandbox: SinonSandbox;
  let openaiStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const openaiApiKey = "123";
  // Initalize the api managers
  const openaiApiManager = new OpenaiApiManager(openaiApiKey);

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openaiStub = sandbox.stub(OpenAIApi.prototype, "createEdit");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const input = "What day of the wek is it?";
    const instruction = "Fix the spelling mistakes.";

    const completionResponse = {
      data: {
        choices: [
          {
            text: "What day of the week is it?",
            index: 0,
          },
        ],
        usage: {
          total_tokens: 50,
        },
      },
    };

    openaiStub.resolves(completionResponse);

    const response =
      await openaiApiManager.generateResponseWithOpenAiTextEditApi(
        input,
        instruction,
        0
      );

    expect(response).to.equal("What day of the week is it?");
    expect(response).to.be.a.string;
  });

  it("should retry on error", async () => {
    const input = "What day of the wek is it?";
    const instruction = "Fix the spelling mistakes.";

    const errorResponse = {response: {status: 401},
      message: "There was an error with your request"};
    openaiStub.rejects(errorResponse);

    let assistantMessageResponse = "";
    let errorMessage = "";
    try {
      assistantMessageResponse =
        await openaiApiManager.generateResponseWithOpenAiTextEditApi(
          input,
          instruction,
          0
        );
    } catch (error: any) {
      errorMessage = error.message;
      expect(error).to.be.an.instanceOf(OpenAIApiError);
    }
    expect(assistantMessageResponse).to.equal("");
    expect(errorMessage).to.equal(
      OPENAI_ERROR_MESSAGES.OPENAI_API_ERROR_CODE_401
    );
    expect(openaiStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});
