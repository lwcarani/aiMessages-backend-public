import {
  LoopApiManager,
} from "../../src/apis/loopApiManager";
import {
  MAX_RETRIES,
} from "../../src/globals";
import {expect} from "chai";
import {describe} from "mocha";
import * as sinon from "sinon";
import axios from "axios";
import {
  SinonSandbox,
  SinonStub,
} from "sinon";
import {v4 as uuidv4} from "uuid";
import {LoopMessageError} from "../../src/errors/loopMessageErrors";

// sendLoopAuthRequest
describe("sendLoopAuthRequest", () => {
  let sandbox: SinonSandbox;
  let loopStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "456";
  // Initalize the api managers
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo,
    undefined
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loopStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return success equals true", async () => {
    const uid = "12345";

    const completionResponse = {
      data: {
        imessage_link: "imessage//",
        request_id: "ABCD-EFCG-HIJK-LMNO",
        success: true,
      },
    };

    loopStub.resolves(completionResponse);

    let iMessageLink = "";
    let loopRequestID = "";
    let success = false;
    try {
      ({iMessageLink,
        loopRequestID,
        success} = await loopApiManager.sendLoopAuthRequest(uid, 0));
    } catch (error: any) {
      console.log(
        "Error with generating iMessage Auth Request via loop.\n",
        error.message + "\n",
        error.cause
      );
    }

    expect(iMessageLink).to.equal("imessage//");
    expect(loopRequestID).to.equal("ABCD-EFCG-HIJK-LMNO");
    expect(loopStub.callCount).to.equal(1);
    expect(success).to.equal(true);
  });

  it("should retry on error", async () => {
    const uid = "12345";

    loopStub.rejects(new Error("Something went wrong"));

    let iMessageLink = "";
    let loopRequestID = "";
    let success = false;
    try {
      ({iMessageLink,
        loopRequestID,
        success} = await loopApiManager.sendLoopAuthRequest(uid, 0));
    } catch (error: any) {
      expect(error).to.be.an.instanceOf(LoopMessageError);
      console.log(
        "Error with generating iMessage Auth Request via loop.\n",
        error.message + "\n",
        error.cause
      );
    }

    expect(iMessageLink).to.equal("");
    expect(loopRequestID).to.equal("");
    expect(success).to.equal(false);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);

    // if requestID comes back as "" | null | undefined, assign a UUID
    if (!loopRequestID) {
      loopRequestID = uuidv4();
    }
    expect(loopRequestID).to.not.equal("");
    expect(loopRequestID.length).to.equal(36);
  });
});

// sendLoopMessage
describe("sendLoopMessage", () => {
  let sandbox: SinonSandbox;
  let loopStub: SinonStub;
  // Get secret(s)
  // doesn't matter what key is...
  const loopAuthSecretKey = "123";
  const loopAuthSecretKeyConvo = "456";
  // Initalize the api managers
  const loopApiManager = new LoopApiManager(
    loopAuthSecretKey,
    loopAuthSecretKeyConvo,
    undefined
  );

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loopStub = sandbox.stub(axios, "post");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should return success equals true", async () => {
    const messageRecipient = "+15555555555";
    const groupID = "";
    const uid = "122345";
    const sessionId = "1234-5678-abcd";
    const messageResponse = "Hellooooo!";

    const completionResponse = {
      data: {
        success: true,
      },
    };

    loopStub.resolves(completionResponse);
    let success: boolean;
    let loopApiError = "";
    try {
      success = await loopApiManager.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        groupID,
        messageResponse
      );
    } catch (error: any) {
      loopApiError = error.cause;
      success = false;
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
    }

    console.log(loopApiError);
    expect(loopStub.callCount).to.equal(1);
    expect(success).to.deep.equal(true);
  });

  it("should retry on error", async () => {
    const messageRecipient = "+15555555555";
    const groupID = "";
    const uid = "122345";
    const sessionId = "1234-5678-abcd";
    const messageResponse = "Hi there!";

    loopStub.rejects(new Error("Something went wrong"));

    let success: boolean;
    let loopApiError = "";
    try {
      success = await loopApiManager.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        groupID,
        messageResponse
      );
    } catch (error: any) {
      loopApiError = error.cause;
      success = false;
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
      expect(error).to.be.an.instanceOf(LoopMessageError);
    }
    console.log(loopApiError);
    expect(success).to.equal(false);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
  });

  it("should retry on success === false", async () => {
    const messageRecipient = "+15555555555";
    const groupID = "";
    const uid = "122345";
    const sessionId = "1234-5678-abcd";
    const messageResponse = "Hellooooo!".repeat(3);

    const completionResponse = {
      data: {
        success: false,
      },
    };

    loopStub.resolves(completionResponse);

    let success: boolean;
    let loopApiError = "";
    try {
      success = await loopApiManager.sendLoopMessage(
        uid,
        sessionId,
        messageRecipient,
        groupID,
        messageResponse
      );
    } catch (error: any) {
      loopApiError = error.cause;
      success = false;
      console.log(
        "Error with sending message via loop.\n",
        error.message + "\n",
        error.cause
      );
      expect(error).to.be.an.instanceOf(LoopMessageError);
    }
    console.log(loopApiError);
    expect(success).to.equal(false);
    expect(loopStub.callCount).to.equal(MAX_RETRIES + 1);
  });
});
