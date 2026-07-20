# HaulBrokr pricing & settlement flow map

Customer-side marketplace fee policy (default 15% of **base haul only**, from `pricing_settings`).

## Money movement (happy path)

```
Customer charge (Stripe PaymentIntent / Checkout)
  = customerSubtotal + marketplaceFee + taxes
  where customerSubtotal = baseHaul + fuel + tolls + wait + emergency + holiday

Stripe destination charge / transfer split:
  → Carrier Connect transfer  = providerNetAmount = customerSubtotal
  → Platform application fee = customerTotal − providerNetAmount
                              (= marketplaceFee + taxes)

HaulBrokr marketplace revenue (ex-tax) = marketplaceFee
Carrier payout NEVER = baseHaul × (1 − feeRate)
```

### Policy example

| Party | Line | Amount |
|-------|------|--------|
| Customer | Base haul | $1,000 |
| Customer | Fuel surcharge | $50 |
| Customer | Tolls | $20 |
| Customer | Marketplace fee (15% of base) | $150 |
| Customer | **Total before tax** | **$1,220** |
| Carrier | Base haul pay | $1,000 |
| Carrier | Fuel reimbursement | $50 |
| Carrier | Toll reimbursement | $20 |
| Carrier | **Payout** | **$1,070** |
| HaulBrokr | Marketplace revenue | $150 |

## Surfaces

| Surface | Fee shown? | Percentage published? |
|---------|------------|------------------------|
| Public `#pricing` | No fixed % | No — disclosure copy only |
| Quote / checkout / invoice / receipt | Yes, job’s frozen rate | Yes (configured rate) |
| Carrier settlement | Informational only | Yes — “not deducted” |
| Admin Pricing tab | Editable “Customer marketplace fee” | Yes (ops-only) |

## Refunds

- Stripe destination charges use `reverse_transfer` + `refund_application_fee`.
- Ledger helper `allocateRefund()` absorbs marketplace fee (+ taxes) first, then claws carrier net.
- Note: Stripe’s proportional transfer reverse may differ slightly from fee-first ledger allocation; ops should verify large partial refunds.

## Historical freeze

Rates and amounts are written onto the job at completion (`platformFeeRate`, `platformFeeAmount`, fuel/toll/wait/tax columns). Changing admin defaults does not rewrite past jobs.
