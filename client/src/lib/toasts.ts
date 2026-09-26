import { toast } from "sonner";
import { friendlyErrorMessage, isUnauthorizedError } from "@shared/errorMessages";

export function showErrorToast(error: unknown, title = "Something went wrong", fallback = "Please try again.") {
  const sessionExpired = isUnauthorizedError(error);
  toast.error(sessionExpired ? "Your session has ended" : title, {
    description: friendlyErrorMessage(error, fallback),
    duration: 6500,
    closeButton: true,
  });
}
