import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import { postToConnection } from '../../utils/postToConnection';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, PutCommandInput, UpdateCommand, UpdateCommandInput, GetCommand } from '@aws-sdk/lib-dynamodb';
import { WebSocketConnection } from '../../types';
import { postToDocument } from '../../utils/postToDocument';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    const documentId = event.queryStringParameters?.documentId;

    if (!event.requestContext.connectionId || !event.requestContext.authorizer) {
        return {
            statusCode: 400,
            body: ''
        };
    }

    const connectionId = event.requestContext.connectionId;
    const userId = event.requestContext.authorizer.sub;
    const username = event.requestContext.authorizer.username;

    if (!documentId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'documentId is required'
            })
        };
    }

    try {
        const { Items } = await ddbDocClient.send(new QueryCommand({
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            IndexName: 'userId-index',
            KeyConditionExpression: 'userId = :userId',
            FilterExpression: 'documentId = :documentId',
            ExpressionAttributeValues: {
                ':userId': userId,
                ':documentId': documentId
            }
        }));

        const { Item } = await ddbDocClient.send(new GetCommand({
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            Key: {
                connectionId
            }
        }));

        if ((Items?.[0] && await postToConnection((Items[0] as WebSocketConnection).connectionId, JSON.stringify({ type: 'ping' }))) || (
            Item && await postToConnection(Item.connectionId, JSON.stringify({ type: 'ping' }))
        )) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    message: 'Connection already exists'
                })
            };
        }

        const params: PutCommandInput = {
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            Item: {
                documentId,
                connectionId,
                userId,
                username
            }
        };

        await ddbDocClient.send(new PutCommand(params));

        postToDocument(documentId, JSON.stringify({ type: 'connection', message: `User ${username} connected.` }));

        const updateParams: UpdateCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE,
            Key: {
                userId, documentId
            },
            UpdateExpression: 'SET lastAccessedAt = :lastAccessedAt',
            ExpressionAttributeValues: {
                ':lastAccessedAt': Date.now().toString()
            }
        };

        await ddbDocClient.send(new UpdateCommand(updateParams));

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Connection established'
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Internal server error',
                err
            })
        };
    }
};