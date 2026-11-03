// Official SDK pinned at 0.16.0. No legacy clob-client and no automatic approvals/deployments.
export function safeVenueError(error) {
  const name=error?.name||'Error',status=Number(error?.status)||null;
  return {code:name,status,message:`交易服务未完成请求（${name}${status?' / '+status:''}）。未返回原始错误内容，以免泄露签名或凭证。`};
}
export async function sdkTransport(input,init={}) {
  const req=new Request(input,init),url=new URL(req.url);
  const hosts=new Set(['clob.polymarket.com','gamma-api.polymarket.com','data-api.polymarket.com','api.defi.polymarket.com','polygon.drpc.org']);
  if(url.protocol!=='https:'||!hosts.has(url.hostname))throw Error('SDK请求目标未在固定列表内');
  const allowedMutation=url.hostname==='clob.polymarket.com'&&((req.method==='POST'&&['/auth/api-key','/order'].includes(url.pathname))||(req.method==='DELETE'&&url.pathname==='/order'));
  if(req.method!=='GET'&&!allowedMutation)throw Error('禁止SDK自动授权、部署、转账或重试其他资金操作');
  return fetch(req,{redirect:'error'});
}
export async function authenticateExisting(publicClient,signer,wallet) {
  // Drive the SDK auth-only workflow instead of createSecureClient(), which may deploy a wallet.
  const workflow=await publicClient.beginAuthentication({wallet},signer);
  let step=await workflow.next();
  while(!step.done){
    if(step.value.kind==='requestAddress')step=await workflow.next(await signer.getAddress());
    else if(step.value.kind==='signAuthMessage')step=await workflow.next(await signer.signTypedData(step.value.payload));
    else throw Error('未知认证签名请求，已停止');
  }
  const client=step.value;
  if(client.account.wallet.toLowerCase()!==wallet.toLowerCase()||client.account.signerType!=='OWNER')throw Error('资金账户与签名者未匹配；不接受自动猜测或未验证会话密钥');
  return client;
}
export async function createVenue(env=process.env) {
  const sdk=await import('@polymarket/client');
  const publicClient=sdk.createPublicClient({fetch:sdkTransport});
  let securePromise;
  async function secure(){
    if(!env.POLY_FUNDER_ADDRESS||!env.POLY_SIGNER_PRIVATE_KEY)throw Error('签名授权尚未配置');
    if(!/^0x[\da-fA-F]{40}$/.test(env.POLY_FUNDER_ADDRESS))throw Error('资金账户地址无效');
    if(!securePromise){securePromise=(async()=>{const {privateKey}=await import('@polymarket/client/viem');const base=privateKey(env.POLY_SIGNER_PRIVATE_KEY);
      const signer={getAddress:()=>base.getAddress(),signTypedData:p=>base.signTypedData(p),signMessage:()=>{throw Error('未开放任意消息签名');},sendTransaction:()=>{throw Error('未开放链上资金操作');}};
      return authenticateExisting(publicClient,signer,env.POLY_FUNDER_ADDRESS);
    })().catch(error=>{securePromise=undefined;throw error;});}return securePromise;
  }
  return {
    async preflight(){const c=await secure();const [balance,closedOnly,orders]=await Promise.all([c.fetchBalanceAllowance({assetType:sdk.AssetType.COLLATERAL},{retries:0}),c.fetchClosedOnlyMode({retries:0}),c.listOpenOrders(undefined,{retries:0}).firstPage()]);return {wallet:c.account.wallet,signer:c.account.signer,walletType:c.account.walletType,balance:balance.balance.toString(),closedOnly,openOrderCountOnFirstPage:orders.items.length,hasMoreOpenOrders:orders.hasMore};},
    async inspect(slug,outcome){const market=await publicClient.fetchMarket({slug},{retries:0});const pair=Object.values(market.outcomes);
      if(pair.length!==2||!pair.some(x=>x.label.toLowerCase()==='up')||!pair.some(x=>x.label.toLowerCase()==='down'))throw Error('市场不是Up/Down二元市场');
      const target=pair.find(x=>x.label.toLowerCase()===outcome),completeTokens=pair.every(x=>x.tokenId!==null);
      const assetId=completeTokens?target.tokenId:target.positionId;if(!assetId||!market.conditionId)throw Error('市场缺少有效合约标识');
      const [book,info]=await Promise.all([publicClient.fetchOrderBook({assetId},{retries:0}),publicClient.fetchMarketInfo({conditionId:market.conditionId},{retries:0})]);
      if(book.assetId!==assetId||book.conditionId!==market.conditionId||!info.tokens.some(t=>t.assetId===assetId&&t.outcome.toLowerCase()===outcome))throw Error('市场与盘口、合约映射不一致');
      return {slug:market.slug,title:market.question,conditionId:market.conditionId,assetId,active:market.state.active===true&&!market.state.closed&&market.state.enableOrderBook===true&&market.state.acceptingOrders===true,end:market.state.endDate,timestamp:Number(book.timestamp),minSize:Number(book.minOrderSize),tick:Number(book.tickSize),bestAsk:book.asks.length?Math.min(...book.asks.map(x=>Number(x.price))):null,feeRate:info.feeInfo.rate,feeExponent:info.feeInfo.exponent};
    },
    async sign(p){const c=await secure();return c.createLimitOrder({assetId:p.assetId,side:sdk.OrderSide.BUY,price:p.price,size:p.size,expiration:p.expiration,postOnly:true});},
    async post(order){return (await secure()).postOrder(order);},
    async order(orderId){const o=await(await secure()).fetchOrder({orderId},{retries:0});return {orderId:o.id,assetId:o.assetId,status:o.status,price:o.price,originalSize:o.originalSize,sizeMatched:o.sizeMatched,tradeIds:o.associateTrades};},
    async cancel(orderId){return (await secure()).cancelOrder({orderId});}
  };
}
