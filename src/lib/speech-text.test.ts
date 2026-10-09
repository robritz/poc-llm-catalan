import { describe, expect, test } from "vitest";
import { speechText } from "./speech-text";

describe("speechText", () => {
  test("leaves plain Catalan text as it is", () => {
    const text = "Bon dia Manel, avui anem a la muntanya. Què et sembla l’excursió «llarga»?";
    expect(speechText(text)).toBe(text);
  });

  test.each([
    ["0", "zero"],
    ["1", "un"],
    ["7", "set"],
    ["15", "quinze"],
    ["19", "dinou"],
    ["20", "vint"],
    ["21", "vint-i-un"],
    ["29", "vint-i-nou"],
    ["30", "trenta"],
    ["42", "quaranta-dos"],
    ["99", "noranta-nou"],
    ["100", "cent"],
    ["101", "cent un"],
    ["200", "dos-cents"],
    ["999", "nou-cents noranta-nou"],
    ["1000", "mil"],
    ["1714", "mil set-cents catorze"],
    ["2026", "dos mil vint-i-sis"],
    ["7500000", "set milions cinc-cents mil"],
    ["1000000", "un milió"],
    ["2000000000", "dos mil milions"],
  ])("writes the number %s out in words", (number, words) => {
    expect(speechText(number)).toBe(words);
  });

  test.each([
    ["1.000", "mil"],
    ["7.500.000", "set milions cinc-cents mil"],
    ["2,5", "dos coma cinc"],
    ["3.14", "tres coma catorze"],
    ["0,05", "zero coma zero cinc"],
    ["1.234,5", "mil dos-cents trenta-quatre coma cinc"],
  ])("reads %s with its thousands and decimal separators", (number, words) => {
    expect(speechText(number)).toBe(words);
  });

  test("reads digit by digit a number that is too long or begins with zero", () => {
    expect(speechText("08001")).toBe("zero vuit zero zero un");
    expect(speechText("1234567890123")).toBe("un dos tres quatre cinc sis set vuit nou zero un dos tres");
  });

  test("keeps numbers apart from the words and punctuation around them", () => {
    expect(speechText("Té 3 gats, 2 gossos (i 1 lloro).")).toBe("Té tres gats, dos gossos (i un lloro).");
    expect(speechText("la línia L3 i el 4t")).toBe("la línia L tres i el quatre t");
  });

  test("writes common symbols out in words", () => {
    expect(speechText("Un 10% de 25 €")).toBe("Un deu per cent de vint-i-cinc euros");
    expect(speechText("Costa $5 o €4,50")).toBe("Costa cinc dòlars o quatre coma cinquanta euros");
    expect(speechText("pa & vi, 2 + 2 = 4")).toBe("pa i vi, dos més dos igual a quatre");
  });

  test("removes Markdown but keeps its text", () => {
    expect(speechText("# Títol\n\nÉs **molt** _bo_ i `net`.")).toBe("Títol. És molt bo i net.");
    expect(speechText("Mira [la web](https://example.com/a_b?c=1) ara")).toBe("Mira la web ara");
  });

  test("removes links, emoji and other characters the model can't read", () => {
    expect(speechText("Hola! 😀 Visita https://example.com/a_b avui")).toBe("Hola! Visita avui");
    expect(speechText("a/b [c] {d} <e> ~f^ | @g #h")).toBe("a b c d e f g h");
  });

  test("ends each line as a sentence, so lists aren't read in one breath", () => {
    expect(speechText("Necessites:\n- pa\n- vi\n* oli\n\nBon profit!")).toBe(
      "Necessites: pa. vi. oli. Bon profit!",
    );
    expect(speechText("1. Sants\n2. Gràcia")).toBe("un. Sants. dos. Gràcia");
    expect(speechText("Hola! 😀\n---\n**Adéu**\nfins aviat")).toBe("Hola! Adéu. fins aviat");
  });

  test("uses the apostrophe and dash the model was trained with", () => {
    expect(speechText("l'home i l‘illa – sí")).toBe("l’home i l’illa - sí");
  });

  test("drops accents Catalan doesn't use, keeping the ones it does", () => {
    expect(speechText("Â château São ÀÉÍÒÚ çÇ ñ l·l ü")).toBe("A chateau Sao ÀÉÍÒÚ çÇ ñ l·l ü");
  });

  test("returns nothing when no speakable text is left", () => {
    expect(speechText(" 😀 *** ")).toBe("");
  });
});
