import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ScheduledHandler } from "aws-lambda";
import { WebSocketConnection } from "../../types";
import { postToConnection } from "../../utils/postToConnection";

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: ScheduledHandler = async () => {
    try {
        const { Items } = await ddbDocClient.send(new ScanCommand({
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
        }));

        if (!Items) return;

        (Items as WebSocketConnection[]).map(async (connection) => {
            await postToConnection(connection.connectionId, JSON.stringify({ type: 'ping' })); // will automatically clean up stale connections
        });
    } catch (err) {
        console.error(err);
    }
};