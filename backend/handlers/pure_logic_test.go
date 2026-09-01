package handlers

import "testing"

// deriveTransferType is the exact function CreateTransfer uses to decide
// what gets recorded — these lock in the four combinations the user asked
// for, so a future refactor can't silently swap two of them.
func TestDeriveTransferType(t *testing.T) {
	cases := []struct {
		from, to string
		want     string
	}{
		{"BANK", "BANK", "BANK TO BANK TRANSFER"},
		{"CASH", "BANK", "CASH DEPOSIT IN BANK"},
		{"BANK", "CASH", "CASH WITHDRAWAL FROM BANK"},
		{"CASH", "CASH", "CASH ACCOUNT TRANSFER"},
	}
	for _, c := range cases {
		if got := deriveTransferType(c.from, c.to); got != c.want {
			t.Errorf("deriveTransferType(%q, %q) = %q, want %q", c.from, c.to, got, c.want)
		}
	}
}

// suggestedAccountAction backs the low-balance nudge on the accounts page —
// this pins down the exact threshold behavior (which side of ₹1,000 counts,
// and that an already-matching state suggests nothing) so it can't drift.
func TestSuggestedAccountAction(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	cases := []struct {
		name      string
		balance   float64
		isActive  bool
		want      *string
	}{
		{"active, well above threshold", 5000, true, nil},
		{"active, exactly at threshold — not below, so no suggestion", 1000, true, nil},
		{"active, just below threshold", 999.99, true, strPtr("deactivate")},
		{"active, zero balance", 0, true, strPtr("deactivate")},
		{"inactive, below threshold — already in the suggested state", 500, false, nil},
		{"inactive, exactly at threshold — should suggest reactivating", 1000, false, strPtr("reactivate")},
		{"inactive, well above threshold", 5000, false, strPtr("reactivate")},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := suggestedAccountAction(c.balance, c.isActive)
			if (got == nil) != (c.want == nil) {
				t.Fatalf("suggestedAccountAction(%v, %v) = %v, want %v", c.balance, c.isActive, ptrOrNil(got), ptrOrNil(c.want))
			}
			if got != nil && *got != *c.want {
				t.Errorf("suggestedAccountAction(%v, %v) = %q, want %q", c.balance, c.isActive, *got, *c.want)
			}
		})
	}
}

func ptrOrNil(s *string) string {
	if s == nil {
		return "nil"
	}
	return *s
}
