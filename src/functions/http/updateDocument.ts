import type { Handler } from 'aws-lambda';

export const handler: Handler = async () => {
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'updateDocument function executed successfully!'
        })
    };
};