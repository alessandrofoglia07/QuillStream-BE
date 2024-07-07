import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Document } from '../../types';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const userId = event.requestContext.authorizer!.jwt.claims.sub;
        const documentId = event.pathParameters?.id;

        if (!documentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Document ID is required' })
            };
        }

        const { Item } = (await ddbDocClient.send(new GetCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: {
                documentId
            }
        })));

        if (!Item) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: 'Document not found' })
            };
        }

        if ((Item as Document).authorId !== userId) {
            return {
                statusCode: 403,
                body: JSON.stringify({ message: 'Forbidden' })
            };
        }

        const { Items } = await ddbDocClient.send(new QueryCommand({
            TableName: process.env.USER_DOCUMENTS_TABLE,
            IndexName: 'documentId-index',
            KeyConditionExpression: '#documentId = :documentId',
            ExpressionAttributeNames: {
                '#documentId': 'documentId'
            },
            ExpressionAttributeValues: {
                ':documentId': documentId
            },
        }));

        if (Items?.length) {
            for (let i = 0; i < Items?.length; i += 25) {
                await ddbDocClient.send(new BatchWriteCommand({
                    RequestItems: {
                        [process.env.USER_DOCUMENTS_TABLE]: Items.slice(i, i + 25).map(Item => ({
                            DeleteRequest: {
                                Key: {
                                    documentId: Item.documentId,
                                    userId: Item.userId
                                }
                            }
                        }))
                    }
                }));
            }
        }

        await ddbDocClient.send(new DeleteCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: {
                documentId
            }
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Document deleted' })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };
    }
};