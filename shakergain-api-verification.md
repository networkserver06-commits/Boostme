# ShakerGain API Verification

Source: https://shakergainske.com/api, accessed 2026-08-29.

The provider documents HTTP POST requests returning JSON at `https://shakergainske.com/api/v2`. Authentication uses a `key` form field. The documented actions are `services`, `add`, and `status`.

The service-list response uses fields including `Category` (capitalized in one example), `category` (implicitly supported by the existing adapter), `name`, `service` or `services` for the service ID, `rate`, `min`, `max`, and `type`. Add-order requests use `service`, `link`, and `quantity`, returning an `order` ID. Status requests use `order`, returning `status`, `start_count`, `remains`, and `charge`. Multiple-order status is also documented, but the current application polls one order at a time.

The existing adapter already uses POST `application/x-www-form-urlencoded` requests with `key` and `action`, and already supports `services`, `add`, and single-order `status`. A compatibility adjustment is needed for ShakerGain's documented `services` ID alias and capitalized `Category` field before relying on catalog import.
