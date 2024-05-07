import {
  ClipdropApiManager,
} from "../../src/apis/clipdropApiManager";
import {
  MAX_RETRIES,
  ImageRequestType,
} from "../../src/globals";
import {expect} from "chai";
import {describe} from "mocha";
import * as sinon from "sinon";
import axios from "axios";
import {
  SinonSandbox,
  SinonStub,
} from "sinon";
import {ClipdropError} from "../../src/errors/clipdropErrors";

// Clipdrop Sketch to Image API
describe("generateResponseWithClipdropSketchToImageApi", () => {
  let sandbox: SinonSandbox;
  let clipdropStub: SinonStub;
  // doesn't matter what key is...
  const clipdropApiManager = new ClipdropApiManager("clipdropApiKey");

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clipdropStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return ONE message response", async () => {
    const requestType: ImageRequestType = ImageRequestType.DOODLE;
    const prompt = "A cute baby walrus eating seaweed";
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const image = "thisisabase64imagestring";
    // Assume the server sends a binary image in ArrayBuffer format
    const mockResponse = {
      data: new Uint8Array([0x4A, 0x42, 0x2D, 0x47, 0x50, 0x54]),
    };

    clipdropStub.resolves(mockResponse);
    let imageResponseArray: string[] = [];
    try {
      imageResponseArray = await clipdropApiManager.callClipdropApi(
        uid,
        sessionId,
        requestType,
        prompt,
        image
      );
    } catch (error: any) {
      console.log(error);
    }
    expect(imageResponseArray.length).to.equal(1);
    expect(imageResponseArray).to.be.an("array");
    expect(clipdropStub.callCount).to.equal(1);
    const imageResponse = imageResponseArray[0];
    expect(imageResponse).to.equal("SkItR1BU");
    expect(imageResponse).to.be.a.string;
  });

  it("should retry on error", async () => {
    const requestType: ImageRequestType = ImageRequestType.DOODLE;
    const uid = "12345";
    const sessionId = "1234-abcd-efgh-5678";
    const prompt = "A cute baby walrus eating seaweed";
    const image = "thisisabase64imagestring";
    const errorResponse = {
      response: {status: 401},
      data: {
        error: "There was an error with your request",
      },
    };
    clipdropStub.rejects(errorResponse);

    let imageResponseArray: string[] = [];
    let errorMessage = "";
    try {
      imageResponseArray = await clipdropApiManager.callClipdropApi(
        uid,
        sessionId,
        requestType,
        prompt,
        image
      );
    } catch (error: any) {
      errorMessage = error.message;
      console.log(error);
      expect(error).to.be.an.instanceOf(ClipdropError);
    }
    expect(imageResponseArray).to.be.an("array");
    expect(errorMessage).to.equal(
      "Non-200 response: maximum retries exceeded."
    );
    expect(clipdropStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});
