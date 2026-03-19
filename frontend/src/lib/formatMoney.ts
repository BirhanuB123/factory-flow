/** Number formatting tuned for ETB (Birr) and other currencies. */
export function formatMoneyAmount(amount: number, currencyCode: string): string {
  const locale = currencyCode === "ETB" ? "en-ET" : "en-US";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

export function formatMoneyWithSymbol(
  amount: number,
  currencyCode: string,
  symbol: string
): string {
  return `${symbol}${formatMoneyAmount(amount, currencyCode)}`;
}
