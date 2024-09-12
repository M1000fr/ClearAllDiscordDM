export const getUserIdFromToken = (token: string): string => {
	const tokenParts = token.split(".");
	const payload = tokenParts[0];
	return Buffer.from(payload, "base64").toString("utf-8");
};
