import { describe, expect, it } from "vitest";
import { profilePhotoMobileUrl } from "../src/modules/clients/client-profile-photo.pure";

describe("profilePhotoMobileUrl", () => {
  it("bo‘sh rasmda manzil bermaydi", () => {
    expect(profilePhotoMobileUrl(null, "aksit", 7)).toBeNull();
    expect(profilePhotoMobileUrl("  ", "aksit", 7)).toBeNull();
    expect(profilePhotoMobileUrl("client-profile/1/7/photo.jpg", "", 7)).toBeNull();
  });

  it("ombor kalitini bitta autentifikatsiyali manzilga aylantiradi", () => {
    const at = new Date("2026-10-14T12:00:00.000Z");
    expect(profilePhotoMobileUrl("client-profile/1/7/photo.jpg", "aksit", 7, at)).toBe(
      `/api/aksit/clients/7/profile-photo?v=${at.getTime()}`
    );
  });

  it("qisqa https manzilni o‘zini qoldiradi", () => {
    expect(profilePhotoMobileUrl("https://cdn.example/a.jpg", "aksit", 7)).toBe("https://cdn.example/a.jpg");
  });
});
