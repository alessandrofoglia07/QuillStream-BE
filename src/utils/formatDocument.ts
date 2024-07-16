import { Document, FullDocument, UserDocument } from "../types";

export const formatDocument = (documentData: Document, userDocument: UserDocument): FullDocument => {
    return {
        ...documentData,
        user: {
            userId: userDocument.userId,
            role: userDocument.role,
            lastAccessedAt: userDocument.lastAccessedAt
        }
    };
};