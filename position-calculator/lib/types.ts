export type Direction = 'long' | 'short';
export type Target = { mode: 'r' | 'price'; value: string; share: string };
export type Plan = {
  symbol: string; customSymbol: string; direction: Direction;
  solveMode: 'margin' | 'stop'; marginInput: string;
  riskMode: 'amount' | 'percent'; maxLoss: string;
  equity: string; risk: string; maxRisk: string; entry: string; stop: string; leverage: string;
  openFee: string; closeFee: string; slippage: string; funding: string;
  priceDecimals: string; priceStep: string; quantityStep: string; minQuantity: string;
  targets: [Target, Target];
};
export type ViewMode = 'simple' | 'professional';
export type SavedPlan = { view?: ViewMode; id: string; savedAt: string; plan: Plan; quantity: string; targetPrices: string[] };
export const DEFAULT_PLAN: Plan = {
  solveMode: 'margin', marginInput: '100',
  riskMode: 'amount', maxLoss: '100',
  symbol: 'BTCUSDT', customSymbol: '', direction: 'long', equity: '5000', risk: '0.5', maxRisk: '5',
  entry: '100200', stop: '99600', leverage: '100', openFee: '0.04', closeFee: '0.04', slippage: '0.02', funding: '0',
  priceDecimals: '2', priceStep: '0.1', quantityStep: '0.000001', minQuantity: '0.000001',
  targets: [{ mode: 'r', value: '1.5', share: '50' }, { mode: 'r', value: '3', share: '50' }],
};
export const symbolOf = (p: Plan) => p.symbol === 'CUSTOM' ? p.customSymbol : p.symbol;
