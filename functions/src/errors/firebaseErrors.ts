type ErrorName =
  | "UPLOAD_FAILED"
  | "NO_FILE_DOWNLOADED";

type ErrorMessages = {
  [name in ErrorName]: string;
};

export const FIREBASE_ERROR_MESSAGES: ErrorMessages = {
  UPLOAD_FAILED: "Failed to upload file to Firebase Firestore/Storage.",
  NO_FILE_DOWNLOADED: "No file available at download.",
};

/**
 * Error class for Firebase errors
 */
export class FirebaseError extends Error {
  name: ErrorName;
  message: string;

  /**
   * @param {string} name - The error name as string
   */
  constructor({
    name,
  }: {
    name: ErrorName;
  }) {
    super();
    this.name = name;
    this.message = FIREBASE_ERROR_MESSAGES[this.name];
  }
}
