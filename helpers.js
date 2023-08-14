import { getPairAddress } from "./fetch.js";

export async function requestTokenAddress(
  tempUsers,
  bot,
  chatId,
  messageId,
  userId,
  maxAttempts = 5,
  maxWaitTime = 10 * 60 * 1000
) {
  await bot.editMessageText("Please, enter the token address:", {
    chat_id: chatId,
    message_id: messageId,
  });

  let attempts = 0;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout: Maximum wait time exceeded."));
    }, maxWaitTime);
  });

  while (attempts < maxAttempts) {
    try {
      const msg = await Promise.race([
        new Promise((resolve) => bot.once("message", resolve)),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const isValid = await verifyTokenAddress(msg.text);
      if (isValid) {
        const tokenAddress = msg.text;
        tempUsers[userId].settings.tokenAddress = tokenAddress;
        await bot.editMessageText(
          `Token address set to:\n${tokenAddress}\n\nLet me check LP pairs....`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
        deleteMessage(bot, chatId, msg);
        const isToken = await fetchPairs(bot, tokenAddress, chatId, messageId);
        if (isToken === "NAT") {
          await bot.editMessageText(
            `Address is not a token, please try again.`,
            {
              chat_id: chatId,
              message_id: messageId,
            }
          );
          await requestTokenAddress(chatId, messageId, userId);
          return;
        }
        return;
      } else {
        deleteMessage(bot, chatId, msg);
        attempts++;
        await bot.editMessageText(
          `Invalid address, please try again.${
            attempts > 0 ? `${attempts}/5` : ""
          }`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Max attempts reached. Unable to get a valid token address.");
}

export async function requestSettingNumber(
  bot,
  chatId,
  messageId,
  maxAttempts = 5,
  maxWaitTime = 10 * 60 * 1000
) {
  await bot.editMessageText("Please, enter a number to set:", {
    chat_id: chatId,
    message_id: messageId,
  });

  let attempts = 0;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout: Maximum wait time exceeded."));
    }, maxWaitTime);
  });

  while (attempts < maxAttempts) {
    try {
      const msg = await Promise.race([
        new Promise((resolve) => bot.once("message", resolve)),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const isValid = !isNaN(parseInt(msg.text, 10));
      if (isValid) {
        const number = msg.text;
        return { number, msg };
      } else {
        deleteMessage(bot, chatId, msg);
        attempts++;
        await bot.editMessageText(
          `Not a number, please try again.${
            attempts > 0 ? `${attempts}/5` : ""
          }`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Max attempts reached. Unable to get a valid token address.");
}

function validateAndFormatDate(inputDate) {
  const dateFormatRegex =
    /^(\d{2})[\/](\d{2})[\/](\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

  if (!dateFormatRegex.test(inputDate)) {
    return null;
  }

  const [, day, month, year, hours, minutes, seconds] =
    inputDate.match(dateFormatRegex);
  const formattedDate = new Date(year, month - 1, day, hours, minutes, seconds);

  if (isNaN(formattedDate.getTime())) {
    return null;
  }

  return formattedDate;
}

export async function requestSettingDate(
  bot,
  chatId,
  messageId,
  maxAttempts = 5,
  maxWaitTime = 10 * 60 * 1000
) {
  await bot.editMessageText(
    "Please enter the new date in the format -> DD/MM/AAAA HH:mm:ss",
    {
      chat_id: chatId,
      message_id: messageId,
    }
  );

  let attempts = 0;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout: Maximum wait time exceeded."));
    }, maxWaitTime);
  });

  while (attempts < maxAttempts) {
    try {
      const msg = await Promise.race([
        new Promise((resolve) => bot.once("message", resolve)),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const isValidDate = validateAndFormatDate(msg.text);
      if (isValidDate) {
        return { date: isValidDate, msg };
      } else {
        deleteMessage(bot, chatId, msg);
        attempts++;
        await bot.editMessageText(
          `Invalid date, please try again.${
            attempts > 0 ? ` Attempt ${attempts}/5` : ""
          }`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Max attempts reached. Unable to get a valid Date.");
}

export async function requestSettingText(
  bot,
  chatId,
  messageId,
  promptText,
  maxAttempts = 5,
  maxWaitTime = 10 * 60 * 1000
) {
  await bot.editMessageText(promptText, {
    chat_id: chatId,
    message_id: messageId,
  });

  let attempts = 0;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout: Maximum wait time exceeded."));
    }, maxWaitTime);
  });

  while (attempts < maxAttempts) {
    try {
      const msg = await Promise.race([
        new Promise((resolve) => bot.once("message", resolve)),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const text = msg.text;
      if (text) {
        return { text, msg };
      } else {
        attempts++;
        await bot.editMessageText(
          `Text input is required.${
            attempts > 0 ? ` Attempt ${attempts}/${maxAttempts}` : ""
          }`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Max attempts reached. Unable to get valid text input.");
}

export async function requestImage(bot, chatId, messageId) {
  try {
    await bot.editMessageText("Please, send me an image:", {
      chat_id: chatId,
      message_id: messageId,
    });

    const msg = await new Promise((resolve) => {
      bot.once("photo", resolve);
    });
    const response = msg.photo[msg.photo.length - 1].file_id;
    return { response, msg };
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export async function requestSettingBoolean(
  bot,
  chatId,
  messageId,
  maxAttempts = 5,
  maxWaitTime = 10 * 60 * 1000
) {
  await bot.editMessageText("Please, enter yes or no:", {
    chat_id: chatId,
    message_id: messageId,
  });

  let attempts = 0;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timeout: Maximum wait time exceeded."));
    }, maxWaitTime);
  });

  while (attempts < maxAttempts) {
    try {
      const msg = await Promise.race([
        new Promise((resolve) => bot.once("message", resolve)),
        timeoutPromise,
      ]);

      clearTimeout(timeoutId);

      const isValid = msg.text === "yes" || msg.text === "no";
      if (isValid) {
        let response = false;
        if (msg.text === "yes") {
          response = true;
        }
        return { response, msg };
      } else {
        deleteMessage(bot, chatId, msg);
        attempts++;
        await bot.editMessageText(
          `Not an option, please try again.${
            attempts > 0 ? `${attempts}/5` : ""
          }`,
          {
            chat_id: chatId,
            message_id: messageId,
          }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  throw new Error("Max attempts reached. Unable to get a valid token address.");
}

// Función para verificar si la dirección del token es válida
export async function verifyTokenAddress(msg) {
  const tokenAddress = msg;
  const tokenAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return tokenAddressRegex.test(tokenAddress);
}

// Función para eliminar un mensaje
export async function deleteMessage(bot, chatId, msg) {
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Función para enviar el teclado de configuración
export const sendSettingsKeyboard = async (
  bot,
  chatId,
  messageId,
  settings
) => {
  const {
    minBuy,
    step,
    emoji,
    charts,
    paused,
    mediaEnabled,
    mediaThreshold,
    mediaImage,
    socialLinks,
  } = settings;
  const { Telegram, Website, Twitter } = socialLinks;
  const inlineKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `Set Min Buy --|-- ${minBuy}`,
            callback_data: `Set Min Buy`,
          },
        ],
        [
          {
            text: `Set Step --|-- ${step}`,
            callback_data: `Set Step`,
          },
        ],
        [
          {
            text: `Set Emoji --|-- ${emoji}`,
            callback_data: `Set Emoji`,
          },
        ],
        [
          {
            text: `Set Charts --|-- ${charts}`,
            callback_data: `Set Charts`,
          },
        ],
        [
          {
            text: `Set Paused --|-- ${paused}`,
            callback_data: `Set Paused`,
          },
        ],
        [
          {
            text: `Set Media Enabled --|-- ${mediaEnabled}`,
            callback_data: `Set Media`,
          },
        ],
        [
          {
            text: `Set Media Threshold --|-- ${mediaThreshold}`,
            callback_data: `Set Media Threshold`,
          },
        ],
        [
          {
            text: `Set Media Image --|-- ${mediaImage}`,
            callback_data: `Set Media Image`,
          },
        ],
        [
          {
            text: `Set Telegram Link --|-- ${Telegram}`,
            callback_data: `Set Telegram Link`,
          },
        ],
        [
          {
            text: `Set Website Link --|-- ${Website}`,
            callback_data: `Set Website Link`,
          },
        ],
        [
          {
            text: `Set Twitter Link --|-- ${Twitter}`,
            callback_data: `Set Twitter Link`,
          },
        ],
        [
          {
            text: `Save Settings`,
            callback_data: `Save Settings`,
          },
        ],
        [
          {
            text: `Cancel`,
            callback_data: "Cancel",
          },
        ],
        [
          {
            text: `Delete`,
            callback_data: "Delete",
          }
        ]
      ],
    },
  };
  bot.editMessageText("Set options", {
    chat_id: chatId,
    message_id: messageId,
    ...inlineKeyboard,
  });
};

// Función para obtener los pares de LP
async function fetchPairs(bot, tokenAddress, chatId, messageId) {
  let pairs;
  try {
    const fetchPairs = await getPairAddress(tokenAddress);
    if (fetchPairs === "No pairs found") {
      return "NAT";
    }
    pairs = fetchPairs.map((pair) => {
      return {
        pair: `${pair.symbol}/${pair.symbolRef}`,
        pairAddress: pair.id.pair,
      };
    });
  } catch (error) {
    console.error("Error: ", error);
  }
  if (pairs.length !== 0) {
    await bot.editMessageText(`Choose one Pair to set:`, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          pairs.map((pair) => ({
            text: pair.pair,
            callback_data: pair.pairAddress,
          })),
        ],
      },
    });
  } else {
    await bot.editMessageText(`No pairs found, please try again later.`, {
      chat_id: chatId,
      message_id: messageId,
    });
  }
}
