import { Handler } from "aws-lambda";
import { postToDocument } from "../../utils/postToDocument";

export const handler: Handler = async (event) => {
    const message = JSON.parse(event.body);

    // Handle Yjs update messages
    if (message.type === 'sync-update') {
        const { documentId, update } = message;
        const updateMessage = JSON.stringify({ type: 'sync-update', update });

        postToDocument(documentId, updateMessage);
    }

    return { statusCode: 200 };
};