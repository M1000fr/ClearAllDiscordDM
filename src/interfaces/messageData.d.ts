export interface MessageData {
	ID: bigint;
	Timestamp: string;
	Contents: string;
	Attachments: string;
	Deleted?: boolean;
}
