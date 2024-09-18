export interface Document {
    documentId: string; // partition key
    authorId: string;
    authorName: string;
    title: string;
    content: string;
    editors: string[];
    createdAt: string;
    updatedAt: string;
}

export interface UserDocument {
    userId: string; // partition key
    documentId: string; // sort key
    username: string;
    role: 'author' | 'editor';
    lastAccessedAt: string;
    createdAt: string;
}

export type FullDocument = Document & {
    user: {
        userId: string;
        role: 'author' | 'editor';
        lastAccessedAt: string;
    };
};

export interface WebSocketConnection {
    connectionId: string; // partition key
    documentId: string; // sort key
    userId: string;
    username: string;
}

export interface User {
    userId: string;
    name: string;
    role: 'author' | 'editor';
    appearance: number;
}