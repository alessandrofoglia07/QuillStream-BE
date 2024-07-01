export interface Document {
    documentId: string; // partition key
    authorId: string;
    content: string;
    editors: string[];
    createdAt: string;
    lastAccessedAt: string;
}

export interface UserDocument {
    userId: string; // partition key
    documentId: string; // sort key
    role: 'author' | 'editor';
    lastAccessedAt: string;
    createdAt: string;
}

export interface WebSocketConnection {
    connectionId: string; // partition key
    documentId: string; // sort key
    userId: string;
}