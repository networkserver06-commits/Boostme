import { eq, orders, profiles, type TursoDb, walletTransactions } from "./db";
import { mapProviderStatus, type ProviderOrderStatus } from "./provider";

const finiteNumber = (value: string | number | undefined) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Persist one provider poll and, only after the provider reports canceled, refund undelivered retail value once. */
export async function applyProviderOrderStatus(db: TursoDb, orderId: number, providerStatus: ProviderOrderStatus) {
  const [current] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!current) return { updated: false, refund: 0 };

  const status = mapProviderStatus(providerStatus.status);
  const rawRemains = finiteNumber(providerStatus.remains);
  const reportedStartCount = finiteNumber(providerStatus.start_count);
  const remains = rawRemains === null
    ? current.remains
    : Math.max(0, Math.min(current.quantity, Math.trunc(rawRemains)));
  const startCount = reportedStartCount === null ? current.startCount : Math.max(0, Math.trunc(reportedStartCount));
  const checkedAt = new Date();
  const finalCancellationState = ["accepted", "submitting"].includes(current.cancelRequestStatus) && ["canceled", "completed", "failed"].includes(status)
    ? status === "canceled" ? "confirmed" as const : "rejected" as const
    : current.cancelRequestStatus;

  return db.transaction(async (tx) => {
    await tx.update(orders).set({ status, remains, startCount, cancelRequestStatus: finalCancellationState, lastProviderCheckAt: checkedAt, updatedAt: checkedAt }).where(eq(orders.id, orderId));

    if (status !== "canceled" || rawRemains === null || current.quantity <= 0) {
      return { updated: true, refund: 0 };
    }

    const reference = `cancel-refund-${orderId}`;
    const [priorRefund] = await tx.select({ id: walletTransactions.id }).from(walletTransactions).where(eq(walletTransactions.reference, reference)).limit(1);
    if (priorRefund) return { updated: true, refund: 0 };

    const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, current.userId)).limit(1);
    if (!profile) return { updated: true, refund: 0 };

    const refundableUnits = Math.max(0, Math.min(current.quantity, Math.trunc(rawRemains)));
    const amount = Number((Number(current.charge) * refundableUnits / current.quantity).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) return { updated: true, refund: 0 };

    const nextBalance = Number((Number(profile.balance) + amount).toFixed(2));
    await tx.update(profiles).set({ balance: nextBalance.toFixed(2) }).where(eq(profiles.userId, current.userId));
    await tx.insert(walletTransactions).values({
      userId: current.userId,
      amount: amount.toFixed(2),
      type: "refund",
      status: "completed",
      reference,
      paymentMethod: "system",
      balanceAfter: nextBalance.toFixed(2),
    });
    return { updated: true, refund: amount };
  });
}
