// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";
import {FirebaseError} from "../errors/firebaseErrors";
import {
  Timestamp,
} from "firebase-admin/firestore";

import {
  Collection,
  SubCollection,
  LoggingEventProvider,
  LoggingEventStatus,
  LoggingEventType,
  LoggingObject,
} from "../globals";

export type DocumentData = {
  [field: string]:
    | string
    | number
    | boolean
    | Date
    | Timestamp
    | Array<string | number | boolean | Date | Timestamp>;
};

/**
 * Class for managing data in Firebase
 * (Firestore and Storage)
 * @class
 * @classdesc Class for managing data in Firestore
 * @hideconstructor
 * @memberof module:utils
 * @category Utils
 */
export class DataManager {
  private db: admin.firestore.Firestore;
  private bucket: any;

  /**
   * @constructor
   * @throws {FirebaseError}
   */
  constructor() {
    // Initialize the Firestore database
    this.db = admin.firestore();
    this.bucket = admin.storage().bucket();
  }

  /**
   * Returns the Firestore database
   * @return {admin.firestore.Firestore} - The Firestore database
   */
  public getDb(): admin.firestore.Firestore {
    return this.db;
  }

  /**
   * Uploads a document to a Firestore collection or subcollection
   * @param {Collection} collection - the name of the collection
   * @param {string} docID1 - the name of the document
   * @param {SubCollection | string | undefined} subCollection
   *  - the name of the subcollection, if any
   * @param {string | undefined} docId2 - the name of the
   * document at the second level, if any
   * @return {Promise<any>}
   * @throws {FirebaseError}
   */
  async getDocument(
    collection: Collection,
    docID1: string,
    subCollection?: SubCollection | string | undefined,
    docId2?: string | undefined,
  ): Promise<any> {
    let docRef: any;

    if (subCollection && docId2) {
      docRef = this.db
        .collection(collection)
        .doc(docID1)
        .collection(subCollection)
        .doc(docId2);
    } else {
      docRef = this.db
        .collection(collection)
        .doc(docID1);
    }

    const doc = await docRef.get();
    if (!doc.exists) {
      // If this doc does not exist, throw an error
      throw new FirebaseError({
        name: "NO_FILE_DOWNLOADED",
      });
    } else {
      return doc.data();
    }
  }

  /**
   * Sets a document to a Firestore collection or subcollection with
   * a provided document ID
   * @param {DocumentData} data - the data to upload
   * @param {Collection} collection - the name of the collection
   * @param {string} docID1 - the name of the document
   * @param {SubCollection | string | undefined} subCollection
   *  - the name of the subcollection, if any
   * @param {string | undefined} docId2 - the name of the document
   *  at the second level, if any
   * @param {boolean} merge - whether to merge the data with existing data
   * @return {Promise<boolean>}
   * @throws {FirebaseError}
   */
  async setDocument(
    data: DocumentData,
    collection: Collection,
    docID1: string,
    subCollection?: SubCollection | string | undefined,
    docId2?: string | undefined,
    merge = true
  ): Promise<boolean> {
    let writeResult: any;
    try {
      if (docID1 && subCollection && docId2) {
        writeResult = await this.db
          .collection(collection)
          .doc(docID1)
          .collection(subCollection)
          .doc(docId2)
          .set(data, {merge: merge});
      } else {
        writeResult = await this.db
          .collection(collection)
          .doc(docID1)
          .set(data, {merge: merge});
      }
      if (writeResult) {
        return true;
      } else {
        throw new FirebaseError({
          name: "UPLOAD_FAILED",
        });
      }
    } catch (error) {
      console.log(error);
      throw new FirebaseError({
        name: "UPLOAD_FAILED",
      });
    }
  }

  /**
   * Adds a document to a Firestore collection or subcollection
   * @param {DocumentData} data - the data to upload
   * @param {Collection} collection - the name of the collection
   * @param {string | undefined} docID1 - the name of the document, if any
   * @param {SubCollection | string | undefined} subCollection
   *  - the name of the subcollection, if any
   * @return {Promise<boolean>}
   * @throws {FirebaseError}
   */
  async addDocument(
    data: DocumentData,
    collection: Collection,
    docID1?: string | undefined,
    subCollection?: SubCollection | string | undefined,
  ): Promise<boolean> {
    let writeResult: any;
    try {
      if (docID1 && subCollection) {
        writeResult = await this.db
          .collection(collection)
          .doc(docID1)
          .collection(subCollection)
          .add(data);
      } else {
        writeResult = await this.db
          .collection(collection)
          .add(data);
      }
      if (writeResult) {
        return true;
      } else {
        throw new FirebaseError({
          name: "UPLOAD_FAILED",
        });
      }
    } catch (error) {
      console.log(error);
      throw new FirebaseError({
        name: "UPLOAD_FAILED",
      });
    }
  }

  /**
   * Uploads an image to Firebase Cloud Storage
   * @param {string} b64ImageString
   * @param {string} uid
   * @param {string} id
   * @param {string} sessionId
   * @return {Promise<string>}
   * @throws {FirebaseError}
   */
  async pushImageToStorageBucket(
    b64ImageString: string,
    uid: string,
    id: string,
    sessionId: string
  ): Promise<string> {
    // Convert the base64 string back to an image to
    // upload into the Google Cloud Storage bucket
    const imageBuffer = Buffer.from(b64ImageString, "base64");
    const fileName = "activeImage.png";
    const file = this.bucket.file(`historyImages/${uid}/${id}/` + fileName);

    // Upload the image to the bucket
    const toLogInit: LoggingObject = {
      session_id: sessionId,
      uid: uid,
      event_type: LoggingEventType.FIREBASE_STORAGE_UPLOAD,
      event_provider: LoggingEventProvider.FIREBASE,
      event_status: LoggingEventStatus.REQUESTED,
    };
    console.log(JSON.stringify(toLogInit));
    await new Promise<void>((resolve, reject) => {
      file.save(imageBuffer, {
        metadata: {contentType: "image/png"},
      }, (error: any) => {
        if (error) {
          const toLog: LoggingObject = {
            session_id: sessionId,
            uid: uid,
            event_type: LoggingEventType.FIREBASE_STORAGE_UPLOAD,
            event_provider: LoggingEventProvider.FIREBASE,
            event_status: LoggingEventStatus.FAILED,
            http_type: 400,
          };
          console.log(JSON.stringify(toLog));
          console.log(error);
          reject(new FirebaseError({name: "UPLOAD_FAILED"}));
        } else {
          resolve();
        }
      });
    });
    const toLogFin: LoggingObject = {
      session_id: sessionId,
      uid: uid,
      event_type: LoggingEventType.FIREBASE_STORAGE_UPLOAD,
      event_provider: LoggingEventProvider.FIREBASE,
      event_status: LoggingEventStatus.COMPLETED,
      http_type: 200,
    };
    console.log(JSON.stringify(toLogFin));

    // Get the signed URL for the saved image
    const toLogCloudURLInit: LoggingObject = {
      session_id: sessionId,
      uid: uid,
      event_type: LoggingEventType.FIREBASE_CLOUD_URL_RETRIEVAL,
      event_provider: LoggingEventProvider.FIREBASE,
      event_status: LoggingEventStatus.REQUESTED,
    };
    console.log(JSON.stringify(toLogCloudURLInit));
    const [cloudURL] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2036", // Adjust the expiration date as needed
    });
    const toLogCloudURLFin: LoggingObject = {
      session_id: sessionId,
      uid: uid,
      event_type: LoggingEventType.FIREBASE_CLOUD_URL_RETRIEVAL,
      event_provider: LoggingEventProvider.FIREBASE,
      event_status: LoggingEventStatus.COMPLETED,
      http_type: 200,
    };
    console.log(JSON.stringify(toLogCloudURLFin));

    return cloudURL;
  }
}
