import axios from "axios";
import fs from "node:fs/promises";
import { ChannelData } from "./interfaces/channelData";
import { MessageData } from "./interfaces/messageData";
import moment from "moment";
import "json-bigint-patch";

const secondsDelay = 2,
	token = process.argv[2],
	debugMode = process.argv[3] == "debug";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let totalMessages = 0,
	totalDeleted = 0;

const CHANNELS_DATA: ChannelData[] = [],
	MESSAGES_DATA: { [key: string]: MessageData[] } = {};

function getUserIdFromToken(token: string): string {
	const tokenParts = token.split(".");
	const payload = tokenParts[0];
	return Buffer.from(payload, "base64").toString("utf-8");
}

const axiosInstance = axios.create({
	baseURL: "https://discord.com/api/v9",
	headers: {
		authorization: token,
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

const deleteMessage = async (channelId: string, messageId: bigint) => {
	return await axiosInstance.delete(`/channels/${channelId}/messages/${messageId.toString()}`);
};

async function main() {
	const myId = getUserIdFromToken(token);
	console.log(`My ID: ${myId}`);

	const channelsFolder = await fs.readdir("./messages");

	// Loop through all the folders in the messages directory to calculate the total number of messages
	for (const channelFolder of channelsFolder) {
		const channelDataFile = await fs.readFile(`./messages/${channelFolder}/channel.json`).catch(() => null);
		if (!channelDataFile) continue;

		// check if it's a DM
		const channelData: ChannelData = JSON.parse(channelDataFile.toString());
		if (!channelData.type || channelData.type != "DM") continue;

		// get destinataireId
		const destinataireId = channelData.recipients.find((id) => id !== myId);
		if (destinataireId == "Deleted User") continue;

		// get messages.json
		const messagesData = await fs.readFile(`./messages/${channelFolder}/messages.json`).catch(() => null);
		if (!messagesData) continue;

		// get messages
		const messages: MessageData[] = JSON.parse(messagesData.toString());
		totalMessages += messages.length;

		CHANNELS_DATA.push(channelData);
		MESSAGES_DATA[channelData.id] = JSON.parse(messagesData.toString());

		totalDeleted += messages.filter((message) => message?.Deleted == true).length;
	}

	// Loop through all the folders in the messages directory to delete the messages
	for (const channelData of CHANNELS_DATA) {
		if (!channelData.type || channelData.type != "DM") continue;

		// get destinataireId
		const destinataireId = channelData.recipients.find((id) => id !== myId);
		if (destinataireId == "Deleted User") continue;

		// get messages
		const channelMessages: MessageData[] = MESSAGES_DATA[channelData.id],
			messagesNotDeleted = channelMessages.filter((message) => {
				return !message.Deleted;
			});

		for (const message of messagesNotDeleted) {
			const totalChannelDeletedMessages: number = channelMessages.filter((message) => message.Deleted).length;
			const totalChannelMessages: number = channelMessages.length;
			const channelTotalPourcentage: string = ((totalChannelDeletedMessages / totalChannelMessages) * 100).toFixed(2);
			const channelTotalTimeReamining: number = (channelMessages.length - channelMessages.filter((message) => message.Deleted).length) * secondsDelay;

			const totalPourcentage: string = ((totalDeleted / totalMessages) * 100).toFixed(2);
			const totalTimeReamining: number = (totalMessages - totalDeleted) * secondsDelay;

			console.log(
				`${debugMode ? `${message.Contents}\n` : ""}Deleting message ${message.ID} in channel ${channelData.id} with user ${destinataireId}
- Channel: ${channelMessages.filter((message) => message.Deleted).length}/${channelMessages.length} - ${channelTotalPourcentage}% - ${moment.duration(channelTotalTimeReamining, "seconds").humanize()} remaining
- Total: ${totalDeleted}/${totalMessages} - ${totalPourcentage}% - ${moment.duration(totalTimeReamining, "seconds").humanize()} remaining`
			);

			// Delete the message
			await deleteMessage(channelData.id, message.ID)
				.then(async () => {
					// Update the message data
					message.Deleted = true;
					await fs.writeFile(`./messages/c${channelData.id}/messages.json`, JSON.stringify(channelMessages, null, 2));
				})
				.catch(async (error) => {
					const errorMessage = (error as any)?.response?.data?.message as string;

					console.error(errorMessage);

					if (errorMessage && ["Message inconnu", "message système"].some((msg) => errorMessage?.includes(msg))) {
						// Update the message data
						message.Deleted = true;
						await fs.writeFile(`./messages/c${channelData.id}/messages.json`, JSON.stringify(channelMessages, null, 1));
					}
				});

			totalDeleted++;

			// Don't spam the API
			await wait(secondsDelay * 1000);
		}

		console.log(`Finished deleting messages in channel ${channelData.id} with ${destinataireId}`);
	}

	// Log the totals
	console.log(`Total messages processed: ${totalMessages}`);
	console.log(`Total messages deleted: ${totalDeleted}`);

	console.log("Finished deleting all messages");
}

main();
