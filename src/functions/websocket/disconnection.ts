import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DeleteCommandInput, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import type { WebSocketConnection } from '../../types';
import { postToDocument } from '../../utils/postToDocument';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {

    const { connectionId } = event.requestContext;

    if (!connectionId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'connectionId is required'
            })
        };
    }

    try {
        const deleteParams: DeleteCommandInput = {
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            Key: { connectionId }
        };

        const { Attributes: connection } = await ddbDocClient.send(new DeleteCommand(deleteParams));

        postToDocument((connection as WebSocketConnection).documentId, JSON.stringify({ type: 'disconnection', message: `User ${(connection as WebSocketConnection).username} disconnected.` }));

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Connection deleted'
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error'
            })
        };
    }
};