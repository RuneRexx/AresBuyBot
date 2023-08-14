import cheerio from "cheerio";
const getHolders = async (address) => {
  const url = `https://etherscan.io/token/generic-tokenholders2?m=light&a=${address}`;

  return fetch(url)
    .then((response) => response.text())
    .then((html) => {
      const $ = cheerio.load(html);
      const paragraph = $("p.mb-0:has(i#spinwheel)");

      if (paragraph.length > 0) {
        const span = paragraph.find("span");

        if (span.length > 0) {
          const spanText = span.text();
          const noComma = spanText.replace(/,/g, "");
          const numberOnly = noComma.match(/\d+/);
          if (numberOnly) {
            return numberOnly[0]
          }
        } else {
          const paragraphText = paragraph.text();
          const noComma = paragraphText.replace(/,/g, "");
          const numberOnly = noComma.match(/\d+/);
          if (numberOnly) {
            return numberOnly[0]
          }
        }
      } else {
        console.log("Elemento <p> no encontrado.");
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
};

console.log(await getHolders("0x3e34eabf5858a126cb583107e643080cee20ca64"))