import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import { postToConnection } from '../../utils/postToConnection';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, PutCommandInput, UpdateCommand, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { Document, UserDocument, WebSocketConnection } from '../../types';
import { notifyClients } from '../../utils/notifyClients';
import { formatDocument } from '../../utils/formatDocument';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    const { connectionId } = event.requestContext;
    const { documentId } = event.queryStringParameters || {};
    const userId = event.requestContext.authorizer!.jwt.claims.sub;
    const username = event.requestContext.authorizer!.jwt.claims.username;

    if (!connectionId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'connectionId is required'
            })
        };
    }

    if (!documentId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'documentId is required'
            })
        };
    }

    try {
        const existingConnectionId = await ddbDocClient.send(new GetCommand({
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            Key: {
                documentId, connectionId
            }
        }));

        if (existingConnectionId.Item && await postToConnection((existingConnectionId.Item as WebSocketConnection).connectionId, JSON.stringify({ type: 'ping' }))) {
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

        notifyClients(documentId, JSON.stringify({ type: 'connection', message: `User ${username} connected.` }));

        const updateParams: UpdateCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE,
            Key: {
                userId, documentId
            },
            UpdateExpression: 'SET lastAccessedAt = :lastAccessedAt',
            ExpressionAttributeValues: {
                ':lastAccessedAt': Date.now().toString()
            },
            ReturnValues: 'ALL_NEW'
        };

        const newUserDocument = (await ddbDocClient.send(new UpdateCommand(updateParams))).Attributes;

        const document = await ddbDocClient.send(new GetCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: {
                documentId
            }
        }));

        const fullDoc = formatDocument(document.Item as Document, newUserDocument as UserDocument);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Connection established',
                document: fullDoc
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