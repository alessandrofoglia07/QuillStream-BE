import { AdminGetUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { Document, UserDocument } from "../../types";

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.SERVERLESS_AWS_REGION });

export const handler: Handler = async (event: APIGatewayProxyEvent) => {

    const { username } = JSON.parse(event.body || '{}');
    const documentId = event.pathParameters?.id;

    if (!username) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Missing username',
            })
        };
    }

    if (!documentId) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Missing documentId'
            })
        };
    }

    try {
        const { Item: document } = await ddbDocClient.send(new GetCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: { documentId }
        }));
        if (!document) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Document not found'
                })
            };
        }

        const { UserAttributes } = await cognitoClient.send(new AdminGetUserCommand({
            UserPoolId: process.env.COGNITO_USER_POOL,
            Username: username
        }));
        if (!UserAttributes) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'User not found'
                })
            };
        }

        const userId = UserAttributes.find(attr => attr.Name === 'sub')!.Value!;

        if ((document as Document).editors.includes(userId)) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'User is already an editor'
                })
            };
        }

        const newUserDocument: UserDocument = {
            userId,
            documentId: documentId,
            username,
            role: 'editor',
            createdAt: Date.now().toString(),
            lastAccessedAt: '-1'
        };

        await ddbDocClient.send(new PutCommand({
            TableName: process.env.USER_DOCUMENTS_TABLE,
            Item: newUserDocument
        }));

        await ddbDocClient.send(new UpdateCommand({
            TableName: process.env.DOCUMENTS_TABLE,
            Key: { documentId },
            UpdateExpression: 'SET editors = list_append(editors, :userId)',
            ExpressionAttributeValues: {
                ':userId': [userId]
            }
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'User added as editor'
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