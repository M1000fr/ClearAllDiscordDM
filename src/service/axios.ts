import axios from "axios";

export const AxiosInstance = axios.create({
	baseURL: "https://discord.com/api/v9",
	headers: {
		authorization: process.argv[2],
		accept: "*/*",
		"accept-language": "fr,fr-FR;q=0.9",
		"content-type": "application/json",
		"sec-ch-ua": '"Not;A Brand";v="99", "Chromium";v="90"',
		"sec-ch-ua-mobile": "?0",
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "same-origin",
		"x-debug-options": "bugReporterEnabled",
	},
});

export const deleteMessage = async (channelId: string, messageId: bigint) => {
	return await AxiosInstance.delete(`/channels/${channelId}/messages/${messageId.toString()}`);
};
