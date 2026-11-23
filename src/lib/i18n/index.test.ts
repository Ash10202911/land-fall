import { describe, expect, it } from "vitest";
import { interpolate, localeFromAcceptLanguage, makeTranslator, parseLocale } from "./index";

describe("locale parsing", () => {
  it("accepts only en or zh", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("zh")).toBe("zh");
    for (const bad of ["zh-CN", "fr", "", undefined, null, 1, "EN"]) expect(parseLocale(bad)).toBeNull();
  });

  it("reads Accept-Language: any Chinese gives zh, otherwise the first supported language, else English", () => {
    expect(localeFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(localeFromAcceptLanguage("zh-Hant-TW")).toBe("zh");
    expect(localeFromAcceptLanguage("en-AU,en;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("fr-FR,zh;q=0.5")).toBe("zh");
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeFromAcceptLanguage("")).toBe("en");
  });
});

describe("interpolate", () => {
  it("fills named placeholders and leaves unknown ones as written", () => {
    expect(interpolate("{a} to {b}", { a: "Shenzhen", b: "Sydney" })).toBe("Shenzhen to Sydney");
    expect(interpolate("{n} left", { n: 0 })).toBe("0 left");
    expect(interpolate("Hello {name}")).toBe("Hello {name}");
    expect(interpolate("Hello {name}", { other: 1 })).toBe("Hello {name}");
    expect(interpolate("{x} and {x}", { x: "y" })).toBe("y and y");
  });
});

describe("translator", () => {
  const zh = { "Open jobs": "开放的任务", "{n} quotes": "{n} 个报价", "{company} awarded you {route}": "{company} 把 {route} 授予了您" };

  it("returns English text as written, with placeholders filled", () => {
    const t = makeTranslator("en");
    expect(t("Open jobs")).toBe("Open jobs");
    expect(t("{company} awarded you {route}", { company: "Acme", route: "A to B" })).toBe("Acme awarded you A to B");
    expect(t.locale).toBe("en");
  });

  it("returns the Chinese for the exact English text, and English when there is no entry", () => {
    const t = makeTranslator("zh", zh);
    expect(t("Open jobs")).toBe("开放的任务");
    expect(t("{company} awarded you {route}", { company: "Acme", route: "深圳 到 悉尼" })).toBe("Acme 把 深圳 到 悉尼 授予了您");
    expect(t("Not translated yet")).toBe("Not translated yet");
    expect(t.locale).toBe("zh");
  });

  it("chooses singular for exactly one in English, and the single Chinese form otherwise", () => {
    const en = makeTranslator("en");
    expect(en.plural(1, "{n} quote", "{n} quotes")).toBe("1 quote");
    expect(en.plural(0, "{n} quote", "{n} quotes")).toBe("0 quotes");
    expect(en.plural(2, "{n} quote", "{n} quotes")).toBe("2 quotes");
    const cn = makeTranslator("zh", zh);
    expect(cn.plural(1, "{n} quote", "{n} quotes")).toBe("1 个报价");
    expect(cn.plural(5, "{n} quote", "{n} quotes")).toBe("5 个报价");
  });

  it("does not let a message dictionary change English", () => {
    expect(makeTranslator("en", zh)("Open jobs")).toBe("Open jobs");
  });
});
