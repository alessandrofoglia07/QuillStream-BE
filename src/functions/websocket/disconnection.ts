import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DeleteCommandInput, DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import type { WebSocketConnection } from '../../types';
import { notifyClients } from '../../utils/notifyClients';

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

    const getParams: QueryCommandInput = {
        TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
        IndexName: 'connectionId-index',
        KeyConditionExpression: 'connectionId = :connectionId',
        ExpressionAttributeValues: {
            ':connectionId': connectionId
        }
    };

    try {
        const { Items } = await ddbDocClient.send(new QueryCommand(getParams));
        if (!Items || Items.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Connection not found'
                })
            };
        }

        const deleteParams: DeleteCommandInput = {
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            Key: {
                documentId: (Items[0] as WebSocketConnection).documentId,
                connectionId
            }
        };

        await ddbDocClient.send(new DeleteCommand(deleteParams));

        notifyClients((Items[0] as WebSocketConnection).documentId, JSON.stringify({ type: 'disconnection', message: `User ${(Items[0] as WebSocketConnection).username} disconnected.` }));

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