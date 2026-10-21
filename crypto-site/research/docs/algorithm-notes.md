# AI选币规则核查

证据：本站已发布前端代码，以及正常公开GET接口返回。未修改原站配置。接口快照保存在本目录；一次快照不代表持续运行状态或完整后端实现。

## 数据来源
- monitor.json：exchange=binance，trading_mode=futures，quote=USDT，timeframes=3m/5m/15m/1h，total=200。该元数据支持Binance合约来源，但未逐笔对照交易所验证。
- prices.json：请求BTCUSDT/ETHUSDT返回source=binance，服务端缓存30秒。
- contracts.json：合约列表source=gate。不同接口来源不完全一致，不应断言所有模块只使用Binance。

## 确认的前端规则
- 均线、超级趋势：5m；放量：3m。
- 页面每60秒刷新信号及价格；默认每页50，后端历史分批每页500。
- EMA21/55/200：BTC样本四个周期共200根K线，相邻递推与alpha=2/(n+1)相符，最大绝对残差小于1e-8。初始种子与预热窗口未验证。
- MACD差值符合12/26 EMA递推，信号线符合9周期EMA；样本最大绝对残差小于2e-8。起始初始化未验证。
- ATR14样本符合Wilder递推，最大绝对残差小于1e-8；不代表超级趋势必然使用此ATR配置。
- 页面涨跌幅=(最新价-基准价)/基准价*100。均线和超级趋势基准为firstSignalClosePrice；放量基准为该次closePrice。不能与后端changeFromFirstPct字段混用。
- 多空、持续分钟范围、涨跌幅范围、均线根数范围、MACD四种零轴/交叉组合及交叉发生分钟数过滤可从前端直接复现。

## 当前公开默认配置
- 均线：kinds=ema200，ema200_min_bar_count=10，ema200_min_abs_change_pct=3。
- 超级趋势：kinds=supertrend，supertrend_min_bar_count=5，min_first_change_pct=3，max_first_change_pct=-3。正负阈值同时存在，后端对多空条件如何组合仍需验证，不能直接作为普通区间。
- 放量：kinds=volume，volume_min_abs_change_pct=2；成交额和倍数筛选配置为空。不代表后台触发门槛为空。
- 完整值见filters.json，可能随原站配置更新。

## 尚未确认
- 超级趋势ATR长度、倍数、价格源、初始化；放量倍数基线窗口与触发门槛；TD计数和重置完整规则。TD接口本次返回502。
- 是否使用未收盘K线、历史回填、首信号重置、去重、币种池更新策略和多交易所回退。
- 历史接口中有超出monitor接口200币种范围的合约，不能直接假设二者币种池相同。

## 复刻约束
自建行情采集、计算与存储；原站样本用于校验，不把其接口当作自有生产数据服务。需按同一交易所、同一合约、同一K线时间戳对照，逐项确定待确认参数后再声明一致程度。当前已有独立筛选引擎，但未完成与原站全部币种、信号时间和内部规则的实时对照验证。
