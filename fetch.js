import Web3 from "web3";
import { simpleBep20 } from "./simple-bep20.js";
import cheerio from "cheerio";
const web3 = new Web3("https://eth.llamarpc.com");
const PAIR_ENDPOINT = "https://www.dextools.io/shared/search/pair?query=";

export const getPairAddress = (tokenAddress) => {
  return fetch(`${PAIR_ENDPOINT}${tokenAddress}`).then((response) =>
    response.json().then((data) => {
      if (data?.results[0] === undefined) return "No pairs found";
      return data.results;
    })
  );
};

export const getHolders = (address) => {
  const url = `https://etherscan.io/token/${address}`;

  return fetch(url)
    .then((response) => response.text())
    .then((html) => {
      const $ = cheerio.load(html);
      const holdersDiv = $("#ContentPlaceHolder1_tr_tokenHolders");
      const holdersValue = holdersDiv
        .find("div.d-flex div")
        .first()
        .text()
        .trim()
        .replace(",", "");
      const temp = holdersValue.split(" ");
      return Number(temp[0]);
    })
    .catch((error) => {
      console.error("Error al obtener la página:", error);
    });
};

export const getTokenDetails = async (tokenAddress) => {
  const tokenABI = simpleBep20; // Reemplaza con la ABI del contrato del token
  const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
  try {
    const totalSupply = Number(
      await tokenContract.methods.totalSupply().call()
    );
    const name = await tokenContract.methods.name().call();
    const symbol = await tokenContract.methods.symbol().call();
    const decimals = Number(await tokenContract.methods.decimals().call());
    const holders = await getHolders(tokenAddress);
    return { totalSupply, name, symbol, decimals, holders };
  } catch (error) {
    console.error("Error:", error);
  }
};

export const checkHolder = async (buyer, tokenAddress, decimals) => {
  const tokenABI = simpleBep20; // Reemplaza con la ABI del contrato del token
  const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
  let isNew = false;
  let percentage = 0;
  let tokenBalance = 0;
  try {
    // Obtén el número de bloque de la última transacción
    const blockNumber = await web3.eth.getBlockNumber();
    const balance = await tokenContract.methods.balanceOf(buyer).call();
    tokenBalance = Number(balance) / 10 ** decimals;
    // Consulta el saldo de tokens en la dirección de la billetera en el bloque anterior
    const balanceBeforeLastTx = await tokenContract.methods
      .balanceOf(buyer)
      .call({}, Number(blockNumber) - 1);
    if (balanceBeforeLastTx == 0) {
      isNew = true;
    } else {
      percentage =
        ((Number(balance) - Number(balanceBeforeLastTx)) /
          Number(balanceBeforeLastTx)) *
        100;
    }
    console.log(isNew, tokenBalance, percentage)
    return { isNew, tokenBalance, percentage };
  } catch (error) {
    console.error("Error al verificar el saldo de tokens:", error);
  }
};

export const getPairInfo = async (pair) => {
  const response = await fetch(
    `https://www.dextools.io/shared/data/pair?address=${pair}&chain=ether`,
    {
      headers: {
        Referer: "MrAjaxDev",
      },
    }
  );
  const data = await response.json();
  const tokenData = data?.data[0];
  const { token } = tokenData;
  const { metrics } = token;
  const { fdv: marketCap } = metrics;
  const { price } = tokenData;
  return {
    marketCap,
    price,
  };
};
