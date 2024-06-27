import type { Handler } from 'aws-lambda';

export const handler: Handler = async (event) => {
    if (event.triggerSource === 'CustomMessage_ForgotPassword') {
        const link = `${process.env.CLIENT_URL}/account/reset/${event.request.userAttributes.email}/${event.request.codeParameter}`;
        event.response.emailSubject = 'Reset your password';
        event.response.emailMessage = `To reset your password, please click the following link: ${link}.`;
    }
    return event;
};