// Description: Main file of the bot, here are the commands and the database connection
import TelegramBot from "node-telegram-bot-api";
import mongoose from "mongoose";
import sanitizeHtml from "sanitize-html";
import { DefinedRealtimeClient } from "defined-realtime-websocket";
import "dotenv/config";

// Database models
import { Message, User, Settings, Token, Ad } from "./models/index.js";

// Fetching data
import {
  getTokenDetails,
  checkHolder,
  getHolders,
  getPairInfo,
} from "./fetch.js";

import {
  defaultSettings,
  errorMessage,
  maxTokensReachedMessage,
} from "./constants.js";
import {
  requestTokenAddress,
  requestSettingNumber,
  requestImage,
  requestSettingBoolean,
  requestSettingDate,
  requestSettingText,
  verifyTokenAddress,
  deleteMessage,
  sendSettingsKeyboard,
} from "./helpers.js";

const admin = [6368601263, 1770977354];

const chartAddress = {
  Geckoterminal: "https://www.geckoterminal.com/es/eth/pools/",
  Dextools: "https://www.dextools.io/app/es/ether/pair-explorer/",
  Dexscreener: "https://dexscreener.com/ethereum/",
  Coinscan: "https://www.coinscan.com/es/tokens/eth/",
};

// Temporal variables
let tempUsers = {};
let tempRunning = {};

// Database connection
mongoose
  .connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Error trying to connect: ", err));

// Bot initialization
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const restartBuyBots = async () => {
  const users = await User.find();
  for (const user of users) {
    for (const settingsId of user.tokensSet) {
      const settings = await Settings.findOne({ _id: settingsId }).populate(
        "tokenId"
      );
      if (settings && !settings.paused) {
        try {
          if (!tempRunning[user.userId]) {
            tempRunning[user.userId] = {};
          }
          tempRunning[user.userId][settings.tokenId._id] = await runBuyBot(
            settings
          );
        } catch (error) {
          console.error("Error: ", error);
        }
      }
      if (!settings) {
        if (user && user.tokensSet.includes(settingsId)) {
          const index = user.tokensSet.indexOf(settingsId);
          if (index !== -1) {
            user.tokensSet.splice(index, 1);
          }
        }
      }
    }
    await user.save();
  }
};
let ignoreStartCommand = false;

bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const token = match[1];
  const username = msg.from.username;

  try {
    const variables = token.split("-");
    const userIdFromToken = variables[0];
    const groupIdFromToken = "-" + variables[1];
    userId == userIdFromToken ? (ignoreStartCommand = true) : "";
    let tokensSet = 0;

    if (!tempUsers[userIdFromToken]) {
      const userDefaults = {
        userId: userIdFromToken,
        settings: defaultSettings(groupIdFromToken),
      };
      try {
        let user = await User.findOne({ userId });
        if (!user) {
          user = await User.create({
            userId,
            username,
          });
        }

        if (user.tokensSet.length > 0) {
          tokensSet = user.tokensSet.length;
        }
        user.messageId = msg.message_id;
        await user.save();
      } catch (error) {
        console.error("Error: ", error);
        bot.sendMessage(chatId, errorMessage);
      }
      tempUsers[userIdFromToken] = userDefaults;
    } else {
      try {
        let user = await User.findOne({ userId });
        if (user && user.tokensSet.length > 0) {
          tokensSet = user.tokensSet.length;
        }
      } catch (error) {
        console.error("Error: ", error);
      }
      tempUsers[userIdFromToken].settings = defaultSettings(groupIdFromToken);
    }
    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Add Token Address", callback_data: "Add Token Address" }],
          tokensSet > 0
            ? [
                {
                  text: "Check Token Settings",
                  callback_data: "Check Token Settings",
                },
              ]
            : [],
        ],
      },
      parse_mode: "HTML",
    };

    bot
      .sendMessage(
        chatId,
        "Hello! Please, let me know what are you wanting to do:",
        inlineKeyboard
      )
      .then((msg) => {
        tempUsers[userIdFromToken].messageId = msg.message_id;
      });
  } catch (error) {
    console.error(errorMessage, error.message);
    bot.sendMessage(chatId, "Invalid token or link.");
  }
});

bot.onText(/\/start/, async (msg) => {
  if (ignoreStartCommand) {
    ignoreStartCommand = false;
    return;
  }
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;

  try {
    let user = await User.findOne({ userId });

    if (!user) {
      user = await User.create({
        userId,
        username,
        tokensSet: [],
      });
    }

    user.messageId = msg.message_id;
    await user.save();
  } catch (error) {
    console.error("Error: ", error);
    bot.sendMessage(chatId, errorMessage);
  }

  try {
    const savedMessage = await Message.findOne({ type: "welcome" });

    if (savedMessage) {
      bot.sendMessage(chatId, savedMessage.text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } else {
      const unsavedMessage = "Contact with @MrAjaxDev for more info";
      bot.sendMessage(chatId, unsavedMessage);
    }
  } catch (error) {
    console.error("Error: ", error);
    bot.sendMessage(chatId, errorMessage);
  }
});

bot.onText(/\/advertise/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  try {
    const savedMessage = await Message.findOne({ type: "advertise" });

    if (savedMessage) {
      bot.sendMessage(chatId, savedMessage.text, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } else {
      const unsavedMessage = "Contact with @MrAjaxDev for more info";
      bot.sendMessage(chatId, unsavedMessage);
    }
  } catch (error) {
    console.error("Error: ", error);
    bot.sendMessage(chatId, errorMessage);
  }
});

// </ Group commands />
//  -----------------
bot.onText(/\/addToken/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const groupId = msg.chat.id;
  const status = await bot
    .getChatMember(msg.chat.id, msg.from.id)
    .then(function (data) {
      return data.status;
    });
  const isAdmin = status === "creator" || status === "administrator";
  if (msg.chat.type === "private") {
    return;
  }
  if (isAdmin) {
    try {
      const token = `${userId}${groupId}`;
      const botUsername = await bot.getMe().then((me) => me.username);
      const link = `https://t.me/${botUsername}?start=${token}`;

      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [[{ text: "Click me", url: link }]],
        },
      };

      bot.sendMessage(
        chatId,
        `Hey ${msg.from.first_name}, to set the token you must follow these steps:

1.- Click the link below.
2.- Click the "Start" button at the bottom of the screen.`,
        inlineKeyboard
      );
    } catch (error) {
      console.error("Error: ", error);
      bot.sendMessage(chatId, errorMessage);
    }
  }
});

// </ Admin commands />
//  -----------------

bot.onText(/\/admin/, async (msg) => {
  const chatId = msg.chat.id;
  tempUsers[chatId] = {};

  try {
    if (admin.includes(chatId)) {
      // const optionsRow1 = ["Set Messages", "Check Running Bots"];
      const optionsRow2 = ["ADS"];
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            // optionsRow1.map((option) => ({
            //   text: option,
            //   callback_data: option,
            // })),
            optionsRow2.map((option) => ({
              text: option,
              callback_data: option,
            })),
          ],
        },
      };

      bot
        .sendMessage(
          chatId,
          "Welcome to the admin panel. Select an option:",
          inlineKeyboard
        )
        .then((msg) => {
          tempUsers[chatId].messageId = msg.message_id;
        });
    }
  } catch (error) {
    console.error("Error: ", error);
    bot.sendMessage(chatId, errorMessage);
  }
});

// </ Callback queries />
//  --------------------

bot.on("callback_query", async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message.chat.id;
  const { data } = callbackQuery;

  if (data === "Add Token Address") {
    if (!tempUsers[userId]) {
      bot.sendMessage(chatId, "You must use the /AddToken command first");
      return;
    }
    const messageId = tempUsers[userId]?.messageId;
    try {
      const settings = await User.findOne({ userId: userId }).select(
        "tokensSet"
      );
      if (messageId) {
        if (settings.tokensSet && settings.tokensSet.length >= 3) {
          await bot.editMessageText(maxTokensReachedMessage, {
            chat_id: chatId,
            message_id: messageId,
          });
        } else {
          await requestTokenAddress(tempUsers, bot, chatId, messageId, userId);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      } else {
        await bot.sendMessage(chatId, errorMessage);
      }
    }
  } else if (data === "Check Token Settings") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      const user = await User.findOne({ userId: userId });
      if (user) {
        const settingsIds = user.tokensSet;
        const settingsPromises = settingsIds.map(async (settingsId) => {
          try {
            const settings = await Settings.findOne({
              _id: settingsId,
            }).populate("tokenId");
            return settings;
          } catch (error) {
            console.error("Error fetching settings:", error);
            return null;
          }
        });

        const resolvedSettings = await Promise.all(settingsPromises);

        const validSettings = resolvedSettings.filter(
          (settings) => settings !== null
        );

        if (validSettings.length > 0) {
          const buttons = validSettings.map((settings) => ({
            text: settings.tokenId.symbol,
            callback_data: `ShowTokenSettings:${settings._id}`,
          }));

          const keyboard = {
            inline_keyboard: [buttons],
          };

          await bot.editMessageText("Select a token to view settings:", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          });
        } else {
          await bot.editMessageText("No token settings found", {
            chat_id: chatId,
            message_id: messageId,
          });
        }
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  } else if (await verifyTokenAddress(data)) {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        await bot.editMessageText(`Wait a minute, retrieving data...`, {
          chat_id: chatId,
          message_id: messageId,
        });
        const pairAddress = data;
        tempUsers[userId].settings.pairId = pairAddress;
        let token;
        const { totalSupply, name, symbol, decimals, holders } =
          await getTokenDetails(tempUsers[userId].settings.tokenAddress, data);
        try {
          token = await Token.create({
            address: tempUsers[userId].settings.tokenAddress,
            pair: tempUsers[userId].settings.pairId,
            name: name,
            symbol: symbol,
            decimals: decimals,
            totalSupply: Number(totalSupply),
            holders: holders,
          });
          const tokenDB = await token.save();
          tempUsers[userId].settings.tokenId = tokenDB;
        } catch (error) {
          console.error("Error: ", error);
        }

        sendSettingsKeyboard(
          bot,
          chatId,
          messageId,
          tempUsers[userId].settings
        );
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Min Buy") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { number, msg } = await requestSettingNumber(
          bot,
          chatId,
          messageId
        );
        if (number) {
          const settings = tempUsers[userId].settings;
          settings.minBuy = number;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Step") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { number, msg } = await requestSettingNumber(
          bot,
          chatId,
          messageId
        );
        if (number) {
          const settings = tempUsers[userId].settings;
          settings.step = number;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Emoji") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        await bot.editMessageText(`Set Emoji`, {
          chat_id: chatId,
          message_id: messageId,
        });
        const response = await new Promise((resolve) => {
          bot.once("text", (msg) => {
            deleteMessage(bot, chatId, msg);
            resolve(msg.text);
          });
        });
        if (response) {
          const settings = tempUsers[userId].settings;
          settings.emoji = response;
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Charts") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        await bot.editMessageText(`Set Charts`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Geckoterminal",
                  callback_data: "Geckoterminal",
                },
                {
                  text: "Dextools",
                  callback_data: "Dextools",
                },
              ],
              [
                {
                  text: "Dexscreener",
                  callback_data: "Dexscreener",
                },
                {
                  text: "Coinscan",
                  callback_data: "Coinscan",
                },
              ],
            ],
          },
        });
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Paused") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { response, msg } = await requestSettingBoolean(
          bot,
          chatId,
          messageId
        );
        if (response || response === false) {
          const settings = tempUsers[userId].settings;
          settings.paused = response;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Media") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { response, msg } = await requestSettingBoolean(
          bot,
          chatId,
          messageId
        );
        if (response) {
          const settings = tempUsers[userId].settings;
          settings.mediaEnabled = response;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Media Image") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { response, msg } = await requestImage(bot, chatId, messageId);
        if (response) {
          const settings = tempUsers[userId].settings;
          settings.mediaImage = response;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data === "Set Media Threshold") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { number, msg } = await requestSettingNumber(
          bot,
          chatId,
          messageId
        );
        if (number) {
          const settings = tempUsers[userId].settings;
          settings.mediaThreshold = number;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  } else if (data === "Set Telegram Link") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const prompt = "Set Telegram Link";
        const { text, msg } = await requestSettingText(
          bot,
          chatId,
          messageId,
          prompt
        );
        if (text) {
          const settings = tempUsers[userId].settings;
          settings.socialLinks.Telegram = text;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.sendMessage(chatId, errorMessage);
      }
    }
  } else if (data === "Set Website Link") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const prompt = "Set Website Link";
        const { text, msg } = await requestSettingText(
          bot,
          chatId,
          messageId,
          prompt
        );
        if (text) {
          const settings = tempUsers[userId].settings;
          settings.socialLinks.Website = text;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  } else if (data === "Set Twitter Link") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const prompt = "Set Twitter Link";
        const { text, msg } = await requestSettingText(
          bot,
          chatId,
          messageId,
          prompt
        );
        if (text) {
          const settings = tempUsers[userId].settings;
          settings.socialLinks.Twitter = text;
          deleteMessage(bot, chatId, msg);
          sendSettingsKeyboard(bot, chatId, messageId, settings);
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Geckoterminal") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const settings = tempUsers[userId].settings;
        settings.charts = "Geckoterminal";
        sendSettingsKeyboard(bot, chatId, messageId, settings);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Dextools") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const settings = tempUsers[userId].settings;
        settings.charts = "Dextools";
        sendSettingsKeyboard(bot, chatId, messageId, settings);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Dexscreener") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const settings = tempUsers[userId].settings;
        settings.charts = "Dexscreener";
        sendSettingsKeyboard(bot, chatId, messageId, settings);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Coinscan") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const settings = tempUsers[userId].settings;
        settings.charts = "Coinscan";
        sendSettingsKeyboard(bot, chatId, messageId, settings);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Save Settings") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        try {
          const set = await Settings.create(tempUsers[userId].settings);
          const user = await User.findOne({ userId: userId });
          if (user && !user.tokensSet.includes(set._id)) {
            user.tokensSet.push(set._id);
          }
          if (!tempRunning[user.userId]) {
            tempRunning[user.userId] = {};
          }
          tempUsers[userId].settings._id = set._id;
          tempRunning[userId][set.tokenId._id] = await runBuyBot(
            tempUsers[userId].settings
          );
          await user.save();
          await bot.editMessageText(`Bot running`, {
            chat_id: chatId,
            message_id: messageId,
          });
        } catch (error) {
          console.error("Error: ", error);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
    }
  } else if (data === "Cancel") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        await bot.editMessageText(`Canceled`, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "Delete") {
    const messageId = tempUsers[userId]?.messageId;
    try {
      const settings = tempUsers[userId].settings;
      if (settings._id) {
        await tempRunning[userId][settings.tokenId._id]();
        await Settings.findByIdAndDelete(settings._id);
        const user = await User.findOne({ userId: userId });
        if (user && user.tokensSet.includes(settings._id)) {
          const index = user.tokensSet.indexOf(settings._id);
          if (index !== -1) {
            user.tokensSet.splice(index, 1);
          }
          await user.save();
        }
        if (messageId) {
          await bot.editMessageText(`Deleted`, {
            chat_id: chatId,
            message_id: messageId,
          });
        }
      } else {
        if (messageId) {
          await bot.editMessageText(`Cannot delete token not saved yet.`, {
            chat_id: chatId,
            message_id: messageId,
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (data === "ADS") {
    const ads = await Ad.find();
    let buttons = [];
    const newAdButton = [
      {
        text: "➕ Add new",
        callback_data: "AD_NEW",
      },
    ];

    if (ads) {
      ads.forEach((ad) => {
        const adButtons = [
          {
            text: ad.tokenName,
            callback_data: `AD_EDIT:${ad._id}`,
          },
          {
            text: "❌",
            callback_data: `AD_DELETE:${ad._id}`,
          },
        ];
        buttons.push(adButtons);
      });

      buttons.push(newAdButton);

      const keyboard = {
        inline_keyboard: buttons,
      };

      try {
        const messageId = tempUsers[userId]?.messageId;
        if (messageId) {
          await bot.editMessageText(`ADS`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          });
        }
      } catch (error) {
        console.error("Error:", error);
      }
    } else {
      try {
        const messageId = tempUsers[userId]?.messageId;
        buttons.push(newAdButton);
        if (messageId) {
          const keyboard = {
            inline_keyboard: buttons,
          };
          await bot.editMessageText(`No ads found`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard,
          });
        }
      } catch (error) {
        console.error("Error:", error);
      }
    }
  } else if (data.startsWith("AD_EDIT:")) {
    const adId = data.split(":")[1];

    const ad = await Ad.findById(adId);

    if (ad) {
      await handleEditAd(ad, adId, userId, chatId);
    }
  } else if (data.startsWith("AD_DELETE:")) {
    const messageId = tempUsers[userId]?.messageId;

    if (messageId) {
      await bot.editMessageText(`Deleting AD`, {
        chat_id: chatId,
        message_id: messageId,
      });
    }

    const adId = data.split(":")[1];
    const deletedAd = await Ad.findByIdAndDelete(adId);

    if (deletedAd) {
      const ads = await Ad.find();
      let buttons = [];
      const newAdButton = [
        {
          text: "➕ Add new",
          callback_data: "AD_NEW",
        },
      ];
      if (ads) {
        ads.forEach((ad) => {
          const adButtons = [
            {
              text: ad.tokenName,
              callback_data: `AD_EDIT:${ad._id}`,
            },
            {
              text: "❌",
              callback_data: `AD_DELETE:${ad._id}`,
            },
          ];
          buttons.push(adButtons);
        });
        buttons.push(newAdButton);
        const keyboard = {
          inline_keyboard: buttons,
        };

        try {
          const messageId = tempUsers[userId]?.messageId;
          if (messageId) {
            await bot.editMessageText(`ADS`, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: keyboard,
            });
          }
        } catch (error) {
          console.error("Error:", error);
        }
      } else {
        buttons.push(newAdButton);
        const keyboard = {
          inline_keyboard: buttons,
        };

        try {
          const messageId = tempUsers[userId]?.messageId;
          if (messageId) {
            await bot.editMessageText(`ADS`, {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: keyboard,
            });
          }
        } catch (error) {
          console.error("Error:", error);
        }
      }
    }
  } else if (data.startsWith("EDIT_START_TIME:")) {
    const adId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { date, msg } = await requestSettingDate(bot, chatId, messageId);
        if (date) {
          const ad = await Ad.findById(adId);
          if (ad) {
            ad.startTime = date;
            await ad.save();
            await deleteMessage(bot, chatId, msg);
            await handleEditAd(ad, adId, userId, chatId);
          }
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data.startsWith("EDIT_END_TIME:")) {
    const adId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { date, msg } = await requestSettingDate(bot, chatId, messageId);
        if (date) {
          const ad = await Ad.findById(adId);
          if (ad) {
            ad.endTime = date;
            await ad.save();
            await deleteMessage(bot, chatId, msg);
            await handleEditAd(ad, adId, userId, chatId);
          }
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data.startsWith("TOGGLE_PAUSE:")) {
    const adId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const ad = await Ad.findById(adId);
        if (ad) {
          ad.isActive = !ad.isActive;
          await ad.save();
          await handleEditAd(ad, adId, userId, chatId);
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data.startsWith("EDIT_TOKEN_NAME:")) {
    const adId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { text, msg } = await requestSettingText(
          bot,
          chatId,
          messageId,
          "Enter the new token name:"
        );
        if (text) {
          const ad = await Ad.findById(adId);
          if (ad) {
            ad.tokenName = text;
            await ad.save();
            await deleteMessage(bot, chatId, msg);
            await handleEditAd(ad, adId, userId, chatId);
          }
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data.startsWith("EDIT_TEXT:")) {
    const adId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      if (messageId) {
        const { text, msg } = await requestSettingText(
          bot,
          chatId,
          messageId,
          "Enter the new text:"
        );
        if (text) {
          const ad = await Ad.findById(adId);
          if (ad) {
            ad.text = text;
            await ad.save();
            await deleteMessage(bot, chatId, msg);
            await handleEditAd(ad, adId, userId, chatId);
          }
        }
      }
    } catch (error) {
      console.error("Error: ", error);
      if (messageId) {
        await bot.editMessageText(errorMessage, {
          chat_id: chatId,
          message_id: messageId,
        });
      }
    }
  } else if (data.startsWith("ShowTokenSettings:")) {
    const settingsId = data.split(":")[1];
    const messageId = tempUsers[userId]?.messageId;
    try {
      const settings = await Settings.findOne({
        _id: settingsId,
      }).populate("tokenId");
      if (settings) {
        tempUsers[userId].settings = settings;
        sendSettingsKeyboard(bot, chatId, messageId, settings);
      }
    } catch (error) {
      bot.editMessageText("Token settings not found", {
        chat_id: chatId,
        message_id: messageId,
      });
    }
  } else if (data === "AD_NEW") {
    if (admin.includes(chatId)) {
      const defaultStartTime = Date.now();
      const defaultEndTime = Date.now() + 1000 * 60 * 60 * 24;
      const newAd = new Ad({
        startTime: defaultStartTime,
        endTime: defaultEndTime,
      });
      await newAd.save();
      const adId = newAd._id.toString();
      const ad = await Ad.findById(adId);

      if (ad) {
        await handleEditAd(ad, adId, userId, chatId);
      }
    }
  }
});

// Helper functions

const handleEditAd = async (ad, adId, userId, chatId) => {
  let actionButton;
  if (ad.endTime < Date.now()) {
    actionButton = "Finished";
  } else {
    actionButton = ad.isActive ? "Pause" : "Resume";
  }

  const editMessage = `Editing ad: ${ad.tokenName}\n\nActual text: ${
    ad.text
  }\nStart Time: ${ad.startTime.toLocaleString("en-GB", {
    timeZone: "UTC",
  })}\nEnd Time: ${ad.endTime.toLocaleString("en-GB", {
    timeZone: "UTC",
  })}\nRunning: ${ad.isActive ? "YES" : "NO"}`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Edit TokenName",
          callback_data: `EDIT_TOKEN_NAME:${adId}`,
        },
      ],
      [{ text: "Edit Text", callback_data: `EDIT_TEXT:${adId}` }],
      [
        {
          text: "Edit StartTime",
          callback_data: `EDIT_START_TIME:${adId}`,
        },
      ],
      [
        {
          text: "Edit EndTime",
          callback_data: `EDIT_END_TIME:${adId}`,
        },
      ],
      [
        {
          text: actionButton,
          callback_data: ad.endTime < Date.now() ? "" : `TOGGLE_PAUSE:${adId}`,
        },
      ],
      [
        {
          text: "Exit",
          callback_data: "EXIT",
        },
      ],
    ],
  };

  try {
    const messageId = tempUsers[userId]?.messageId;
    if (messageId) {
      await bot.editMessageText(editMessage, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

const shortenWalletAddress = (walletAddress) => {
  const prefixLength = 2;
  const suffixLength = 8;

  const prefix = walletAddress.slice(0, prefixLength);
  const suffix = walletAddress.slice(-suffixLength);

  const shortenedAddress = `${prefix}...${suffix}`;

  return shortenedAddress;
};

const parsePrice = (price) => {
  return parseFloat(price).toFixed(15);
};

const parseMarketCap = (marketCap) => {
  const units = ["", "K", "M", "B", "T"];
  let i = 0;
  while (marketCap >= 1000 && i < units.length) {
    marketCap /= 1000;
    i++;
  }
  const decimals = Math.max(5 - Math.floor(marketCap).toString().length, 0);
  const result = `${parseFloat(marketCap.toFixed(decimals)).toString()}${
    units[i]
  }`;
  return result;
};

async function randomAd() {
  try {
    const now = Date.now();
    const activeAds = await Ad.find({
      isActive: true,
      startTime: { $lte: now },
      endTime: { $gte: now },
    });

    if (activeAds.length === 0) {
      return "";
    }

    const randomIndex = Math.floor(Math.random() * activeAds.length);
    const selectedAd = activeAds[randomIndex];

    const adText = `\n◻️ <b>Ad:</b> ${selectedAd.text}\n`;

    return adText;
  } catch (error) {
    console.error("Error:", error);
    return "";
  }
}

// Buy bot
const definedWs = new DefinedRealtimeClient(process.env.MY_DEFINED_API_KEY);

const gql = (pair) => `
  subscription CreateEvents($id: String = "${pair}:1") {
    onCreateEvents(id: $id) {
      events {
        eventDisplayType
        maker
        transactionHash
        data {
          ... on SwapEventData {
            amount0Out
            amount1Out
            priceBaseTokenTotal
            priceUsdTotal
          }
        }
      }
    }
  }
`;

const sanitizeText = (text) => {
  return sanitizeHtml(text, {
    allowedTags: ["b", "i", "a"],
    allowedAttributes: { a: ["href"] },
  });
};

// Function to handle successful data retrieval
async function handleData(data, settings) {
  const { onCreateEvents } = data;
  const { events } = onCreateEvents;
  const { tokenId: token } = settings;
  const { socialLinks } = settings;
  const { Telegram, Twitter, Website } = socialLinks;
  const { name, symbol, decimals, address, pair } = token;
  const socialLinksText = `${
    Website ? `<a href="${Website}"><b>Website</b></a>  ` : ""
  }${Telegram ? `<a href="${Telegram}"><b>Telegram</b></a>  ` : ""}${
    Twitter ? `<a href="${Twitter}"><b>Twitter</b></a>` : ""
  }`;
  const {
    groupId,
    minBuy,
    step,
    emoji,
    charts,
    mediaEnabled,
    mediaImage,
    mediaThreshold,
  } = settings;
  events.forEach(async (event) => {
    const { maker, transactionHash } = event;
    const { priceBaseTokenTotal, priceUsdTotal } = event.data;
    const priceUsd = parseFloat(priceUsdTotal).toFixed(2);
    const numberOfEmojis = Math.floor(priceUsdTotal / step);
    if (event.eventDisplayType == "Buy" && event.data.priceUsdTotal >= minBuy) {
      const holders = await getHolders(address, pair);
      const { isNew, tokenBalance } = await checkHolder(
        maker,
        address,
        decimals
      );
      const { price, marketCap } = await getPairInfo(pair);
      const textMessage = `${name} <b>BUY ALERT!</b>
${
  numberOfEmojis >= 1 && numberOfEmojis <= 100
    ? emoji.repeat(numberOfEmojis)
    : numberOfEmojis > 100
    ? emoji.repeat(100)
    : emoji
}
💶 <b>Bought:</b> $${priceUsd} (${priceBaseTokenTotal}ETH)
🪙 <b>Got:</b> ${tokenBalance} ${symbol} ${
        tokenBalance === 0 ? "<--- MEV Bot" : ""
      }
🔲 <b>Buyer:</b> <a href="https://etherscan.io/address/${maker}"> ${shortenWalletAddress(
        maker
      )}</a> | <a href="https://etherscan.io/tx/${transactionHash}">Txn</a>
🔄 <b>Holder Count:</b> ${holders}
${isNew ? "✅ <b>New Holder!</b>\n" : ""}
📈 <b>Price:</b> $${parsePrice(price)}
📊 <b>MarketCap:</b> ${parseMarketCap(marketCap)}
${await randomAd()}
${socialLinksText ? `${socialLinksText}\n` : ""}<a href="${
        chartAddress[charts]
      }${pair}"><b>Chart</b></a> | <a href="https://app.uniswap.org/#/tokens/ethereum/${address}"><b>UniSwap</b></a> | <a href="https://t.me/ares_trading_bot"><b>Ares Bot</b></a>`;

      const sanitizedText = sanitizeText(textMessage);

      const shouldSendImage = mediaEnabled && priceUsd >= mediaThreshold;
      if (shouldSendImage) {
        const imagePath = mediaImage;
        try {
          await bot.sendPhoto(groupId, imagePath, {
            caption: sanitizedText,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
        } catch (error) {
          if (error.response && error.response.body.error_code == 403) {
            try {
              const userDb = await User.findOne({ tokensSet: settings._id });
              if (userDb && userDb.tokensSet.includes(settings._id)) {
                const index = userDb.tokensSet.indexOf(settings._id);
                if (index !== -1) {
                  userDb.tokensSet.splice(index, 1);
                }
              }
              try {
                await Settings.findByIdAndDelete(settings._id);
              } catch {
                console.log("error deleting settings from DB");
              }
              await tempRunning[userDb.userId][settings.tokenId._id]();
              userDb.save();
            } catch (error) {
              console.error("Error deleting tokensSet from User");
            }
          }
          console.error(
            "Error sending photo:",
            error.response.body.description
          );
        }
      } else {
        try {
          await bot.sendMessage(groupId, sanitizedText, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
        } catch (error) {
          if (error.response && error.response.body.error_code == 403) {
            try {
              const userDb = await User.findOne({ tokensSet: settings._id });
              if (userDb && userDb.tokensSet.includes(settings._id)) {
                const index = userDb.tokensSet.indexOf(settings._id);
                if (index !== -1) {
                  userDb.tokensSet.splice(index, 1);
                }
              }
              try {
                await Settings.findByIdAndDelete(settings._id);
              } catch {
                console.log("error deleting settings from DB");
              }
              await tempRunning[userDb.userId][settings.tokenId._id]();
              userDb.save();
            } catch (error) {
              console.error("Error deleting tokensSet from User");
            }
          }
          console.error(
            "Error sending message:",
            error.response.body.description
          );
        }
      }
    }
  });
}

const runBuyBot = async (settings) => {
  const customGql = gql(settings.tokenId.pair);
  const unsubscribe = await definedWs.subscribe(customGql, {
    async next(data) {
      handleData(data, settings);
    },
    error(err) {
      console.log(`Error: ${err.message}`);
    },
    complete() {
      console.log("Subscription complete.");
    },
  });

  return unsubscribe;
};

restartBuyBots();
