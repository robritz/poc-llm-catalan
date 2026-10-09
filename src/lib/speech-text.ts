// Turns a chat reply into text the TTS model can read. Matxa-TTS v2 reads
// graphemes: it accepts only Catalan letters and a little punctuation, so
// numbers and symbols must be written out in words and everything else
// removed. See `symbols.py` on the v2-graphemes branch of
// github.com/langtech-bsc/Matcha-TTS.

// What the model accepts. Its apostrophe is ’, never '.
const UNSPEAKABLE = /[^A-Za-zàáèéìíòóùúüïöñçÀÁÈÉÌÍÒÓÙÚÜÏÖÑÇ·’;:,.!?¡¿—…"«»“”()\- ]/gu;

const UNITS = [
  "zero", "un", "dos", "tres", "quatre", "cinc", "sis", "set", "vuit", "nou",
  "deu", "onze", "dotze", "tretze", "catorze", "quinze", "setze", "disset", "divuit", "dinou",
];
const TENS = ["", "", "vint", "trenta", "quaranta", "cinquanta", "seixanta", "setanta", "vuitanta", "noranta"];

// 1 to 999.
function belowThousand(n: number): string {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) words.push(hundreds === 1 ? "cent" : `${UNITS[hundreds]}-cents`);
  if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const units = rest % 10;
    if (!units) words.push(TENS[tens]);
    else words.push(tens === 2 ? `vint-i-${UNITS[units]}` : `${TENS[tens]}-${UNITS[units]}`);
  } else if (rest) {
    words.push(UNITS[rest]);
  }
  return words.join(" ");
}

// 0 to 999,999,999,999.
function cardinal(n: number): string {
  if (n === 0) return UNITS[0];
  const words: string[] = [];
  const millions = Math.floor(n / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  if (millions) words.push(millions === 1 ? "un milió" : `${cardinal(millions)} milions`);
  if (thousands) words.push(thousands === 1 ? "mil" : `${belowThousand(thousands)} mil`);
  if (rest) words.push(belowThousand(rest));
  return words.join(" ");
}

// A run of digits. Read one by one when it isn't a quantity, like a postcode,
// or is longer than `cardinal` can name.
function digits(run: string): string {
  if (run.length > 12 || (run.length > 1 && run.startsWith("0"))) {
    return [...run].map((d) => UNITS[Number(d)]).join(" ");
  }
  return cardinal(Number(run));
}

// A number as written in Catalan, 1.234,5, or with a decimal point, 3.14.
const NUMBER = /\d+(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;

function numberWords(number: string): string {
  const thousandsDots = /^\d+(\.\d{3})+(,\d+)?$/.test(number);
  const [whole, decimals] = (thousandsDots ? number.replaceAll(".", "") : number).split(/[.,]/);
  if (!decimals) return digits(whole);
  // Zeros after the comma are read one by one: 0,05 is "zero coma zero cinc".
  const [, zeros, rest] = decimals.match(/^(0*)(\d*)$/)!;
  const fraction = [...[...zeros].map(() => UNITS[0]), ...(rest ? [digits(rest)] : [])];
  return `${digits(whole)} coma ${fraction.join(" ")}`;
}

const SYMBOL_WORDS: Record<string, string> = {
  "%": "per cent",
  "€": "euros",
  $: "dòlars",
  "&": "i",
  "+": "més",
  "=": "igual a",
};

// Ends a line as a sentence unless it already ends in punctuation.
function asSentence(line: string): string {
  return /[.!?:;,…]$/.test(line) ? line : `${line}.`;
}

// One line of the reply, reduced to what the model can read.
function speakable(line: string): string {
  return (
    line
      // Heading and list markers.
      .replace(/^\s*(#+|[-*•])\s+/, "")
      // Markdown links keep their text; bare links are dropped.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/['‘]/g, "’")
      .replace(/–/g, "-")
      // $5 is read as 5 $.
      .replace(/([€$])\s?(\d[\d.,]*\d|\d)/g, "$2 $1")
      .replace(NUMBER, (number) => ` ${numberWords(number)} `)
      .replace(/[%€$&+=]/g, (symbol) => ` ${SYMBOL_WORDS[symbol]} `)
      // Accents the model doesn't know are dropped from their letters.
      .replace(UNSPEAKABLE, (char) => {
        const letter = char.normalize("NFD").replace(/\p{M}/gu, "");
        return /^[A-Za-z]+$/.test(letter) ? letter : " ";
      })
      .replace(/\s+/g, " ")
      .replace(/ ([,.;:!?)])/g, "$1")
      .replace(/\( /g, "(")
      .trim()
  );
}

export function speechText(text: string): string {
  const lines = text
    .normalize("NFC")
    .split("\n")
    .map(speakable)
    // Drops lines left with nothing to say, like a Markdown rule.
    .filter((line) => /\p{L}/u.test(line));
  return lines.map((line, i) => (i < lines.length - 1 ? asSentence(line) : line)).join(" ");
}
