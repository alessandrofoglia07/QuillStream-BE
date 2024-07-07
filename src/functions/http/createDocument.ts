import type { APIGatewayProxyEvent, Handler } from 'aws-lambda';
import type { Document, UserDocument } from '../../types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, PutCommandInput, QueryCommand, QueryCommandInput, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';

const dynamoDB = new DynamoDBClient({ region: process.env.SERVERLESS_AWS_REGION });
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDB);

function getLastNewDocumentNumber(documents: Document[] | undefined): number | null {
    try {
        if (!Array.isArray(documents)) return null;

        // Filter documents that start with "New Document"
        const newDocumentTitles = documents
            .map(doc => doc.title)
            .filter(title => title && title.startsWith("New Document"));

        if (newDocumentTitles.length === 0) return null;

        // Extract numbers and find the highest
        let maxNumber = -1;

        newDocumentTitles.forEach(title => {
            const match = title!.match(/New Document(?: (\d+))?/);
            if (match) {
                const number = match[1] ? parseInt(match[1], 10) : 0;
                if (!isNaN(number) && number > maxNumber) {
                    maxNumber = number;
                }
            }
        });

        return maxNumber === -1 ? null : maxNumber;
    } catch (err) {
        return null;
    }
}

export const handler: Handler = async (event: APIGatewayProxyEvent) => {
    try {
        const userId = event.requestContext.authorizer!.jwt.claims.sub;
        const username = event.requestContext.authorizer!.jwt.claims.username;

        const queryParams: QueryCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE,
            KeyConditionExpression: '#userId = :userId',
            FilterExpression: '#role = :role',
            ExpressionAttributeNames: {
                '#userId': 'userId',
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':userId': userId,
                ':role': 'author'
            }
        };

        const { Items } = await ddbDocClient.send(new QueryCommand(queryParams));

        let newDocumentTitle = 'New Document';

        if (Items) {
            let documents: Document[] = [];

            // Get all documentIds
            for (let i = 0; i < Items.length; i += 100) {
                const { Responses } = await ddbDocClient.send(new BatchGetCommand({
                    RequestItems: {
                        [process.env.DOCUMENTS_TABLE]: {
                            Keys: Items.slice(i, i + 100).map((item) => ({
                                documentId: item.documentId as string
                            }))
                        }
                    }
                }));

                if (Responses && Responses[process.env.DOCUMENTS_TABLE]) {
                    documents = [...documents, ...Responses[process.env.DOCUMENTS_TABLE] as Document[]];
                }
            }

            const lastNewDocumentNumber = getLastNewDocumentNumber(documents as Document[]);
            if (lastNewDocumentNumber !== null) {
                newDocumentTitle += ` ${lastNewDocumentNumber + 1}`;
            }
        }

        const now = Date.now().toString();

        const newDocument: Document = {
            documentId: uuid(),
            authorId: userId,
            authorName: username,
            editors: [userId],
            title: newDocumentTitle,
            content: '',
            createdAt: now,
            updatedAt: now
        };

        const newUserDocument: UserDocument = {
            userId,
            documentId: newDocument.documentId,
            role: 'author',
            createdAt: now,
            lastAccessedAt: '-1'
        };

        const putDocumentParams: PutCommandInput = {
            TableName: process.env.DOCUMENTS_TABLE,
            Item: newDocument
        };

        const putUserDocumentParams: PutCommandInput = {
            TableName: process.env.USER_DOCUMENTS_TABLE,
            Item: newUserDocument
        };

        await ddbDocClient.send(new PutCommand(putDocumentParams));
        await ddbDocClient.send(new PutCommand(putUserDocumentParams));

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Document created successfully",
                documentId: newDocument.documentId
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Internal server error",
                error: err
            })
        };
    }
};