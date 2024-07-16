import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';

const client = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(client);

const apiGateway = new ApiGatewayManagementApi({
    endpoint: process.env.WSSAPIGATEWAY_ENDPOINT
});

export const postToConnection = async (connectionId: string, data: string): Promise<boolean> => {
    try {
        await apiGateway.postToConnection({
            ConnectionId: connectionId,
            Data: data
        });

        return true;
    } catch (err) {
        if ((err as { statusCode: number, [key: string]: unknown; }).statusCode === 410) {
            await ddbDocClient.send(new DeleteCommand({
                TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
                Key: { connectionId }
            }));
        }
        return false;
    }
};