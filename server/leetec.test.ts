import { describe, expect, it } from "vitest";
import { normalizePaymentStatus, summarizeLeeTecResponse } from "./leetec";

describe("LeeTec payment responses", () => {
  it("normalizes successful, failed, and pending statuses", () => {
    expect(normalizePaymentStatus("completed")).toBe("SUCCESS");
    expect(normalizePaymentStatus("rejected")).toBe("FAILED");
    expect(normalizePaymentStatus("processing")).toBe("PENDING");
  });

  it("reads gateway fields from nested response data", () => {
    expect(summarizeLeeTecResponse({ data: { status: "SUCCESS", receipt: "ABC123", checkout_request_id: "ws-1" } })).toMatchObject({ status: "SUCCESS", receipt: "ABC123", checkoutRequestId: "ws-1" });
  });
});
