import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { Document, User, UserDocument, WebSocketConnection } from "../../types";
import { AdminGetUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.SERVERLESS_AWS_REGION });

// TODO: Fix this
export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    const documentId = event.pathParameters?.id;

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

        const editors = (document as Document).editors; // usernames of the editors

        const editorsData: User[] = [];

        await Promise.all(editors.map(async (editorUsername: string) => {
            const { UserAttributes } = await cognitoClient.send(new AdminGetUserCommand({
                UserPoolId: process.env.COGNITO_USER_POOL,
                Username: editorUsername
            }));
            editorsData.push({
                username: editorUsername,
                name: UserAttributes?.find(attr => attr.Name === 'name')?.Value || '',
                appearance: parseInt(UserAttributes?.find(attr => attr.Name === 'custom:appearance')?.Value || '0'),
                role: 'editor'
            });
        }));

        const { Items: userDocuments } = await ddbDocClient.send(new QueryCommand({
            TableName: process.env.USER_DOCUMENTS_TABLE,
            IndexName: 'documentId-index',
            KeyConditionExpression: 'documentId = :documentId',
            ExpressionAttributeValues: {
                ':documentId': documentId
            }
        }));

        for (const userDocument of userDocuments as UserDocument[]) {
            if (userDocument.role === 'author') {
                const editor = editorsData.find(editor => editor.username === userDocument.username);
                if (!editor) return;
                editor.role = 'author';
                break;
            }
        }

        const { Items: websocketConnections } = await ddbDocClient.send(new QueryCommand({
            TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
            IndexName: 'documentId-connectionId-index',
            KeyConditionExpression: 'documentId = :documentId',
            ExpressionAttributeValues: {
                ':documentId': documentId
            }
        }));

        if (!websocketConnections) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    activeEditors: [],
                    inactiveEditors: editorsData
                })
            };
        }

        const activeEditors: User[] = [];
        const inactiveEditors: User[] = [];

        for (const editor of editorsData) {
            const connection = (websocketConnections as WebSocketConnection[])?.find(connection => connection.username === editor.username);
            if (connection) {
                activeEditors.push(editor);
            } else {
                inactiveEditors.push(editor);
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                activeEditors,
                inactiveEditors
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