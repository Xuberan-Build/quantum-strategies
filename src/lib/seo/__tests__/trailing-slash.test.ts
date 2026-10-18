import { describe, it, expect } from "vitest";
import { trailingSlashTarget } from "../trailing-slash";

describe("trailingSlashTarget", () => {
  it("redirects slashless page paths to the trailing-slash form", () => {
    expect(trailingSlashTarget("/meet", "GET")).toBe("/meet/");
    expect(trailingSlashTarget("/products/perception", "HEAD")).toBe("/products/perception/");
    expect(trailingSlashTarget("/articles/mvp-strategy", "GET")).toBe("/articles/mvp-strategy/");
  });

  it("leaves canonical paths alone", () => {
    expect(trailingSlashTarget("/", "GET")).toBeNull();
    expect(trailingSlashTarget("/meet/", "GET")).toBeNull();
  });

  it("never touches API routes (Stripe webhooks must not get a 308)", () => {
    expect(trailingSlashTarget("/api/stripe/webhook", "POST")).toBeNull();
    expect(trailingSlashTarget("/api/stripe/webhook", "GET")).toBeNull();
    expect(trailingSlashTarget("/api", "GET")).toBeNull();
  });

  it("ignores non-GET methods and files", () => {
    expect(trailingSlashTarget("/meet", "POST")).toBeNull();
    expect(trailingSlashTarget("/sitemap.xml", "GET")).toBeNull();
    expect(trailingSlashTarget("/robots.txt", "GET")).toBeNull();
    expect(trailingSlashTarget("/images/hero.webp", "GET")).toBeNull();
    expect(trailingSlashTarget("/_next/static/chunk", "GET")).toBeNull();
  });
});
