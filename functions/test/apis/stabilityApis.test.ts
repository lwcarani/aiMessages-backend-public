import {
  StabilityApiManager,
} from "../../src/apis/stabilityApiManager";
import {
  MAX_RETRIES,
  ImageRequestType,
  GenerationResponse,
} from "../../src/globals";
import {
  StabilityError,
} from "../../src/errors/stabilityErrors";
import {expect} from "chai";
import {describe} from "mocha";
import * as sinon from "sinon";
import axios from "axios";
import {
  SinonSandbox,
  SinonStub,
} from "sinon";

// Stability.ai Image Creation API
describe("generateResponseWithStabilityAITextToImageApi", () => {
  let sandbox: SinonSandbox;
  let stabilityStub: SinonStub;
  // doesn't matter what key is...
  const stabilityApiManager = new StabilityApiManager("stabilityApiKey");

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stabilityStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return TWO message responses", async () => {
    const requestType: ImageRequestType = ImageRequestType.CREATE;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const numSamples = 2;
    const sessionId = "1234-abcd-efgh-5678";
    const mockResponse: GenerationResponse = {
      artifacts: [
        {
          base64: "mockBase64String0",
          seed: 123,
          finishReason: "mockFinishReason0",
        },
        {
          base64: "mockBase64String1",
          seed: 123,
          finishReason: "mockFinishReason1",
        },
      ],
    };

    const completionResponse = {
      data: mockResponse,
    };

    stabilityStub.resolves(completionResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples
      );
    } catch (error: any) {
      console.log(error);
    }
    expect(imageResponseArray.length).to.equal(2);
    expect(imageResponseArray).to.be.an("array");
    expect(stabilityStub.callCount).to.equal(1);

    for (let index = 0; index < imageResponseArray.length; index++) {
      const imageResponse = imageResponseArray[index];
      expect(imageResponse).to.equal(`mockBase64String${index}`);
      expect(imageResponse).to.be.a.string;
    }
  });

  it("should return FIVE message responses", async () => {
    const requestType: ImageRequestType = ImageRequestType.CREATE;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const numSamples = 5;
    const sessionId = "1234-abcd-efgh-5678";
    const mockResponse: GenerationResponse = {
      artifacts: [
        {
          base64: "mockBase64String0",
          seed: 123,
          finishReason: "mockFinishReason0",
        },
        {
          base64: "mockBase64String1",
          seed: 123,
          finishReason: "mockFinishReason1",
        },
        {
          base64: "mockBase64String2",
          seed: 123,
          finishReason: "mockFinishReason2",
        },
        {
          base64: "mockBase64String3",
          seed: 123,
          finishReason: "mockFinishReason3",
        },
        {
          base64: "mockBase64String4",
          seed: 123,
          finishReason: "mockFinishReason4",
        },
      ],
    };

    const completionResponse = {
      data: mockResponse,
    };

    stabilityStub.resolves(completionResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples
      );
    } catch (error: any) {
      console.log(error);
    }
    expect(imageResponseArray.length).to.equal(5);
    expect(imageResponseArray).to.be.an("array");
    expect(stabilityStub.callCount).to.equal(1);

    for (let index = 0; index < imageResponseArray.length; index++) {
      const imageResponse = imageResponseArray[index];
      expect(imageResponse).to.equal(`mockBase64String${index}`);
      expect(imageResponse).to.be.a.string;
    }
  });

  it("should return TEN message responses", async () => {
    const requestType: ImageRequestType = ImageRequestType.CREATE;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const numSamples = 10;
    const sessionId = "1234-abcd-efgh-5678";
    const mockResponse: GenerationResponse = {
      artifacts: [
        {
          base64: "mockBase64String0",
          seed: 123,
          finishReason: "mockFinishReason0",
        },
        {
          base64: "mockBase64String1",
          seed: 123,
          finishReason: "mockFinishReason1",
        },
        {
          base64: "mockBase64String2",
          seed: 123,
          finishReason: "mockFinishReason2",
        },
        {
          base64: "mockBase64String3",
          seed: 123,
          finishReason: "mockFinishReason3",
        },
        {
          base64: "mockBase64String4",
          seed: 123,
          finishReason: "mockFinishReason4",
        },
        {
          base64: "mockBase64String5",
          seed: 123,
          finishReason: "mockFinishReason5",
        },
        {
          base64: "mockBase64String6",
          seed: 123,
          finishReason: "mockFinishReason6",
        },
        {
          base64: "mockBase64String7",
          seed: 123,
          finishReason: "mockFinishReason7",
        },
        {
          base64: "mockBase64String8",
          seed: 123,
          finishReason: "mockFinishReason8",
        },
        {
          base64: "mockBase64String9",
          seed: 123,
          finishReason: "mockFinishReason9",
        },
      ],
    };

    const completionResponse = {
      data: mockResponse,
    };

    stabilityStub.resolves(completionResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples
      );
    } catch (error: any) {
      console.log(error);
    }
    expect(imageResponseArray.length).to.equal(10);
    expect(imageResponseArray).to.be.an("array");
    expect(stabilityStub.callCount).to.equal(1);

    for (let index = 0; index < imageResponseArray.length; index++) {
      const imageResponse = imageResponseArray[index];
      expect(imageResponse).to.equal(`mockBase64String${index}`);
      expect(imageResponse).to.be.a.string;
    }
  });

  it("should retry on error", async () => {
    const requestType: ImageRequestType = ImageRequestType.CREATE;
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const numSamples = 1;
    const prompt = "A cute baby walrus eating seaweed";
    const errorResponse = {
      response: {status: 401},
      data: {
        message: "There was an error with your request",
      },
    };
    stabilityStub.rejects(errorResponse);

    let imageResponseArray: string[] = [];
    let errorMessage = "";
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples
      );
    } catch (error: any) {
      errorMessage = error.message;
      console.log(error);
      expect(error).to.be.an.instanceOf(StabilityError);
    }
    expect(imageResponseArray).to.be.an("array");
    expect(errorMessage).to.equal(
      "Non-200 response: maximum retries exceeded."
    );
    expect(stabilityStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// Stability.ai Image edit API
describe("generateResponseWithStabilityAiImageToImageApi", () => {
  let sandbox: SinonSandbox;
  let stabilityStub: SinonStub;
  // doesn't matter what key is...
  const stabilityApiManager = new StabilityApiManager("stabilityApiKey");

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stabilityStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const requestType: ImageRequestType = ImageRequestType.EDIT;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const numSamples = 1;
    const image = "base64encodedimage";
    const mockResponse: GenerationResponse = {
      artifacts: [
        {
          base64: "mockBase64String",
          seed: 123,
          finishReason: "mockFinishReason",
        },
      ],
    };

    const completionResponse = {
      data: mockResponse,
    };

    stabilityStub.resolves(completionResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples,
        image
      );
    } catch (error: any) {
      console.log(error);
    }
    const imageResponse = imageResponseArray[0];
    expect(imageResponseArray).to.be.an("array");
    expect(imageResponse).to.equal("mockBase64String");
    expect(stabilityStub.callCount).to.equal(1);
    expect(imageResponse).to.be.a.string;
  });

  it("should retry on error", async () => {
    const requestType: ImageRequestType = ImageRequestType.EDIT;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const numSamples = 1;
    const image = "base64encodedimage";
    const errorResponse = {
      response: {status: 401},
      data: {
        message: "There was an error with your request",
      },
    };
    stabilityStub.rejects(errorResponse);

    let imageResponseArray: string[] = [];
    let errorMessage = "";
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples,
        image
      );
    } catch (error: any) {
      errorMessage = error.message;
      console.log(error);
      expect(error).to.be.an.instanceOf(StabilityError);
    }
    expect(imageResponseArray).to.be.an("array");
    expect(errorMessage).to.equal(
      "Non-200 response: maximum retries exceeded."
    );
    expect(stabilityStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});

// Stability.ai Image edit with mask API
describe("generateResponseWithStabilityAiImageToImageWithMaskApi", () => {
  let sandbox: SinonSandbox;
  let stabilityStub: SinonStub;
  // doesn't matter what key is...
  const stabilityApiManager = new StabilityApiManager("stabilityApiKey");

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    stabilityStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return a message response", async () => {
    const requestType: ImageRequestType = ImageRequestType.EDIT_WITH_MASK;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const image = "base64encodedimage";
    const numSamples = 1;
    const mockResponse: GenerationResponse = {
      artifacts: [
        {
          base64: "mockBase64String",
          seed: 123,
          finishReason: "mockFinishReason",
        },
      ],
    };

    const completionResponse = {
      data: mockResponse,
    };

    stabilityStub.resolves(completionResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples,
        image
      );
    } catch (error: any) {
      console.log(error);
    }
    const imageResponse = imageResponseArray[0];
    expect(imageResponseArray).to.be.an("array");
    expect(imageResponse).to.equal("mockBase64String");
    expect(stabilityStub.callCount).to.equal(1);
    expect(imageResponse).to.be.a.string;
  });

  it("should retry on error", async () => {
    const requestType: ImageRequestType = ImageRequestType.EDIT_WITH_MASK;
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const prompt = "A cute baby walrus eating seaweed";
    const image = "base64encodedimage";
    const numSamples = 1;
    const errorResponse = {
      response: {status: 401},
      data: {
        message: "There was an error with your request",
      },
    };
    stabilityStub.rejects(errorResponse);

    let imageResponseArray: string[] = [];
    let errorMessage = "";
    try {
      imageResponseArray = await stabilityApiManager.callStabilityAiApi(
        uid,
        sessionId,
        requestType,
        prompt,
        numSamples,
        image
      );
    } catch (error: any) {
      errorMessage = error.message;
      console.log(error);
      expect(error).to.be.an.instanceOf(StabilityError);
    }
    expect(imageResponseArray).to.be.an("array");
    expect(errorMessage).to.equal(
      "Non-200 response: maximum retries exceeded."
    );
    expect(stabilityStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});
