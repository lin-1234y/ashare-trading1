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
  recordsCards: document.querySelector("#records-cards"),
  positionsBody: document.querySelector("#positions-body"),
  positionsCards: document.querySelector("#positions-cards"),
  recordFilter: document.querySelector("#record-filter"),
  summaryCount: document.querySelector("#summary-count"),
  insights: document.querySelector("#insights"),
  profitBars: document.querySelector("#profit-bars"),
  assets: document.querySelector("#metric-assets"),
  totalReturn: document.querySelector("#metric-total-return"),
  cash: document.querySelector("#metric-cash"),
  marketValue: document.querySelector("#metric-market-value"),
  cost: document.querySelector("#metric-cost"),
  floating: document.querySelector("#metric-floating"),
  realized: document.querySelector("#metric-realized"),
  tradePairPnlBody: document.querySelector("#trade-pair-pnl-body"),
  tradePairPnlCards: document.querySelector("#trade-pair-pnl-cards"),
  pairStartDate: document.querySelector("#pair-start-date"),
  pairEndDate: document.querySelector("#pair-end-date"),
  initialCash: document.querySelector("#initial-cash"),
  commissionRate: document.querySelector("#commission-rate"),
  minCommission: document.querySelector("#min-commission"),
  stampRate: document.querySelector("#stamp-rate"),
  transferRate: document.querySelector("#transfer-rate"),
  initialSymbol: document.querySelector("#initial-symbol"),
  initialName: document.querySelector("#initial-name"),
  initialQuantity: document.querySelector("#initial-quantity"),
  initialCost: document.querySelector("#initial-cost"),
  initialPrice: document.querySelector("#initial-price"),
  initialDate: document.querySelector("#initial-date"),
  initialPositionsBody: document.querySelector("#initial-positions-body"),
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
    id: els.editingId.value || crypto.randomUUID(),
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
  const sellCount = state.trades.filter((trade) => trade.side === "sell").length;
  const winCount = realizedRows.filter((row) => row.pnl > 0).length;
  const winRate = sellCount ? (winCount / sellCount) * 100 : 0;

  els.assets.textContent = money(assets);
  els.totalReturn.textContent = `${number(totalReturnRate, 2)}%`;
  els.cash.textContent = money(totals.cash);
  els.marketValue.textContent = money(totals.marketValue);
  els.cost.textContent = money(totals.cost);
  els.floating.textContent = money(totals.floating);
  els.realized.textContent = money(totals.realized);
  els.totalReturn.className = classByValue(totalReturnRate);
  els.cash.className = classByValue(totals.cash);
  els.floating.className = classByValue(totals.floating);
  els.realized.className = classByValue(totals.realized);
  els.summaryCount.textContent = `${state.trades.length} 笔交易`;

  const bars = [
    ["现金", totals.cash],
    ["市值", totals.marketValue],
    ["成本", totals.cost],
    ["浮盈", totals.floating],
    ["已实现", totals.realized],
    ["费用", -totalFees],
  ];
  const max = Math.max(...bars.map(([, value]) => Math.abs(value)), 1);
  els.profitBars.innerHTML = bars
    .map(([label, value]) => {
      const width = Math.max((Math.abs(value) / max) * 100, value === 0 ? 0 : 4);
      return `
        <div class="bar-row">
          <span>${label}</span>
          <div class="bar-track"><div class="bar-fill ${value < 0 ? "loss" : ""}" style="width: ${width}%"></div></div>
          <strong class="${classByValue(value)}">${money(value)}</strong>
        </div>
      `;
    })
    .join("");

  const openPositions = positions.filter((position) => position.quantity > 0);
  const largest = [...openPositions].sort((a, b) => b.marketValue - a.marketValue)[0];
  const insights = [];

  if (!state.trades.length && !state.initialPositions.length) {
    insights.push("先在设置里录入初始现金和初始持仓，或直接新增一笔买入交易。");
  } else {
    insights.push(`当前总资产 ${money(assets)}，总收益率约 ${number(totalReturnRate, 2)}%。`);
    insights.push(`卖出按 FIFO 结转成本，当前卖出胜率约 ${number(winRate, 1)}%。`);
    insights.push(`按当前费用规则累计交易费用 ${money(totalFees)}。`);
    if (largest && totals.marketValue > 0) {
      const weight = (largest.marketValue / totals.marketValue) * 100;
      insights.push(`第一大持仓是 ${largest.name}，占持仓市值约 ${number(weight, 1)}%。`);
    }
  }

  els.insights.innerHTML = insights.map((item) => `<li>${item}</li>`).join("");
  renderTradePairPnL();
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
    els.initialPositionsBody.innerHTML = `<tr><td colspan="7" class="empty-state">暂无初始持仓</td></tr>`;
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
          <td><button class="icon-action" data-delete-initial="${item.id}">删除</button></td>
        </tr>
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

function addInitialPosition() {
  const item = {
    id: crypto.randomUUID(),
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

  state.initialPositions.push(item);
  if (els.initialPrice.value) state.prices[item.symbol] = els.initialPrice.value;
  els.initialSymbol.value = "";
  els.initialName.value = "";
  els.initialQuantity.value = "";
  els.initialCost.value = "";
  els.initialPrice.value = "";
  els.initialDate.value = today();
  save();
  renderAll();
}

function fillSampleData() {
  if ((state.trades.length || state.initialPositions.length) && !confirm("示例数据会追加到当前记录中，继续吗？")) return;

  state.settings.initialCash = state.settings.initialCash || 100000;
  state.initialPositions.push({
    id: crypto.randomUUID(),
    date: "2026-04-01",
    symbol: "600519",
    name: "贵州茅台",
    quantity: 100,
    cost: 168000,
  });
  state.trades.push(
    {
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
  const id = event.target.dataset.deleteInitial;
  if (!id) return;
  state.initialPositions = state.initialPositions.filter((item) => item.id !== id);
  save();
  renderAll();
});

load();
resetForm();
els.initialDate.value = today();
renderAll();
