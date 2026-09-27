import { afterEach, describe, expect, it } from "vitest";
import { eq, profiles, setTursoClientForTesting, settleDeposit, walletTransactions } from "./db";
import { createTestDatabase } from "./testDb";

afterEach(() => setTursoClientForTesting(null));

describe("deposit settlement", () => {
  it("credits a pending deposit once and remains idempotent", async () => {
    const { client, db } = await createTestDatabase();
    setTursoClientForTesting(client);
    await db.insert(profiles).values({ userId: 7, balance: "5.00" });
    await db.insert(walletTransactions).values({ userId: 7, amount: "10.00", type: "deposit", status: "pending", reference: "OG-7-test", paymentMethod: "M-Pesa / LeeTec", balanceAfter: "5.00" });

    const first = await settleDeposit({ userId: 7, reference: "OG-7-test", status: "SUCCESS" });
    const second = await settleDeposit({ userId: 7, reference: "OG-7-test", status: "SUCCESS" });
    const profile = (await db.select().from(profiles).where(eq(profiles.userId, 7)))[0];
    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(profile?.balance).toBe("15.00");
  });
});
