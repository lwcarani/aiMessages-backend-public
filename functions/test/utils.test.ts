import {expect} from "chai";
import {describe, it} from "mocha";
import {v4 as uuidv4} from "uuid";
import {
  encodeAndCountTokens,
  formatOpenAIApiMessages,
  doesTextContainBotName,
  hashString,
  extractQuotedText,
  isValidConsumableProductID,
  isValidStatus,
  isValidPurchaseType,
  verifyAuthHeader,
  parseNumberOfMessageCredits,
  breakStringIntoChunks,
} from "../src/utils/utils";
import {ChatCompletionRequestMessage} from "openai";
import {
  Status,
  PurchaseType,
  ConsumableProductID,
} from "../src/globals";


describe("breakStringIntoChunks", () => {
  it("should break the string into chunks of 10 characters or less", () => {
    const inputString = "abcdefghijklmnopqrstuvwxyz";
    const expectedChunks = ["abcdefghij", "klmnopqrst", "uvwxyz"];
    const result = breakStringIntoChunks(inputString);
    expect(result).to.deep.equal(expectedChunks);
    expect(result.length).to.equal(3);
  });

  it("should return array with empty string when inputString is empty", () => {
    const result = breakStringIntoChunks("");
    expect(result).to.deep.equal([""]);
    expect(result.length).to.equal(1);
  });

  it("should handle inputString length less than LOOP_CHARACTER_LIMIT", () => {
    const result = breakStringIntoChunks("abc");
    expect(result).to.deep.equal(["abc"]);
    expect(result.length).to.equal(1);
  });

  it("should handle inputString length equal to LOOP_CHARACTER_LIMIT", () => {
    const result = breakStringIntoChunks("abcdefghij");
    expect(result).to.deep.equal(["abcdefghij"]);
    expect(result.length).to.equal(1);
  });

  it("should handle inputString length > than LOOP_CHARACTER_LIMIT", () => {
    const result = breakStringIntoChunks("abcdefghijklmno");
    expect(result).to.deep.equal(["abcdefghij", "klmno"]);
    expect(result.length).to.equal(2);
  });

  it("should handle inputString length that is a > limit", () => {
    const result = breakStringIntoChunks("abcdefghijkl");
    expect(result).to.deep.equal(["abcdefghij", "kl"]);
    expect(result.length).to.equal(2);
  });

  it("should break a long inputString into multiple chunks", () => {
    const longInputString = "1234567890".repeat(10);
    const longExpectedChunks = Array(10).fill("1234567890");
    const result = breakStringIntoChunks(longInputString);
    expect(result).to.deep.equal(longExpectedChunks);
    expect(result.length).to.equal(10);
  });

  it("should break a long inputString into multiple chunks", () => {
    const longInputString = "1234567890".repeat(100);
    const longExpectedChunks = Array(100).fill("1234567890");
    const result = breakStringIntoChunks(longInputString);
    expect(result).to.deep.equal(longExpectedChunks);
    expect(result.length).to.equal(100);
  });

  it("should break a long inputString into multiple chunks", () => {
    const longInputString = "1234567890".repeat(1000);
    const longExpectedChunks = Array(1000).fill("1234567890");
    const result = breakStringIntoChunks(longInputString);
    expect(result).to.deep.equal(longExpectedChunks);
    expect(result.length).to.equal(1000);
  });

  it("should break a long inputString into multiple chunks", () => {
    const longInputString = "1234567890".repeat(10000);
    const longExpectedChunks = Array(10000).fill("1234567890");
    const result = breakStringIntoChunks(longInputString);
    expect(result).to.deep.equal(longExpectedChunks);
    expect(result.length).to.equal(10000);
  });

  it("should break a long inputString into multiple chunks", () => {
    const longInputString = "1234567890".repeat(100000);
    const longExpectedChunks = Array(100000).fill("1234567890");
    const result = breakStringIntoChunks(longInputString);
    expect(result).to.deep.equal(longExpectedChunks);
    expect(result.length).to.equal(100000);
  });

  it("should return a single chunk when limit > inputString length", () => {
    const result = breakStringIntoChunks("hello luke");
    expect(result).to.deep.equal(["hello luke"]);
    expect(result.length).to.equal(1);
  });

  it("should handle inputString with special characters", () => {
    const inputString = "!@#$%^&*()".repeat(5);
    const expectedChunks = Array(5).fill("!@#$%^&*()");
    const result = breakStringIntoChunks(inputString);
    expect(result).to.deep.equal(expectedChunks);
    expect(result.length).to.equal(5);
  });

  it("should handle inputString with whitespace characters", () => {
    const inputString = "hello there  world";
    const expectedChunks = ["hello ther", "e  world"];
    const result = breakStringIntoChunks(inputString);
    expect(result).to.deep.equal(expectedChunks);
    expect(result.length).to.equal(2);
  });
});

describe("verifyAuthHeader", () => {
  it("should return [401, \"Authorization header is missing\"] " +
    "when authHeader is undefined", () => {
    const {statusCode, httpsResponseMessage} = verifyAuthHeader(undefined, "");
    expect(statusCode).to.equal(401);
    expect(httpsResponseMessage).to.equal("Authorization header is missing");
  });

  it("should return [401, \"Invalid authorization header\"] when " +
    "authHeader is \"invalid\"", () => {
    const {statusCode, httpsResponseMessage} = verifyAuthHeader("invalid", "");
    expect(statusCode).to.equal(401);
    expect(httpsResponseMessage).to.equal("Invalid authorization header");
  });

  it("should return [401, \"Invalid authorization token\"] " +
    "when authToken is incorrect", () => {
    const {statusCode, httpsResponseMessage} =
      verifyAuthHeader("Bearer incorrect-token", "");
    expect(statusCode).to.equal(401);
    expect(httpsResponseMessage).to.equal("Invalid authorization token");
  });

  it("should return [401, \"Invalid authorization header\"] " +
    "when authType is not \"Bearer\"", async () => {
    const loopAuthBearerToken = "";
    const {statusCode, httpsResponseMessage} =
      verifyAuthHeader(`Basic ${loopAuthBearerToken}`, "");
    expect(statusCode).to.equal(401);
    expect(httpsResponseMessage).to.equal("Invalid authorization header");
  });
});

describe("doesTextContainBotName", () => {
  it("should return true when botName is present in text", () => {
    const botName = "ChadBot";
    const text = "Hello ChadBot, how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return false when botName is not present in text", () => {
    const botName = "ChadBot";
    const text = "Hello, how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(false);
  });

  it("should return true when botName is at the beginning of text", () => {
    const botName = "ChadBot";
    const text = "chadbot, can you help me?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is at the end of text", () => {
    const botName = "ChadBot";
    const text = "Can you help me, chadBOT?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "ChadBot";
    const text = "Hello   CHADBOT    how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is present in text", () => {
    const botName = "Chad Bot";
    const text = "Hello Chad Bot, how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return false when botName is not present in text", () => {
    const botName = "Chad Bot";
    const text = "Hello, how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(false);
  });

  it("should return true when botName is at the beginning of text", () => {
    const botName = "Chad Bot";
    const text = "Chad Bot, can you help me?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is at the end of text", () => {
    const botName = "Chad Bot";
    const text = "Can you help me, Chad Bot?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "Chad Bot";
    const text = "Hello   Chad Bot    how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is present in text", () => {
    const botName = "Chad Bot";
    const text = "Hello Chad bot, how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return false when botName is not present in text", () => {
    const botName = "Chad Bot";
    const text = "Hello, chad Bot how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is at the beginning of text", () => {
    const botName = "Chad Bot";
    const text = "chad bot, can you help me?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is at the end of text", () => {
    const botName = "Chad Bot Superman";
    const text = "Can you help me, Chad Bot SUPERMAN?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "Chad Bot superman";
    const text = "Hello   Chad Bot SuPerMAN   how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "chad bot superman";
    const text = "Hello   Chad Bot SuPerMAN   how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "Chad bot superman";
    const text = "Hello   Chad Bot SuPerMAN   how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });

  it("should return true when botName is surrounded by whitespace", () => {
    const botName = "chad Bot superman";
    const text = "Hello   CHAd bot superman   how are you?";
    expect(doesTextContainBotName(botName, text)).to.be.equal(true);
  });
});

describe("encodeAndCountTokens", () => {
  it("should return the correct # tokens", () => {
    const inputString = "This is a test string.";
    const expectedTokens = 6;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for an empty string", () => {
    const inputString = "";
    const expectedTokens = 0;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with only spaces", () => {
    const inputString = "   ";
    const expectedTokens = 3;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with punctuation", () => {
    const inputString = "This is a test string, with some punctuation.";
    const expectedTokens = 11;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return correct # tokens for string with special chars", () => {
    const inputString = "This is a test string with #hashtags and @mentions.";
    const expectedTokens = 14;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with emojis", () => {
    const inputString = "This is a test string with 😄😃😊 emojis.";
    const expectedTokens = 16;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return correct # tokens for string with non-ASCII chars", () => {
    const inputString = "This is a test string with áccèntèd characters.";
    const expectedTokens = 15;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with mixed case", () => {
    const inputString = "ThiS iS A TesT StrinG.";
    const expectedTokens = 12;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for a long string", () => {
    const inputString = "Lorem ipsum dolor sit amet, consectetur " +
      "adipiscingelit. Sed ut risus odio. In hac habitasse platea " +
      "dictumst. Sed ut velit vel tellus molestie gravida at et " +
      "quam. Donec eu dui quis enim lacinia hendrerit. Fusce " +
      "malesuada mi et sem bibendum ullamcorper. Integer at " +
      "dolor vel purus posuere pharetra sed id enim. Nullam sagittis " +
      "lobortis velit, vel tempor ex consequat at. Aliquam interdum " +
      "purus ac mauris consequat congue.";
    const expectedTokens = 144;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("return correct # tokens for string with multiple spaces", () => {
    const inputString = "This    is     a    test     string.";
    const expectedTokens = 20;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("return correct # tokens for string with no spaces", () => {
    const inputString = "testing";
    const expectedTokens = 1;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("return correct # tokens for string with no spaces", () => {
    const inputString = "walrus";
    const expectedTokens = 2;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("return correct # tokens for string with leading/trailing spaces", () => {
    const inputString = "  This is a test string.  ";
    const expectedTokens = 9;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with punctuation", () => {
    const inputString = "This is a test string, with some punctuation!";
    const expectedTokens = 11;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with emojis", () => {
    const inputString = "👋 Hello, world! 😊";
    const expectedTokens = 8;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string w/ special chars", () => {
    const inputString = "This is a string with @#$% special characters!";
    const expectedTokens = 11;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });

  it("should return the correct # tokens for string with numbers", () => {
    const inputString = "This is a test string with 123 numbers.";
    const expectedTokens = 9;
    const resultTokens = encodeAndCountTokens(inputString);
    expect(resultTokens).to.be.equal(expectedTokens);
  });
});

describe("formatOpenAIApiMessages and countMessageTokens", () => {
  it("should format the messages correctly: empty strings", () => {
    const assistant: string[] = [];
    const user: string[] = ["What color are walruses?"];
    const system = "Test system message";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "What color are walruses?"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(20);
  });

  it("should format the messages correctly", () => {
    const assistant: string[] = ["Test assistant message answer"];
    const user: string[] = ["Test user message question",
      "Second test user message question"];
    const system = "Test system message";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "Test user message question"},
      {role: "assistant", content: "Test assistant message answer"},
      {role: "user", content: "Second test user message question"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(34);
  });

  it("should trim really long message", () => {
    const assistant: string[] = [
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
    ];
    const user: string[] = [
      "Test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "this is the only one remaining",
    ];
    const system = "A cute dog";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "this is the only one remaining"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(19);
  });

  it("should trim really long message", () => {
    const assistant: string[] = [
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
    ];
    const user: string[] = [
      "Test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "this is the only one remaining",
    ];
    const system = "A cute dog";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "this is the only one remaining"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(19);
  });

  it("should trim really long message", () => {
    const assistant: string[] = [
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
    ];
    const user: string[] = [
      "Test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "this is the only one remaining".repeat(5000),
    ];
    const system = "A cute dog";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(9);
  });

  it("should trim really long message", () => {
    const assistant: string[] = [
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer",
    ];
    const user: string[] = [
      "Test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "this is the only one remaining",
    ];
    const system = "A cute dog";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "this is the only one remaining"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(19);
  });

  it("should trim really long message", () => {
    const assistant: string[] = [
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "Test assistant message answer".repeat(5000),
      "I am short enough to make the cut",
    ];
    const user: string[] = [
      "Test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "Second test user message question".repeat(5000),
      "this one remains",
      "this one too",
    ];
    const system = "A cute dog";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "this one remains"},
      {role: "assistant", content: "I am short enough to make the cut"},
      {role: "user", content: "this one too"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(35);
  });

  it("should format the messages correctly", () => {
    const assistant: string[] = ["Test assistant message 1",
      "Test assistant message 2"];
    const user: string[] = ["Test user message 1",
      "Test user message 2",
      "Test user message 3"];
    const system = "Test system message";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "Test user message 1"},
      {role: "assistant", content: "Test assistant message 1"},
      {role: "user", content: "Test user message 2"},
      {role: "assistant", content: "Test assistant message 2"},
      {role: "user", content: "Test user message 3"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(49);
  });

  it("should format the messages correctly", () => {
    const assistant: string[] = ["one", "two", "three"];
    const user: string[] = ["one", "two", "three", "four"];
    const system = "Test system message";
    const expectedMessages: ChatCompletionRequestMessage[] = [
      {role: "system", content: system},
      {role: "user", content: "one"},
      {role: "assistant", content: "one"},
      {role: "user", content: "two"},
      {role: "assistant", content: "two"},
      {role: "user", content: "three"},
      {role: "assistant", content: "three"},
      {role: "user", content: "four"},
    ];
    const {messages, numTokensRequired} = formatOpenAIApiMessages(
      assistant,
      user,
      system
    );
    expect(messages).to.deep.equal(expectedMessages);
    expect(numTokensRequired).to.equal(44);
  });
});

describe("hashString", () => {
  it("should produce two distinct hash strings", () => {
    const str1 = "paul's pasta is the best";
    const str2 = "Paul's pasta is the best";
    const result1 = hashString(str1);
    const result2 = hashString(str2);
    expect(result1).to.not.equal(result2);
  });

  it("should produce two distinct hash strings", () => {
    const str1 = "luke";
    const str2 = "lukee";
    const result1 = hashString(str1);
    const result2 = hashString(str2);
    expect(result1).to.not.equal(result2);
  });

  it("should produce two distinct hash strings", () => {
    const str1 = "jake";
    const str2 = "joke";
    const result1 = hashString(str1);
    const result2 = hashString(str2);
    expect(result1).to.not.equal(result2);
  });

  it("should produce two distinct hash strings", () => {
    const str1 = "Ad alta";
    const str2 = "Ad ALTA";
    const result1 = hashString(str1);
    const result2 = hashString(str2);
    expect(result1).to.not.equal(result2);
  });

  it("should produce two distinct hash strings", () => {
    const str1 = "Lorem ipsum dolor sit amet, consectetur " +
      "adipiscingelit. Sed ut risus odio. In hac habitasse platea " +
      "dictumst. Sed ut velit vel tellus molestie gravida at et " +
      "quam. Donec eu dui quis enim lacinia hendrerit. Fusce " +
      "malesuada mi et sem bibendum ullamcorper. Integer at " +
      "dolor vel purus posuere pharetra sed id enim. Nullam sagittis " +
      "lobortis velit, vel tempor ex consequat at. Aliquam interdum " +
      "purus ac mauris consequat congue.";
    const str2 = "Lorem ipsum dolor sit ameti, consectetur " +
      "adipiscingelit. Sed ut risus odio. In hac habitasse platea " +
      "dictumst. Sed ut velit vel tellus molestie gravida at et " +
      "quam. Donec eu dui quis enim lacinia hendrerit. Fusce " +
      "malesuada mi et sem bibendum ullamcorper. Integer at " +
      "dolor vel purus posuere pharetra sed id enim. Nullam sagittis " +
      "lobortis velit, vel tempor ex consequat at. Aliquam interdum " +
      "purus ac mauris consequat congue.";
    const result1 = hashString(str1);
    const result2 = hashString(str2);
    expect(result1).to.not.equal(result2);
  });
});

describe("extractQuotedText", () => {
  it("returns the correct text for a string with outer quotes", () => {
    const input = "Liked \"Walruses are carnivorous and primarily " +
      "feed on a v...\"";
    const expected = "Walruses are carnivorous and primarily " +
      "feed on a v";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("returns the correct text for a string with inner quotes", () => {
    const input = "Loved \"Hello! Nice to meet you too. " +
      "How may I assist you ...\"";
    const expected = "Hello! Nice to meet you too. How may I assist you ";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("returns the correct text for a string with inner quotes", () => {
    const input = "Disliked \"Walruses are \"carnivorous\" and " +
      "primarily feed on a v...\"";
    const expected = "Walruses are \"carnivorous\" and primarily " +
      "feed on a v";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("returns the correct text for a string with inner quotes", () => {
    const input = "Questioned \"Walruses are \"carnivorous\" " +
      "and primarily feed on a v...\"";
    const expected = "Walruses are \"carnivorous\" and primarily " +
      "feed on a v";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("returns an empty string if no quotes are present", () => {
    const input = "This string has no quotes";
    const expected = "";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("handles empty input", () => {
    const input = "";
    const expected = "";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });

  it("handles input with only quotes", () => {
    const input = "\"\"";
    const expected = "";
    expect(extractQuotedText(input)).to.deep.equal(expected);
  });
});


describe("hashString and extractQuotedText", () => {
  it("should produce two equal hash strings", async () => {
    const str1 = "paul's pasta is the best";
    const str2 = "Liked \"paul's pasta is the best\"";
    const result1 = await hashString(str1);
    const result2 = await hashString(extractQuotedText(str2));
    expect(result1).to.deep.equal(result2);
  });

  it("should produce two equal strings", async () => {
    const str1 = "luke";
    const str2 = "Questioned \"luke...\"";
    const result1 = await hashString(str1);
    const result2 = await hashString(extractQuotedText(str2));
    expect(result1).to.deep.equal(result2);
  });

  it("should produce two equal strings", async () => {
    const str1 = "jake";
    const str2 = "Disliked \"jake\"";
    const result1 = await hashString(str1);
    const result2 = await hashString(extractQuotedText(str2));
    expect(result1).to.deep.equal(result2);
  });

  it("should produce two equal strings", async () => {
    const str1 = "Ad alta!!!";
    const str2 = "Laughed at \"Ad alta!!!\"";
    const result1 = await hashString(str1);
    const result2 = await hashString(extractQuotedText(str2));
    expect(result1).to.deep.equal(result2);
  });
});

describe("isValidStatus", () => {
  it("should be true (check Status enum)", () => {
    const pending1 = "pending";
    const pending2: Status = Status.PENDING;
    expect(pending1).to.deep.equal(pending2);
    const processing1 = "processing";
    const processing2: Status = Status.PROCESSING;
    expect(processing1).to.deep.equal(processing2);
    const timeout1 = "timeout";
    const timeout2: Status = Status.TIMEOUT;
    expect(timeout1).to.deep.equal(timeout2);
    const completed1 = "completed";
    const completed2: Status = Status.COMPLETED;
    expect(completed1).to.deep.equal(completed2);
    expect(isValidStatus(pending1)).to.deep.equal(true);
    expect(isValidStatus(pending2)).to.deep.equal(true);
    expect(isValidStatus(processing1)).to.deep.equal(true);
    expect(isValidStatus(processing2)).to.deep.equal(true);
    expect(isValidStatus(timeout1)).to.deep.equal(true);
    expect(isValidStatus(timeout2)).to.deep.equal(true);
    expect(isValidStatus(completed1)).to.deep.equal(true);
    expect(isValidStatus(completed2)).to.deep.equal(true);
  });
});

describe("isValidPurchaseType", () => {
  it("should be true (check PurchaseType enum)", () => {
    const nonRenewingPurchase1 = "NON_RENEWING_PURCHASE";
    const nonRenewingPurchase2: PurchaseType =
      PurchaseType.NON_RENEWING_PURCHASE;
    expect(nonRenewingPurchase1).to.deep.equal(nonRenewingPurchase2);
    const initialPurchase1 = "INITIAL_PURCHASE";
    const initialPurchase2: PurchaseType = PurchaseType.INITIAL_PURCHASE;
    expect(initialPurchase1).to.deep.equal(initialPurchase2);
    const productChange1 = "PRODUCT_CHANGE";
    const productChange2: PurchaseType = PurchaseType.PRODUCT_CHANGE;
    expect(productChange1).to.deep.equal(productChange2);
    const renewal1 = "RENEWAL";
    const renewal2: PurchaseType = PurchaseType.RENEWAL;
    expect(renewal1).to.deep.equal(renewal2);
    expect(isValidPurchaseType(nonRenewingPurchase1)).to.deep.equal(true);
    expect(isValidPurchaseType(nonRenewingPurchase2)).to.deep.equal(true);
    expect(isValidPurchaseType(initialPurchase1)).to.deep.equal(true);
    expect(isValidPurchaseType(initialPurchase2)).to.deep.equal(true);
    expect(isValidPurchaseType(productChange1)).to.deep.equal(true);
    expect(isValidPurchaseType(productChange2)).to.deep.equal(true);
    expect(isValidPurchaseType(renewal1)).to.deep.equal(true);
    expect(isValidPurchaseType(renewal2)).to.deep.equal(true);
  });
});

describe("isValidConsumableProductID", () => {
  it("should be true (check ConsumableProductID enum)", () => {
    const messages100a = "aiMessages_100_messages";
    const messages100b: ConsumableProductID =
      ConsumableProductID.MESSAGES100;
    expect(messages100a).to.deep.equal(messages100b);
    const messages500a = "aiMessages_500_messages";
    const messages500b: ConsumableProductID =
      ConsumableProductID.MESSAGES500;
    expect(messages500a).to.deep.equal(messages500b);
    const messages1000a = "aiMessages_1000_messages";
    const messages1000b: ConsumableProductID =
      ConsumableProductID.MESSAGES1000;
    expect(messages1000a).to.deep.equal(messages1000b);
    expect(isValidConsumableProductID(messages100a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages100b)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages500a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages500b)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages1000a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages1000b)).to.deep.equal(true);
  });
});

describe("parseNumberOfMessageCredits", () => {
  it("should be true (check message tokens after parse)", () => {
    const messages25a = "aiMessages_25_messages";
    const messages25b: ConsumableProductID =
      ConsumableProductID.MESSAGES25;
    const numTokens0: number = parseNumberOfMessageCredits(messages25a);
    expect(messages25a).to.deep.equal(messages25b);
    expect(numTokens0).to.deep.equal(25);

    const messages100a = "aiMessages_100_messages";
    const messages100b: ConsumableProductID =
      ConsumableProductID.MESSAGES100;
    const numTokens1: number = parseNumberOfMessageCredits(messages100a);
    expect(messages100a).to.deep.equal(messages100b);
    expect(numTokens1).to.deep.equal(100);

    const messages500a = "aiMessages_500_messages";
    const messages500b: ConsumableProductID =
      ConsumableProductID.MESSAGES500;
    const numTokens2: number = parseNumberOfMessageCredits(messages500a);
    expect(messages500a).to.deep.equal(messages500b);
    expect(numTokens2).to.deep.equal(500);

    const messages1000a = "aiMessages_1000_messages";
    const messages1000b: ConsumableProductID =
      ConsumableProductID.MESSAGES1000;
    const numTokens3: number = parseNumberOfMessageCredits(messages1000a);
    expect(messages1000a).to.deep.equal(messages1000b);
    expect(numTokens3).to.deep.equal(1000);

    expect(isValidConsumableProductID(messages25a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages25b)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages100a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages100b)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages500a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages500b)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages1000a)).to.deep.equal(true);
    expect(isValidConsumableProductID(messages1000b)).to.deep.equal(true);
  });
});

describe("generateUUIDs", () => {
  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique", () => {
    const randomUUID1 = uuidv4();
    const randomUUID2 = uuidv4();
    expect(randomUUID1).to.not.equal(randomUUID2);
  });

  it("should be unique for an array of ids", () => {
    const idArray: string[] = [];
    for (let index = 0; index < 10; index++) {
      idArray[index] = uuidv4();
      if (index > 0) {
        expect(idArray[index]).to.not.equal(idArray[index - 1]);
      }
    }
  });
});
