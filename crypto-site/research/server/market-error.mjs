export class MarketError extends Error{constructor(message,code='UPSTREAM_ERROR',retryAfterMs=60000){super(message);this.code=code;this.retryAfterMs=retryAfterMs}}
