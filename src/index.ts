import "json-bigint-patch";
import moment from "moment";
import fs from "node:fs/promises";
import { deleteMessage } from "service/axios";
import { getUserIdFromToken } from "utils/discordId";
import { wait } from "utils/wait";
import { ChannelData } from "./interfaces/channelData";
import { MessageData } from "./interfaces/messageData";

const secondsDelay = 2,
	token = process.argv[2],
	debugMode = process.argv[3] == "debug";

let totalMessages = 0,
	totalDeleted = 0;

const CHANNELS_DATA: ChannelData[] = [],
	MESSAGES_DATA: { [key: string]: MessageData[] } = {};

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
