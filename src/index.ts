import axios from "axios";
import fs from "node:fs/promises";
import { ChannelData } from "./interfaces/channelData";
import { MessageData } from "./interfaces/messageData";
import { MessageDeleteData } from "./interfaces/messageDeleteData";
import moment from "moment";

const secondsDelay = 2,
	token = process.argv[2];

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

const deleteMessage = async (channelId: string, messageId: string) => {
	return await axiosInstance.delete(
		`/channels/${channelId}/messages/${messageId}`
	);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let totalMessages = 0,
	totalDeleted = 0;

const CHANNELS_DATA: ChannelData[] = [],
	MESSAGES_DATA: { [key: string]: MessageData[] } = {};

async function main() {
	const myId = getUserIdFromToken(token);
	console.log(`My ID: ${myId}`);

	const channelsFolder = await fs.readdir("./messages");

	// get messagesDeleted.json, if not exists, create it
	var messagesDeletedFile: MessageDeleteData[] = await fs
		.readFile("./messagesDeleted.json")
		.catch(() => null)
		.then((data) => data && JSON.parse(data.toString()));
	if (!messagesDeletedFile) {
		await fs.writeFile("./messagesDeleted.json", "[]");
		messagesDeletedFile = [];
	}

	totalDeleted += messagesDeletedFile.length;

	// Loop through all the folders in the messages directory to calculate the total number of messages
	for (const channelFolder of channelsFolder) {
		const channelDataFile = await fs
			.readFile(`./messages/${channelFolder}/channel.json`)
			.catch(() => null);
		if (!channelDataFile) continue;

		// check if it's a DM
		const channelData: ChannelData = JSON.parse(channelDataFile.toString());
		if (!channelData.type || channelData.type != "DM") continue;

		// get destinataireId
		const destinataireId = channelData.recipients.find((id) => id !== myId);
		if (destinataireId == "Deleted User") continue;

		// get messages.json
		const messagesData = await fs
			.readFile(`./messages/${channelFolder}/messages.json`)
			.catch(() => null);
		if (!messagesData) continue;

		// get messagesDeleted.json and filter to get only messages not deleted
		const messages: MessageData[] = JSON.parse(messagesData.toString());
		totalMessages += messages.length;

		CHANNELS_DATA.push(channelData);
		MESSAGES_DATA[channelData.id] = JSON.parse(messagesData.toString());
	}

	// Loop through all the folders in the messages directory to delete the messages
	for (const channelData of CHANNELS_DATA) {
		if (!channelData.type || channelData.type != "DM") continue;

		// get destinataireId
		const destinataireId = channelData.recipients.find((id) => id !== myId);
		if (destinataireId == "Deleted User") continue;

		// get messagesDeleted.json and filter to get only messages not deleted
		const messages: MessageData[] = MESSAGES_DATA[channelData.id],
			messagesNotDeleted = messages.filter((message) => {
				const messageDeleted = messagesDeletedFile.find(
					(messageDeleted) =>
						messageDeleted.channel_id === channelData.id &&
						messageDeleted.message_id === message.ID
				);
				return !messageDeleted;
			});

		for (const message of messagesNotDeleted) {
			const totalPourcentage = (
				(totalDeleted / totalMessages) *
				100
			).toFixed(2);

			const timeReamining = (totalMessages - totalDeleted) * secondsDelay;

			console.log(
				`Deleting message ${message.ID} in channel ${
					channelData.id
				} with ${destinataireId} (${totalDeleted}/${totalMessages} - ${totalPourcentage}%) - ${moment
					.duration(timeReamining, "seconds")
					.humanize()} remaining`
			);

			// Delete the message
			await deleteMessage(channelData.id, message.ID)
				.then(async () => {
					// Incrémenter totalDeleted lorsqu'un message est supprimé avec succès
					totalDeleted++;

					messagesDeletedFile.push({
						channel_id: channelData.id,
						message_id: message.ID,
					});
					await fs.writeFile(
						"./messagesDeleted.json",
						JSON.stringify(messagesDeletedFile, null, 2)
					);
				})
				.catch(async (error) => {
					const errorMessage = (error as any)?.response?.data
						?.message as string;

					console.error(errorMessage);

					if (
						errorMessage &&
						["Message inconnu", "message système"].some((msg) =>
							errorMessage?.includes(msg)
						)
					) {
						messagesDeletedFile.push({
							channel_id: channelData.id,
							message_id: message.ID,
						});
						await fs.writeFile(
							"./messagesDeleted.json",
							JSON.stringify(messagesDeletedFile, null, 2)
						);
					}
				});

			// Don't spam the API
			await wait(secondsDelay * 1000);
		}

		console.log(
			`Finished deleting messages in channel ${channelData.id} with ${destinataireId}`
		);
	}

	// Log the totals
	console.log(`Total messages processed: ${totalMessages}`);
	console.log(`Total messages deleted: ${totalDeleted}`);

	console.log("Finished deleting all messages");
}

main();
