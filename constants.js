export const defaultSettings = (groupIdFromToken) => {
  return {
    groupId: groupIdFromToken,
    tokenId: null,
    minBuy: 1,
    step: 50,
    emoji: "🚀",
    charts: "Dextools",
    paused: false,
    mediaEnabled: false,
    mediaImage: "",
    mediaThreshold: 100,
    socialLinks: {
      Telegram: "",
      Website: "",
      Twitter: "",
    },
  };
};

export const errorMessage = "An error has occurred, please try again later.";
export const maxTokensReachedMessage = "You have reached the maximum number of tokens allowed. Please delete a token before adding a new one.";