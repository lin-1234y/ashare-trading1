const STORAGE_KEY = "ashare-trading-journal";

const defaultSettings = {
  initialCash: 0,
  commissionRate: 0.00025,
  minCommission: 5,
  stampRate: 0.0005,
  transferRate: 0.00001,
};

const state = {
  trades: [],
  prices: {},
  initialPositions: [],
  settings: { ...defaultSettings },
};

function optionalElement(selector) {
  return (
    document.querySelector(selector) || {
      value: "",
      textContent: "",
      innerHTML: "",
      className: "",
      addEventListener() {},
    }
  );
}

function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const els = {
  navButtons: document.querySelectorAll(".nav-button"),
  views: document.querySelectorAll(".view"),
  pageTitle: document.querySelector("#page-title"),
  form: document.querySelector("#trade-entry-form"),
  editingId: document.querySelector("#editing-id"),
  tradeDate: document.querySelector("#trade-date"),
  symbol: document.querySelector("#symbol"),
  name: document.querySelector("#name"),
  side: document.querySelector("#side"),
  price: document.querySelector("#price"),
  quantity: document.querySelector("#quantity"),
  commission: document.querySelector("#commission"),
  stampTax: document.querySelector("#stamp-tax"),
  transferFee: document.querySelector("#transfer-fee"),
  note: document.querySelector("#note"),
  formHeading: document.querySelector("#form-heading"),
  previewAmount: document.querySelector("#preview-amount"),
  previewFee: document.querySelector("#preview-fee"),
  previewNet: document.querySelector("#preview-net"),
  recordsBody: document.querySelector("#records-body"),
  recordsCards: optionalElement("#records-cards"),
  positionsBody: document.querySelector("#positions-body"),
  positionsCards: optionalElement("#positions-cards"),
  quoteStatus: optionalElement("#quote-status"),
  recordFilter: document.querySelector("#record-filter"),
  summaryCount: document.querySelector("#summary-count"),
  allocationPie: optionalElement("#allocation-pie"),
  allocationList: optionalElement("#allocation-list"),
  equityChart: optionalElement("#equity-chart"),
  equityCurveBody: optionalElement("#equity-curve-body"),
  equityCurveCards: optionalElement("#equity-curve-cards"),
  assets: document.querySelector("#metric-assets"),
  totalReturn: optionalElement("#metric-total-return"),
  cash: document.querySelector("#metric-cash"),
  marketValue: document.querySelector("#metric-market-value"),
  cost: document.querySelector("#metric-cost"),
  floating: document.querySelector("#metric-floating"),
  realized: document.querySelector("#metric-realized"),
  totalFees: optionalElement("#metric-total-fees"),
  tradePairPnlBody: document.querySelector("#trade-pair-pnl-body"),
  tradePairPnlCards: optionalElement("#trade-pair-pnl-cards"),
  pairStartDate: optionalElement("#pair-start-date"),
  pairEndDate: optionalElement("#pair-end-date"),
  initialCash: document.querySelector("#initial-cash"),
  commissionRate: document.querySelector("#commission-rate"),
  minCommission: document.querySelector("#min-commission"),
  stampRate: document.querySelector("#stamp-rate"),
  transferRate: document.querySelector("#transfer-rate"),
  initialSymbol: document.querySelector("#initial-symbol"),
  editingInitialId: optionalElement("#editing-initial-id"),
  initialPositionMode: optionalElement("#initial-position-mode"),
  initialName: document.querySelector("#initial-name"),
  initialQuantity: document.querySelector("#initial-quantity"),
  initialCost: document.querySelector("#initial-cost"),
  initialPrice: document.querySelector("#initial-price"),
  initialDate: document.querySelector("#initial-date"),
  initialPositionsBody: document.querySelector("#initial-positions-body"),
  initialPositionsCards: optionalElement("#initial-positions-cards"),
};

const titles = {
  dashboard: "总览",
  "trade-form": "新增交易",
  positions: "持仓",
  records: "交易记录",
  settings: "设置",
};

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function number(value, digits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase();
}

function marketSecid(symbol) {
  const code = normalizeSymbol(symbol);
  if (/^(5|6|9)/.test(code)) return `1.${code}`;
  return `0.${code}`;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    state.trades = Array.isArray(saved.trades) ? saved.trades : [];
    state.prices = saved.prices && typeof saved.prices === "object" ? saved.prices : {};
    state.initialPositions = Array.isArray(saved.initialPositions) ? saved.initialPositions : [];
    state.settings = { ...defaultSettings, ...(saved.settings || {}) };
  } catch {
    state.trades = [];
    state.prices = {};
    state.initialPositions = [];
    state.settings = { ...defaultSettings };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function tradeAmount(trade) {
  return trade.price * trade.quantity;
}

function calcFees(input) {
  const amount = tradeAmount(input);
  const commission = amount > 0 ? Math.max(amount * state.settings.commissionRate, state.settings.minCommission) : 0;
  const stampTax = input.side === "sell" ? amount * state.settings.stampRate : 0;
  const transferFee = amount * state.settings.transferRate;

  return {
    commission: roundMoney(commission),
    stampTax: roundMoney(stampTax),
    transferFee: roundMoney(transferFee),
  };
}

function tradeFees(trade) {
  return calcFees(trade);
}

function totalFee(trade) {
  const fees = tradeFees(trade);
  return fees.commission + fees.stampTax + fees.transferFee;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sortedTrades(trades = state.trades) {
  return [...trades].sort((a, b) => {
    if (a.date === b.date) return a.createdAt - b.createdAt;
    return a.date.localeCompare(b.date);
  });
}

function buildInitialBooks() {
  const books = new Map();

  for (const item of state.initialPositions) {
    const key = normalizeSymbol(item.symbol);
    const book = books.get(key) || {
      symbol: key,
      name: item.name,
      lots: [],
      realized: 0,
      realizedRows: [],
      buyCount: 0,
      sellCount: 0,
      totalFees: 0,
    };

    book.name = item.name || book.name;
    book.lots.push({
      quantity: item.quantity,
      unitCost: item.quantity > 0 ? item.cost / item.quantity : 0,
      source: "initial",
      date: item.date || "初始",
    });
    books.set(key, book);
  }

  return books;
}

function calculatePortfolio(trades = state.trades) {
  const books = buildInitialBooks();
  let cash = Number(state.settings.initialCash) || 0;

  for (const trade of sortedTrades(trades)) {
    const key = normalizeSymbol(trade.symbol);
    const book = books.get(key) || {
      symbol: key,
      name: trade.name,
      lots: [],
      realized: 0,
      realizedRows: [],
      buyCount: 0,
      sellCount: 0,
      totalFees: 0,
    };
    const fees = tradeFees(trade);
    const fee = fees.commission + fees.stampTax + fees.transferFee;
    const amount = tradeAmount(trade);

    book.name = trade.name || book.name;
    book.totalFees += fee;

    if (trade.side === "buy") {
      book.lots.push({
        quantity: trade.quantity,
        unitCost: (amount + fee) / trade.quantity,
        source: trade.id,
        date: trade.date,
      });
      book.buyCount += 1;
      cash -= amount + fee;
    } else {
      let remaining = trade.quantity;
      let costBasis = 0;

      while (remaining > 0 && book.lots.length) {
        const lot = book.lots[0];
        const used = Math.min(remaining, lot.quantity);
        costBasis += used * lot.unitCost;
        lot.quantity -= used;
        remaining -= used;
        if (lot.quantity <= 0.000001) book.lots.shift();
      }

      const soldQuantity = trade.quantity - remaining;
      const proceeds = amount - fee;
      const realized = soldQuantity > 0 ? proceeds - costBasis : 0;
      book.realized += realized;
      book.sellCount += 1;
      book.realizedRows.push({
        symbol: key,
        name: book.name,
        tradeId: trade.id,
        date: trade.date,
        quantity: soldQuantity,
        proceeds,
        costBasis,
        pnl: realized,
      });
      cash += proceeds;
    }

    books.set(key, book);
  }

  const realizedRows = [];
  const positions = [...books.values()].map((book) => {
    const quantity = book.lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const cost = book.lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0);
    const currentPrice = state.prices[book.symbol] ?? "";
    const price = Number(currentPrice) || 0;
    const marketValue = quantity * price;
    const floating = marketValue - cost;
    realizedRows.push(...book.realizedRows);

    return {
      symbol: book.symbol,
      name: book.name,
      quantity,
      cost,
      averageCost: quantity > 0 ? cost / quantity : 0,
      currentPrice,
      marketValue,
      floating,
      realized: book.realized,
      buyCount: book.buyCount,
      sellCount: book.sellCount,
      totalFees: book.totalFees,
    };
  });

  return { positions, realizedRows, cash };
}

function uniqueTradeDates() {
  return [...new Set(state.trades.map((trade) => trade.date))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function calculateEquityCurve() {
  const dates = uniqueTradeDates();
  if (!dates.length) {
    const now = calculatePortfolio([]);
    return [
      {
        date: "当前",
        cash: now.cash,
        marketValue: now.positions.reduce((sum, item) => sum + item.marketValue, 0),
        assets: now.cash + now.positions.reduce((sum, item) => sum + item.marketValue, 0),
        pnl: now.positions.reduce((sum, item) => sum + item.floating + item.realized, 0),
      },
    ];
  }

  return dates.map((date) => {
    const trades = state.trades.filter((trade) => trade.date <= date);
    const snapshot = calculatePortfolio(trades);
    const marketValue = snapshot.positions.reduce((sum, item) => sum + item.marketValue, 0);
    const totalPnl = snapshot.positions.reduce((sum, item) => sum + item.floating + item.realized, 0);
    return {
      date,
      cash: snapshot.cash,
      marketValue,
      assets: snapshot.cash + marketValue,
      pnl: totalPnl,
    };
  });
}

function jsonp(url, callbackName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 10000);

    window[callbackName] = (data) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("network"));
    };
    script.src = url;
    document.body.appendChild(script);
  });
}

async function fetchQuote(symbol) {
  const callbackName = `quote_${normalizeSymbol(symbol)}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const secid = marketSecid(symbol);
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${encodeURIComponent(secid)}&fields=f43,f57,f58,f152&cb=${callbackName}`;
  const result = await jsonp(url, callbackName);
  const data = result && result.data;
  if (!data || data.f43 === undefined || data.f43 === "-" || data.f43 === null) {
    throw new Error("empty quote");
  }
  const scale = Number(data.f152) || 2;
  const price = Number(data.f43) / 10 ** scale;
  return {
    symbol: data.f57 || normalizeSymbol(symbol),
    name: data.f58 || "",
    price,
  };
}

async function refreshQuotes() {
  const { positions } = calculatePortfolio();
  const symbols = [...new Set(positions.filter((position) => position.quantity > 0).map((position) => position.symbol))];

  if (!symbols.length) {
    els.quoteStatus.textContent = "暂无持仓可更新";
    return;
  }

  els.quoteStatus.textContent = `正在更新 ${symbols.length} 只股票...`;
  let success = 0;
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuote(symbol);
      state.prices[symbol] = Number(quote.price.toFixed(3));
      success += 1;
    } catch {
      // Keep the existing manual price when an individual quote fails.
    }
  }

  save();
  renderAll();
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  els.quoteStatus.textContent = success ? `已更新 ${success}/${symbols.length}，${time}` : "股价更新失败，可手动输入";
}

function initialPositionCost() {
  return state.initialPositions.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
}

function calculateTradePairPnL(startDate = "", endDate = "") {
  const books = new Map();
  const stageTrades = sortedTrades().filter((trade) => {
    if (startDate && trade.date < startDate) return false;
    if (endDate && trade.date > endDate) return false;
    return true;
  });

  for (const trade of stageTrades) {
    const key = normalizeSymbol(trade.symbol);
    const book = books.get(key) || {
      symbol: key,
      name: trade.name,
      buyLots: [],
      sellLots: [],
      matchedQuantity: 0,
      buyCost: 0,
      sellIncome: 0,
      pnl: 0,
    };
    const amount = tradeAmount(trade);
    const fee = totalFee(trade);
    const netAmount = trade.side === "sell" ? amount - fee : amount + fee;
    const unitNet = trade.quantity > 0 ? netAmount / trade.quantity : 0;

    book.name = trade.name || book.name;

    if (trade.side === "buy") {
      let remaining = trade.quantity;

      while (remaining > 0 && book.sellLots.length) {
        const lot = book.sellLots[0];
        const used = Math.min(remaining, lot.quantity);
        const buyCost = used * unitNet;
        const sellIncome = used * lot.unitIncome;
        book.matchedQuantity += used;
        book.buyCost += buyCost;
        book.sellIncome += sellIncome;
        book.pnl += sellIncome - buyCost;
        lot.quantity -= used;
        remaining -= used;
        if (lot.quantity <= 0.000001) book.sellLots.shift();
      }

      if (remaining > 0) {
        book.buyLots.push({
          quantity: remaining,
          unitCost: unitNet,
        });
      }
    } else {
      let remaining = trade.quantity;

      while (remaining > 0 && book.buyLots.length) {
        const lot = book.buyLots[0];
        const used = Math.min(remaining, lot.quantity);
        const buyCost = used * lot.unitCost;
        const sellIncome = used * unitNet;
        book.matchedQuantity += used;
        book.buyCost += buyCost;
        book.sellIncome += sellIncome;
        book.pnl += sellIncome - buyCost;
        lot.quantity -= used;
        remaining -= used;
        if (lot.quantity <= 0.000001) book.buyLots.shift();
      }

      if (remaining > 0) {
        book.sellLots.push({
          quantity: remaining,
          unitIncome: unitNet,
        });
      }
    }

    books.set(key, book);
  }

  return [...books.values()]
    .map((book) => {
      const unmatchedBuyQuantity = book.buyLots.reduce((sum, lot) => sum + lot.quantity, 0);
      const unmatchedSellQuantity = book.sellLots.reduce((sum, lot) => sum + lot.quantity, 0);
      return {
        ...book,
        unmatchedBuyQuantity,
        unmatchedSellQuantity,
        averageBuy: book.matchedQuantity > 0 ? book.buyCost / book.matchedQuantity : 0,
        averageSell: book.matchedQuantity > 0 ? book.sellIncome / book.matchedQuantity : 0,
      };
    })
    .filter((book) => book.matchedQuantity > 0 || book.unmatchedBuyQuantity > 0 || book.unmatchedSellQuantity > 0);
}

function portfolioTotals() {
  const { positions, cash } = calculatePortfolio();
  return positions.reduce(
    (acc, position) => {
      acc.cost += position.cost;
      acc.marketValue += position.marketValue;
      acc.floating += position.floating;
      acc.realized += position.realized;
      return acc;
    },
    { cash, assets: cash, cost: 0, marketValue: 0, floating: 0, realized: 0 },
  );
}

function setView(viewId) {
  els.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  els.pageTitle.textContent = titles[viewId] || "总览";
}

function classByValue(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "";
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.tradeDate.value = today();
  els.side.value = "buy";
  els.formHeading.textContent = "新增交易";
  document.querySelector("#save-trade").textContent = "保存交易";
  updatePreview();
}

function readTradeForm() {
  const existing = state.trades.find((item) => item.id === els.editingId.value);
  return {
    id: els.editingId.value || uid(),
    date: els.tradeDate.value,
    symbol: normalizeSymbol(els.symbol.value),
    name: els.name.value.trim(),
    side: els.side.value,
    price: Number(els.price.value),
    quantity: Number(els.quantity.value),
    note: els.note.value.trim(),
    createdAt: existing ? existing.createdAt : Date.now(),
  };
}

function updatePreview() {
  const trade = {
    side: els.side.value,
    price: Number(els.price.value) || 0,
    quantity: Number(els.quantity.value) || 0,
  };
  const fees = calcFees(trade);
  const amount = tradeAmount(trade);
  const fee = fees.commission + fees.stampTax + fees.transferFee;
  const net = trade.side === "sell" ? amount - fee : -(amount + fee);

  els.commission.value = fees.commission.toFixed(2);
  els.stampTax.value = fees.stampTax.toFixed(2);
  els.transferFee.value = fees.transferFee.toFixed(2);
  els.previewAmount.textContent = money(amount);
  els.previewFee.textContent = money(fee);
  els.previewNet.textContent = money(net);
}

function quantityAvailable(symbol, excludeTradeId = "") {
  const trades = state.trades.filter((trade) => trade.id !== excludeTradeId);
  const { positions } = calculatePortfolio(trades);
  const position = positions.find((item) => item.symbol === normalizeSymbol(symbol));
  return position ? position.quantity : 0;
}

function renderRecords() {
  const keyword = els.recordFilter.value.trim().toLowerCase();
  const pnlByTrade = new Map(calculatePortfolio().realizedRows.map((row) => [row.tradeId, row.pnl]));
  const records = [...state.trades]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
    .filter((trade) => `${trade.symbol} ${trade.name} ${trade.note}`.toLowerCase().includes(keyword));

  if (!records.length) {
    els.recordsBody.innerHTML = `<tr><td colspan="13" class="empty-state">还没有交易记录</td></tr>`;
    els.recordsCards.innerHTML = `<div class="empty-state">还没有交易记录</div>`;
    return;
  }

  els.recordsBody.innerHTML = records
    .map((trade) => {
      const fees = tradeFees(trade);
      return `
        <tr>
          <td>${trade.date}</td>
          <td>${trade.symbol}</td>
          <td>${trade.name}</td>
          <td><span class="tag ${trade.side}">${trade.side === "buy" ? "买入" : "卖出"}</span></td>
          <td>${number(trade.price, 3)}</td>
          <td>${trade.quantity}</td>
          <td>${money(tradeAmount(trade))}</td>
          <td>${money(fees.commission)}</td>
          <td>${money(fees.stampTax)}</td>
          <td>${money(fees.transferFee)}</td>
          <td class="${classByValue(pnlByTrade.get(trade.id) || 0)}">${trade.side === "sell" ? money(pnlByTrade.get(trade.id) || 0) : "-"}</td>
          <td>${trade.note || "-"}</td>
          <td>
            <div class="row-actions">
              <button class="icon-action" data-edit="${trade.id}">编辑</button>
              <button class="icon-action" data-delete="${trade.id}">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.recordsCards.innerHTML = records
    .map((trade) => {
      const fees = tradeFees(trade);
      const pnl = pnlByTrade.get(trade.id) || 0;
      return `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <strong>${trade.name}</strong>
            <span class="tag ${trade.side}">${trade.side === "buy" ? "买入" : "卖出"}</span>
          </div>
          <dl>
            <div><dt>日期</dt><dd>${trade.date}</dd></div>
            <div><dt>代码</dt><dd>${trade.symbol}</dd></div>
            <div><dt>价格</dt><dd>${number(trade.price, 3)}</dd></div>
            <div><dt>数量</dt><dd>${trade.quantity}</dd></div>
            <div><dt>金额</dt><dd>${money(tradeAmount(trade))}</dd></div>
            <div><dt>费用</dt><dd>${money(fees.commission + fees.stampTax + fees.transferFee)}</dd></div>
            <div><dt>FIFO盈亏</dt><dd class="${classByValue(pnl)}">${trade.side === "sell" ? money(pnl) : "-"}</dd></div>
          </dl>
          <p>${trade.note || "无备注"}</p>
          <div class="row-actions">
            <button class="icon-action" data-edit="${trade.id}">编辑</button>
            <button class="icon-action" data-delete="${trade.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPositions() {
  const { positions } = calculatePortfolio();
  const active = positions.filter((position) => position.quantity > 0 || position.realized !== 0);

  if (!active.length) {
    els.positionsBody.innerHTML = `<tr><td colspan="10" class="empty-state">暂无持仓，先录入初始持仓或买入交易</td></tr>`;
    els.positionsCards.innerHTML = `<div class="empty-state">暂无持仓，先录入初始持仓或买入交易</div>`;
    return;
  }

  const sorted = active.sort((a, b) => b.marketValue - a.marketValue);

  els.positionsBody.innerHTML = sorted
    .map(
      (position) => `
        <tr>
          <td>${position.symbol}</td>
          <td>${position.name}</td>
          <td>${number(position.quantity, 0)}</td>
          <td>${money(position.averageCost)}</td>
          <td>${money(position.cost)}</td>
          <td><input class="current-price-input" type="number" min="0" step="0.001" value="${position.currentPrice}" data-price-symbol="${position.symbol}" /></td>
          <td>${money(position.marketValue)}</td>
          <td class="${classByValue(position.floating)}">${money(position.floating)}</td>
          <td class="${classByValue(position.floating)}">${position.cost > 0 ? `${number((position.floating / position.cost) * 100, 2)}%` : "-"}</td>
          <td class="${classByValue(position.realized)}">${money(position.realized)}</td>
        </tr>
      `,
    )
    .join("");

  els.positionsCards.innerHTML = sorted
    .map(
      (position) => `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <strong>${position.name}</strong>
            <span>${position.symbol}</span>
          </div>
          <dl>
            <div><dt>数量</dt><dd>${number(position.quantity, 0)}</dd></div>
            <div><dt>平均成本</dt><dd>${money(position.averageCost)}</dd></div>
            <div><dt>持仓成本</dt><dd>${money(position.cost)}</dd></div>
            <div><dt>市值</dt><dd>${money(position.marketValue)}</dd></div>
            <div><dt>浮动盈亏</dt><dd class="${classByValue(position.floating)}">${money(position.floating)}</dd></div>
            <div><dt>收益率</dt><dd class="${classByValue(position.floating)}">${position.cost > 0 ? `${number((position.floating / position.cost) * 100, 2)}%` : "-"}</dd></div>
          </dl>
          <label class="mobile-price">
            当前价
            <input class="current-price-input" type="number" min="0" step="0.001" value="${position.currentPrice}" data-price-symbol="${position.symbol}" />
          </label>
        </article>
      `,
    )
    .join("");
}

function renderDashboard() {
  const totals = portfolioTotals();
  const { positions, realizedRows } = calculatePortfolio();
  const totalFees = state.trades.reduce((sum, trade) => sum + totalFee(trade), 0);
  const assets = totals.cash + totals.marketValue;
  const initialAssets = (Number(state.settings.initialCash) || 0) + initialPositionCost();
  const totalReturnRate = initialAssets > 0 ? ((assets - initialAssets) / initialAssets) * 100 : 0;
  const totalPnl = totals.floating + totals.realized;
  const sellCount = state.trades.filter((trade) => trade.side === "sell").length;
  const winCount = realizedRows.filter((row) => row.pnl > 0).length;
  const winRate = sellCount ? (winCount / sellCount) * 100 : 0;

  els.assets.textContent = money(assets);
  els.totalReturn.textContent = `${number(totalReturnRate, 2)}%`;
  els.cash.textContent = money(totals.cash);
  els.marketValue.textContent = money(totals.marketValue);
  els.cost.textContent = money(totals.cost);
  els.floating.textContent = money(totalPnl);
  els.realized.textContent = money(totals.realized);
  els.totalFees.textContent = money(totalFees);
  els.totalReturn.className = classByValue(totalReturnRate);
  els.cash.className = classByValue(totals.cash);
  els.floating.className = classByValue(totalPnl);
  els.realized.className = classByValue(totals.realized);
  els.summaryCount.textContent = `${state.trades.length} 笔交易`;

  renderAllocation(positions);
  renderEquityCurve();
  renderTradePairPnL();
}

function renderAllocation(positions) {
  const open = positions.filter((position) => position.quantity > 0 && position.marketValue > 0);
  const total = open.reduce((sum, position) => sum + position.marketValue, 0);
  const colors = ["#176b87", "#c23b42", "#18805f", "#b76e00", "#5a4fcf", "#0f8b8d", "#9b5de5", "#ef476f"];

  if (!open.length || total <= 0) {
    els.allocationPie.style.background = "#eef3f8";
    els.allocationPie.innerHTML = `<span>暂无市值</span>`;
    els.allocationList.innerHTML = `<div class="empty-state">输入持仓当前价后显示仓位饼图</div>`;
    return;
  }

  let cursor = 0;
  const segments = open
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((position, index) => {
      const start = cursor;
      const percent = (position.marketValue / total) * 100;
      cursor += percent;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });

  els.allocationPie.style.background = `conic-gradient(${segments.join(", ")})`;
  els.allocationPie.innerHTML = `<span>${money(total)}</span>`;
  els.allocationList.innerHTML = open
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((position, index) => {
      const percent = (position.marketValue / total) * 100;
      const color = colors[index % colors.length];
      return `
        <div class="allocation-row">
          <span class="swatch" style="background: ${color}"></span>
          <strong>${position.name}</strong>
          <span>${number(percent, 1)}%</span>
          <span>${money(position.marketValue)}</span>
        </div>
      `;
    })
    .join("");
}

function renderEquityCurve() {
  const chronological = calculateEquityCurve();
  const rows = chronological.slice(-8).reverse();
  renderEquityChart(chronological);

  els.equityCurveBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.date}</td>
          <td>${money(row.cash)}</td>
          <td>${money(row.marketValue)}</td>
          <td>${money(row.assets)}</td>
          <td class="${classByValue(row.pnl)}">${money(row.pnl)}</td>
        </tr>
      `,
    )
    .join("");

  els.equityCurveCards.innerHTML = rows
    .map(
      (row) => `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <strong>${row.date}</strong>
            <span class="${classByValue(row.pnl)}">${money(row.pnl)}</span>
          </div>
          <dl>
            <div><dt>现金</dt><dd>${money(row.cash)}</dd></div>
            <div><dt>市值</dt><dd>${money(row.marketValue)}</dd></div>
            <div><dt>总资产</dt><dd>${money(row.assets)}</dd></div>
            <div><dt>总盈亏</dt><dd class="${classByValue(row.pnl)}">${money(row.pnl)}</dd></div>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderEquityChart(rows) {
  if (!rows.length) {
    els.equityChart.innerHTML = `<div class="empty-state">暂无资金曲线</div>`;
    return;
  }

  const width = 520;
  const height = 180;
  const pad = 18;
  const values = rows.map((row) => row.assets);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : pad + (index / (rows.length - 1)) * (width - pad * 2);
    const y = height - pad - ((row.assets - min) / span) * (height - pad * 2);
    return { x, y, row };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  const last = points[points.length - 1];

  els.equityChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="资金曲线">
      <polyline class="equity-grid" points="${pad},${pad} ${pad},${height - pad} ${width - pad},${height - pad}" />
      <polygon class="equity-area" points="${area}" />
      <polyline class="equity-line" points="${line}" />
      ${points.map((point) => `<circle class="equity-dot" cx="${point.x}" cy="${point.y}" r="3"></circle>`).join("")}
      <text class="equity-label" x="${Math.min(last.x + 8, width - 130)}" y="${Math.max(last.y - 8, 18)}">${money(last.row.assets)}</text>
    </svg>
  `;
}

function renderTradePairPnL() {
  const rows = calculateTradePairPnL(els.pairStartDate.value, els.pairEndDate.value).sort((a, b) => b.pnl - a.pnl);

  if (!rows.length) {
    els.tradePairPnlBody.innerHTML = `<tr><td colspan="10" class="empty-state">暂无可配对的买卖记录。初始持仓成本不会计入这里。</td></tr>`;
    els.tradePairPnlCards.innerHTML = `<div class="empty-state">暂无可配对的买卖记录。初始持仓成本不会计入这里。</div>`;
    return;
  }

  els.tradePairPnlBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.symbol}</td>
          <td>${row.name}</td>
          <td>${number(row.matchedQuantity, 0)}</td>
          <td>${money(row.buyCost)}</td>
          <td>${money(row.sellIncome)}</td>
          <td class="${classByValue(row.pnl)}">${money(row.pnl)}</td>
          <td>${money(row.averageBuy)}</td>
          <td>${money(row.averageSell)}</td>
          <td>${number(row.unmatchedBuyQuantity, 0)}</td>
          <td>${number(row.unmatchedSellQuantity, 0)}</td>
        </tr>
      `,
    )
    .join("");

  els.tradePairPnlCards.innerHTML = rows
    .map(
      (row) => `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <strong>${row.name}</strong>
            <span>${row.symbol}</span>
          </div>
          <dl>
            <div><dt>已配对</dt><dd>${number(row.matchedQuantity, 0)}</dd></div>
            <div><dt>买入成本</dt><dd>${money(row.buyCost)}</dd></div>
            <div><dt>卖出收入</dt><dd>${money(row.sellIncome)}</dd></div>
            <div><dt>实现盈亏</dt><dd class="${classByValue(row.pnl)}">${money(row.pnl)}</dd></div>
            <div><dt>平均买价</dt><dd>${money(row.averageBuy)}</dd></div>
            <div><dt>平均卖价</dt><dd>${money(row.averageSell)}</dd></div>
            <div><dt>未配买入</dt><dd>${number(row.unmatchedBuyQuantity, 0)}</dd></div>
            <div><dt>未配卖出</dt><dd>${number(row.unmatchedSellQuantity, 0)}</dd></div>
          </dl>
        </article>
      `,
    )
    .join("");
}

function renderSettings() {
  els.initialCash.value = state.settings.initialCash;
  els.commissionRate.value = state.settings.commissionRate;
  els.minCommission.value = state.settings.minCommission;
  els.stampRate.value = state.settings.stampRate;
  els.transferRate.value = state.settings.transferRate;

  if (!state.initialPositions.length) {
    els.initialPositionsBody.innerHTML = `<tr><td colspan="8" class="empty-state">暂无初始持仓</td></tr>`;
    els.initialPositionsCards.innerHTML = `<div class="empty-state">暂无初始持仓</div>`;
    return;
  }

  els.initialPositionsBody.innerHTML = state.initialPositions
    .map(
      (item) => `
        <tr>
          <td>${item.date || "-"}</td>
          <td>${item.symbol}</td>
          <td>${item.name}</td>
          <td>${number(item.quantity, 0)}</td>
          <td>${money(item.cost)}</td>
          <td>${money(item.quantity > 0 ? item.cost / item.quantity : 0)}</td>
          <td>${state.prices[item.symbol] ? money(state.prices[item.symbol]) : "-"}</td>
          <td>
            <div class="row-actions">
              <button class="icon-action" data-edit-initial="${item.id}">编辑</button>
              <button class="icon-action" data-delete-initial="${item.id}">删除</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  els.initialPositionsCards.innerHTML = state.initialPositions
    .map(
      (item) => `
        <article class="mobile-card">
          <div class="mobile-card-head">
            <strong>${item.name}</strong>
            <span>${item.symbol}</span>
          </div>
          <dl>
            <div><dt>日期</dt><dd>${item.date || "-"}</dd></div>
            <div><dt>数量</dt><dd>${number(item.quantity, 0)}</dd></div>
            <div><dt>总成本</dt><dd>${money(item.cost)}</dd></div>
            <div><dt>平均成本</dt><dd>${money(item.quantity > 0 ? item.cost / item.quantity : 0)}</dd></div>
            <div><dt>当前价</dt><dd>${state.prices[item.symbol] ? money(state.prices[item.symbol]) : "-"}</dd></div>
          </dl>
          <div class="row-actions">
            <button class="icon-action" data-edit-initial="${item.id}">编辑</button>
            <button class="icon-action" data-delete-initial="${item.id}">删除</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderAll() {
  renderDashboard();
  renderPositions();
  renderRecords();
  renderSettings();
}

function editTrade(id) {
  const trade = state.trades.find((item) => item.id === id);
  if (!trade) return;

  els.editingId.value = trade.id;
  els.tradeDate.value = trade.date;
  els.symbol.value = trade.symbol;
  els.name.value = trade.name;
  els.side.value = trade.side;
  els.price.value = trade.price;
  els.quantity.value = trade.quantity;
  els.note.value = trade.note;
  els.formHeading.textContent = "编辑交易";
  document.querySelector("#save-trade").textContent = "更新交易";
  updatePreview();
  setView("trade-form");
}

function deleteTrade(id) {
  if (!confirm("确定删除这笔交易吗？")) return;
  state.trades = state.trades.filter((item) => item.id !== id);
  save();
  renderAll();
}

function resetInitialPositionForm() {
  els.editingInitialId.value = "";
  els.initialSymbol.value = "";
  els.initialName.value = "";
  els.initialQuantity.value = "";
  els.initialCost.value = "";
  els.initialPrice.value = "";
  els.initialDate.value = today();
  els.initialPositionMode.textContent = "用于录入开始使用工具之前已经持有的股票";
  document.querySelector("#add-initial-position").textContent = "添加初始持仓";
}

function editInitialPosition(id) {
  const item = state.initialPositions.find((position) => position.id === id);
  if (!item) return;

  els.editingInitialId.value = item.id;
  els.initialSymbol.value = item.symbol;
  els.initialName.value = item.name;
  els.initialQuantity.value = item.quantity;
  els.initialCost.value = item.cost;
  els.initialPrice.value = state.prices[item.symbol] || "";
  els.initialDate.value = item.date || today();
  els.initialPositionMode.textContent = "正在编辑初始持仓，保存后会重新计算账户";
  document.querySelector("#add-initial-position").textContent = "保存初始持仓";
  setView("settings");
}

function addInitialPosition() {
  const item = {
    id: els.editingInitialId.value || uid(),
    date: els.initialDate.value || today(),
    symbol: normalizeSymbol(els.initialSymbol.value),
    name: els.initialName.value.trim(),
    quantity: Number(els.initialQuantity.value),
    cost: Number(els.initialCost.value),
  };

  if (!item.symbol || !item.name || item.quantity <= 0 || item.cost < 0) {
    alert("请完整填写初始持仓的代码、名称、数量和总成本。");
    return;
  }

  const index = state.initialPositions.findIndex((position) => position.id === item.id);
  if (index >= 0) state.initialPositions[index] = item;
  else state.initialPositions.push(item);

  if (els.initialPrice.value) state.prices[item.symbol] = els.initialPrice.value;
  resetInitialPositionForm();
  save();
  renderAll();
}

function fillSampleData() {
  if ((state.trades.length || state.initialPositions.length) && !confirm("示例数据会追加到当前记录中，继续吗？")) return;

  state.settings.initialCash = state.settings.initialCash || 100000;
  state.initialPositions.push({
    id: uid(),
    date: "2026-04-01",
    symbol: "600519",
    name: "贵州茅台",
    quantity: 100,
    cost: 168000,
  });
  state.trades.push(
    {
      id: uid(),
      date: "2026-04-16",
      symbol: "600519",
      name: "贵州茅台",
      side: "sell",
      price: 1712,
      quantity: 40,
      note: "部分止盈",
      createdAt: Date.now(),
    },
    {
      id: uid(),
      date: "2026-04-19",
      symbol: "300750",
      name: "宁德时代",
      side: "buy",
      price: 188.2,
      quantity: 300,
      note: "回调试仓",
      createdAt: Date.now() + 1,
    },
    {
      id: uid(),
      date: "2026-04-22",
      symbol: "600519",
      name: "贵州茅台",
      side: "buy",
      price: 1668,
      quantity: 20,
      note: "卖出后低价接回",
      createdAt: Date.now() + 2,
    },
  );
  state.prices = { ...state.prices, 600519: 1720, 300750: 184.5 };
  save();
  renderAll();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ashare-trading-journal-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = JSON.parse(reader.result);
      state.trades = Array.isArray(next.trades) ? next.trades : [];
      state.prices = next.prices && typeof next.prices === "object" ? next.prices : {};
      state.initialPositions = Array.isArray(next.initialPositions) ? next.initialPositions : [];
      state.settings = { ...defaultSettings, ...(next.settings || {}) };
      save();
      renderAll();
      alert("导入完成");
    } catch {
      alert("导入失败，请确认文件是本工具导出的 JSON。");
    }
  };
  reader.readAsText(file);
}

els.navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.jump));
});

els.form.addEventListener("input", updatePreview);
els.side.addEventListener("change", updatePreview);
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const trade = readTradeForm();

  if (!trade.date || !trade.symbol || !trade.name || trade.price <= 0 || trade.quantity <= 0) {
    alert("请完整填写日期、代码、名称、价格和数量。");
    return;
  }

  if (trade.side === "sell") {
    const available = quantityAvailable(trade.symbol, trade.id);
    if (trade.quantity > available) {
      alert(`可卖数量不足。当前 ${trade.symbol} 可按FIFO卖出 ${number(available, 0)} 股。`);
      return;
    }
  }

  const index = state.trades.findIndex((item) => item.id === trade.id);
  if (index >= 0) state.trades[index] = trade;
  else state.trades.push(trade);

  save();
  resetForm();
  renderAll();
  setView("records");
});

document.querySelector("#reset-form").addEventListener("click", resetForm);
document.querySelector("#sample-data").addEventListener("click", fillSampleData);
document.querySelector("#export-data").addEventListener("click", exportData);
document.querySelector("#save-account").addEventListener("click", () => {
  state.settings.initialCash = Number(els.initialCash.value) || 0;
  save();
  renderAll();
});
document.querySelector("#save-fees").addEventListener("click", () => {
  state.settings.commissionRate = Number(els.commissionRate.value) || 0;
  state.settings.minCommission = Number(els.minCommission.value) || 0;
  state.settings.stampRate = Number(els.stampRate.value) || 0;
  state.settings.transferRate = Number(els.transferRate.value) || 0;
  save();
  updatePreview();
  renderAll();
});
document.querySelector("#add-initial-position").addEventListener("click", addInitialPosition);
optionalElement("#reset-initial-position").addEventListener("click", resetInitialPositionForm);
optionalElement("#clear-initial-positions").addEventListener("click", () => {
  if (!confirm("确定清空全部初始持仓吗？交易记录不会删除。")) return;
  state.initialPositions = [];
  resetInitialPositionForm();
  save();
  renderAll();
});
optionalElement("#refresh-quotes").addEventListener("click", refreshQuotes);
document.querySelector("#clear-data").addEventListener("click", () => {
  if (!confirm("确定清空全部数据吗？")) return;
  state.trades = [];
  state.prices = {};
  state.initialPositions = [];
  state.settings = { ...defaultSettings };
  save();
  renderAll();
});

document.querySelector("#import-data").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importData(file);
  event.target.value = "";
});

els.recordFilter.addEventListener("input", renderRecords);
els.pairStartDate.addEventListener("change", renderTradePairPnL);
els.pairEndDate.addEventListener("change", renderTradePairPnL);
els.recordsBody.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) editTrade(editId);
  if (deleteId) deleteTrade(deleteId);
});

els.recordsCards.addEventListener("click", (event) => {
  const editId = event.target.dataset.edit;
  const deleteId = event.target.dataset.delete;
  if (editId) editTrade(editId);
  if (deleteId) deleteTrade(deleteId);
});

els.positionsBody.addEventListener("input", (event) => {
  const symbol = event.target.dataset.priceSymbol;
  if (!symbol) return;
  state.prices[symbol] = event.target.value;
  save();
  renderDashboard();
});

els.positionsCards.addEventListener("input", (event) => {
  const symbol = event.target.dataset.priceSymbol;
  if (!symbol) return;
  state.prices[symbol] = event.target.value;
  save();
  renderDashboard();
});

els.positionsBody.addEventListener("change", (event) => {
  if (event.target.dataset.priceSymbol) renderPositions();
});

els.positionsCards.addEventListener("change", (event) => {
  if (event.target.dataset.priceSymbol) renderPositions();
});

els.initialPositionsBody.addEventListener("click", (event) => {
  const editId = event.target.dataset.editInitial;
  const id = event.target.dataset.deleteInitial;
  if (editId) {
    editInitialPosition(editId);
    return;
  }
  if (!id) return;
  state.initialPositions = state.initialPositions.filter((item) => item.id !== id);
  save();
  renderAll();
});

els.initialPositionsCards.addEventListener("click", (event) => {
  const editId = event.target.dataset.editInitial;
  const id = event.target.dataset.deleteInitial;
  if (editId) {
    editInitialPosition(editId);
    return;
  }
  if (!id) return;
  state.initialPositions = state.initialPositions.filter((item) => item.id !== id);
  save();
  renderAll();
});

load();
resetForm();
resetInitialPositionForm();
renderAll();
window.setTimeout(refreshQuotes, 800);
window.setInterval(() => {
  if (!document.hidden) refreshQuotes();
}, 60000);
