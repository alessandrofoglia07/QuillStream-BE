import type { Handler, APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { UserDocument } from '../../types';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const userId = event.requestContext.authorizer!.jwt.claims.sub;


        const queryParams: QueryCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE || 'UserDocumentsTable',
            KeyConditionExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId'
            },
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const { Items } = (await ddbDocClient.send(new QueryCommand(queryParams))) as { Items: UserDocument[] | undefined; };

        if (!Items || Items.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ owned: 0, shared: 0 })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                owned: Items.filter((item) => item.role === 'author').length,
                shared: Items.filter((item) => item.role === 'editor').length
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };
    }
};