import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb';
import { formatDocument } from '../../utils/formatDocument';
import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import type { Document, FullDocument, UserDocument } from '../../types';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const documentId = event.pathParameters?.id;
        const userId = event.requestContext.authorizer!.jwt.claims.sub;

        if (!documentId) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Document ID is required'
                })
            };
        }

        const params: GetCommandInput = {
            TableName: process.env.DOCUMENTS_TABLE,
            Key: { documentId }
        };
        const { Item: document } = await ddbDocClient.send(new GetCommand(params));

        if (!document) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Document not found'
                })
            };
        }

        const userParams: GetCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE,
            Key: {
                userId,
                documentId
            }
        };
        const { Item: userDocument } = await ddbDocClient.send(new GetCommand(userParams));

        if (!userDocument) {
            return {
                statusCode: 403,
                body: JSON.stringify({
                    message: 'Unauthorized'
                })
            };
        }

        const fullDocument: FullDocument = formatDocument(document as Document, userDocument as UserDocument);

        return {
            statusCode: 200,
            body: JSON.stringify(fullDocument)
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