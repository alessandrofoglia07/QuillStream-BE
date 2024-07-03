import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput, GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb';
import { Document, FullDocument, UserDocument } from '../../types';

const dynamoDB = new DynamoDBClient({ region: 'us-west-1' });
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDB);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const userId = event.requestContext.authorizer!.jwt.claims.sub;

        const queryParams: QueryCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE || 'UserDocumentsTable',
            IndexName: 'userId-lastAccessedAt-index',
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':userId': userId
            },
            Limit: 10,
            ScanIndexForward: false
        };

        const { Items } = await ddbDocClient.send(new QueryCommand(queryParams));

        if (!Items || Items.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify([])
            };
        }

        const result: FullDocument[] = [];

        // Get document details
        for (const userDoc of Items as UserDocument[]) {
            const docParams: GetCommandInput = {
                TableName: process.env.DOCUMENTS_TABLE || 'DocumentsTable',
                Key: {
                    documentId: userDoc.documentId
                }
            };

            const { Item } = await ddbDocClient.send(new GetCommand(docParams));

            const doc: FullDocument = {
                ...Item as Document,
                user: {
                    lastAccessedAt: userDoc.lastAccessedAt,
                    role: userDoc.role,
                    userId: userDoc.userId
                }
            };

            result.push(doc);
        }

        return {
            statusCode: 200,
            body: JSON.stringify(result)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: err
            })
        };
    }
};