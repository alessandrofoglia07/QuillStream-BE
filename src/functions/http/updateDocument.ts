import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Document } from '../../types';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const userId = event.requestContext.authorizer!.jwt.claims.sub;
        const documentId = event.pathParameters?.id;
        const body = JSON.parse(event.body || '{}');

        if (!documentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Document ID is required' })
            };
        }

        const { title, content } = body;

        if (!title && !content) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Title or content are required' })
            };
        }

        if (title.length > 100) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Title cannot be longer than 100 characters' })
            };
        }

        const { Item } = await ddbDocClient.send(new GetCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: {
                documentId
            }
        }));

        if (!Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Document not found' })
            };
        }

        if (title === Item.title && content === Item.content) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'No changes detected' })
            };
        }

        if ((Item as Document).authorId !== userId) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden' })
            };
        }

        const { Attributes } = await ddbDocClient.send(new UpdateCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: {
                documentId
            },
            UpdateExpression: 'SET title = :title, content = :content',
            ExpressionAttributeValues: {
                ':title': title || Item.title,
                ':content': content || Item.content
            },
            ReturnValues: 'ALL_NEW'
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Document updated', document: Attributes })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Internal Server Error" })
        };
    }
};