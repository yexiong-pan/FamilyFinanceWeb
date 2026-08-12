import type {
  MortgageLoanPartKind,
  MortgageProvidentFundRole,
  MortgageRateSource,
  MortgageRateType,
  MortgageRepaymentMethod
} from "@family-finance/shared";
export type { ConfirmMortgageMonthlyRepaymentInput } from "@family-finance/shared";
import type { ProvidentFundContributionSource } from "@family-finance/shared";

export interface MortgageLoanPartInput {
  kind: MortgageLoanPartKind;
  name: string;
  initialPrincipal: string;
  outstandingPrincipal?: string;
  annualRate: string;
  rateType: MortgageRateType;
  occupancyType?: "first" | "second";
  lprSpread?: string;
  repricingCycleMonths?: number;
  repricingDate?: string;
  repaymentMethod: MortgageRepaymentMethod;
  firstRepaymentDate: string;
  totalPeriods: number;
  remainingPeriods?: number;
}

export interface CreateMortgageInput {
  name: string;
  lender?: string;
  ownerName: string;
  repaymentDay: number;
  note?: string;
  parts: MortgageLoanPartInput[];
}

export interface ProvidentFundAccountInput {
  memberId: string;
  basicBalance: string;
  supplementaryBalance: string;
  basicMonthlyContribution?: string;
  supplementaryMonthlyContribution?: string;
  monthlyContributionDay?: number;
  balanceUpdatedOn: string;
  isActive?: boolean;
  note?: string;
}

export interface ProvidentFundContributionRateInput {
  effectiveMonth: string;
  basicMonthlyContribution: string;
  supplementaryMonthlyContribution: string;
  source?: ProvidentFundContributionSource;
  note?: string;
}

export interface PreviewRateAdjustmentInput {
  loanPartId: string;
  annualRate: string;
  effectiveDate: string;
  source: MortgageRateSource;
  lprValue?: string;
  lprPublishedMonth?: string;
  policyVersion?: string;
  evidenceNote?: string;
}

export interface MortgageProvidentFundParticipantInput {
  participants: Array<{
    accountId: string;
    role: MortgageProvidentFundRole;
    priority: number;
    isActive?: boolean;
  }>;
}
