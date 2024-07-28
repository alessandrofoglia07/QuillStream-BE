import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { postToConnection } from "./postToConnection";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { WebSocketConnection } from "../types";

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

/**
 * Authorization needed:
 * - `dynamodb:Query` on table `${process.env.WEBSOCKET_CONNECTIONS_TABLE}` with index `documentId-connectionId-index`
 * - `dynamodb:DeleteItem` on table `${process.env.WEBSOCKET_CONNECTIONS_TABLE}`
 * - `execute-api:ManageConnections` on API Gateway endpoint `${process.env.WSSAPIGATEWAY_ENDPOINT}`
 */
export const postToDocument = async (documentId: string, message: string) => {
    const connections = await ddbDocClient.send(new QueryCommand({
        TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
        IndexName: 'documentId-connectionId-index',
        KeyConditionExpression: 'documentId = :documentId',
        ExpressionAttributeValues: {
            ':documentId': documentId
        }
    }));

    if (!connections.Items) return;

    await Promise.all((connections.Items as WebSocketConnection[]).map(async (client: WebSocketConnection) => {
        await postToConnection(client.connectionId, message);
    }));
};