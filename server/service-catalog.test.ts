import { describe, expect, it } from "vitest";
import { compareCustomerPlatforms, isCustomerVisiblePlatform, normalizeServicePresentation } from "../shared/serviceCatalog";

describe("service catalog presentation", () => {
  it("derives social platform and category from API-labelled offer names", () => {
    const facebook = normalizeServicePresentation({ platform: "Api", category: "Api Rates [ WhatsAPP us for More ]", name: "Facebook Followers | Bot Accounts | Speed 5K+ / DAY" });
    const tiktok = normalizeServicePresentation({ platform: "Api", category: "Api Rates [ WhatsAPP us for More ]", name: "TikTok Video Views | Min 5K | Super Cheap" });
    expect(facebook).toMatchObject({ platform: "Facebook", category: "Followers" });
    expect(tiktok).toMatchObject({ platform: "TikTok", category: "Views" });
  });

  it("normalizes common catalog misspellings while retaining the real service category", () => {
    expect(normalizeServicePresentation({ platform: "Instgram", category: "Api Rates", name: "Instagram Reel Likes" })).toMatchObject({ platform: "Instagram", category: "Likes" });
    expect(normalizeServicePresentation({ platform: "Telgram", category: "Telegram - Members", name: "Telegram Members" })).toMatchObject({ platform: "Telegram", category: "Members" });
  });

  it("retains legitimate non-social categories without inventing a platform", () => {
    expect(normalizeServicePresentation({ platform: "SEO", category: "SEO", name: "Backlinks" })).toMatchObject({ platform: "SEO", category: "SEO" });
  });

  it("normalizes provider misspellings and filters catalog noise for customers", () => {
    expect(normalizeServicePresentation({ platform: "Instgram", category: "Api Rates", name: "Instgram Likes" })).toMatchObject({ platform: "Instagram", category: "Likes" });
    expect(isCustomerVisiblePlatform("Amazon")).toBe(false);
    expect(isCustomerVisiblePlatform("Instagram")).toBe(true);
  });

  it("prioritizes the most-used Kenyan platforms", () => {
    expect(["YouTube", "Instagram", "TikTok", "Facebook"].sort(compareCustomerPlatforms)).toEqual(["TikTok", "Facebook", "Instagram", "YouTube"]);
  });
});
