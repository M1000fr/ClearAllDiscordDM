export interface ChannelData {
	id: string;
	type: "DM" | "GUILD_TEXT" | "GUILD_VOICE" | "GROUP_DM";
	recipients: string[];
}
