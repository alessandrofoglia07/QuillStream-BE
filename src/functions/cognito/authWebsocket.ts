import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent, AuthResponse, PolicyDocument } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL,
    tokenUse: 'access',
    clientId: process.env.COGNITO_USER_POOL_CLIENT
});

export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
    try {
        if (!event.queryStringParameters || !event.queryStringParameters.token) {
            throw new Error("Unauthorized");
        }

        const token = event.queryStringParameters.token;

        const payload = await verifier.verify(token);

        return generatePolicy("user", "Allow", event.methodArn, { sub: payload.sub, username: payload.username });
    } catch (err) {
        throw new Error("Unauthorized");
    }
};

const generatePolicy = (principalId: string, effect: string, resource: string, responseContext: Record<string, string>) => {
    const authResponse = {} as AuthResponse;
    authResponse.principalId = principalId;
    if (effect && resource) {
        const policyDocument = {} as PolicyDocument;
        policyDocument.Version = '2012-10-17'; // default version
        policyDocument.Statement = [];
        const statementOne = {} as {
            Action: string;
            Effect: string;
            Resource: string;
        };
        statementOne.Action = 'execute-api:Invoke'; // default action
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    authResponse.context = { ...responseContext };

    return authResponse;
};