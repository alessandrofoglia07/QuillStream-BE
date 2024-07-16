import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { postToConnection } from "./postToConnection";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { WebSocketConnection } from "../types";

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const notifyClients = async (documentId: string, message: string) => {
    const connections = await ddbDocClient.send(new QueryCommand({
        TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
        KeyConditionExpression: 'documentId = :documentId',
        ExpressionAttributeValues: {
            ':documentId': documentId
        }
    }));

    if (!connections.Items) {
        return;
    }

    await Promise.all((connections.Items as WebSocketConnection[]).map(async (client: WebSocketConnection) => {
        await postToConnection(client.connectionId, message);
    }));
};