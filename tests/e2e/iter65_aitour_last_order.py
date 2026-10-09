"""iter65 — Frontend-only verification of Last-Order (Ultimo acquisto) states.

Scope (read-only, no CRM writes):
- A) Live Tour: next-visit, pending list, visit detail — check 'aitour-next-last-order',
     'aitour-live-last-order-*', 'aitour-detail-last-order'.
- C) Saved tours: list ('aitour-agenda-last-order-*'), map popup ('aitour-popup-last-order-*'),
     edit modal rows ('aitour-edit-last-order-*') without confirming any mutation.
- D) GPTour: one chat turn (Segrate 30 giorni), verify thinking stages, gptour-purchase-filter
     and gptour-last-order-* presence or valid empty-area message.
- E) No white screens / red Metro / React console errors.
"""
