(function setupPWA() {
  try {
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <defs>
        <linearGradient id="loki" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6ee7b7"/>
          <stop offset="40%" stop-color="#10b981"/>
          <stop offset="75%" stop-color="#059669"/>
          <stop offset="100%" stop-color="#022c22"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#f8fafc"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="310" fill="url(#loki)">A</text>
    </svg>`;
    const iconDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgIcon);

    const appleIcon = document.getElementById('pwaAppleIcon');
    if (appleIcon) appleIcon.href = iconDataUri;

    const manifestObj = {
      name: 'AURORA',
      short_name: 'AURORA',
      description: 'Precisão absoluta em cada lançamento.',
      start_url: window.location.href.split('#')[0],
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f8fafc',
      theme_color: '#059669',
      icons: [
        {
          src: iconDataUri,
          sizes: '512x512',
          type: 'image/svg+xml',
          purpose: 'any maskable'
        }
      ]
    };

    const manifestBlob = new Blob([JSON.stringify(manifestObj)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const manifestLink = document.getElementById('pwaManifestLink');
    if (manifestLink) manifestLink.href = manifestUrl;

    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.protocol === 'http:')) {
      const swCode = `
        const CACHE_NAME = 'aurora-offline-v1';
        const ASSETS_TO_CACHE = [
          self.location.href,
          'https://cdn.tailwindcss.com',
          'https://unpkg.com/@phosphor-icons/web'
        ];

        self.addEventListener('install', (event) => {
          self.skipWaiting();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => {
              return Promise.allSettled(
                ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => null))
              );
            })
          );
        });

        self.addEventListener('activate', (event) => {
          event.waitUntil(
            caches.keys().then((keys) =>
              Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
          );
          self.clients.claim();
        });

        self.addEventListener('fetch', (event) => {
          if (event.request.method !== 'GET') return;
          event.respondWith(
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseClone = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                }
                return networkResponse;
              })
              .catch(() => caches.match(event.request))
          );
        });
      `;
      const swBlob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }
  } catch (err) {
    console.warn('PWA init warning:', err);
  }
})();

function triggerHaptic(pattern = 25) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch (_) {}
}

const defaultProducts = [
  { id: 1, name: 'Café Expresso', category: 'Bebidas', price: 4.50 },
  { id: 2, name: 'Refrigerante 350ml', category: 'Bebidas', price: 6.00 },
  { id: 3, name: 'Salgado Assado', category: 'Alimentos', price: 7.50 },
  { id: 4, name: 'Sanduíche Natural', category: 'Alimentos', price: 10.00 }
];

let products = JSON.parse(localStorage.getItem('aurora_products')) || defaultProducts;
let records = JSON.parse(localStorage.getItem('aurora_records')) || [];
let userName = localStorage.getItem('aurora_username') || '';
let savedThemeColor = localStorage.getItem('aurora_theme_color') || '#059669';
let productQuantities = {};
let pendingConfirmAction = null;

let reportFilterMode = 'today';
let reportCustomDateStr = '';

function saveState() {
  localStorage.setItem('aurora_products', JSON.stringify(products));
  localStorage.setItem('aurora_records', JSON.stringify(records));
}

function formatCurrency(val) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function showToast(title, desc, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const borderColor = type === 'danger' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900';
  const icon = type === 'danger' ? 'ph-warning-circle text-rose-600' : 'ph-check-circle text-emerald-600';

  toast.className = `pointer-events-auto flex items-center space-x-3 p-3.5 rounded-2xl border shadow-lg transition-all animate-bounce ${borderColor}`;
  toast.innerHTML = `
    <i class="ph-bold ${icon} text-xl flex-shrink-0"></i>
    <div class="flex-1 min-w-0">
      <div class="font-bold text-xs">${title}</div>
      <div class="text-[11px] opacity-90 truncate">${desc}</div>
    </div>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function applyThemeColor(color) {
  savedThemeColor = color;
  localStorage.setItem('aurora_theme_color', color);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', color);
  document.documentElement.style.setProperty('--accent-light', '#ecfdf5');
  document.documentElement.style.setProperty('--accent-soft', '#d1fae5');
  document.documentElement.style.setProperty('--accent-border', '#a7f3d0');
  document.documentElement.style.setProperty('--accent-text', '#065f46');
  document.documentElement.style.setProperty('--accent-shadow', 'rgba(5, 150, 105, 0.25)');

  const picker = document.getElementById('customColorPicker');
  if (picker) picker.value = color;
}

function openColorModal() {
  triggerHaptic(20);
  document.getElementById('colorModal').classList.remove('hidden');
}

function closeColorModal() {
  document.getElementById('colorModal').classList.add('hidden');
}

function initUserGreeting() {
  const el = document.getElementById('userGreeting');
  if (!el) return;
  if (!userName) {
    el.innerText = 'Olá, Visitante';
    openWelcomeModal(false);
  } else {
    el.innerText = `Olá, ${userName}`;
  }
}

function openWelcomeModal(forced) {
  if (forced) triggerHaptic(20);
  document.getElementById('welcomeModal').classList.remove('hidden');
  const input = document.getElementById('userNameInput');
  if (input && userName) input.value = userName;
}

function handleSaveUserName(e) {
  e.preventDefault();
  const input = document.getElementById('userNameInput');
  const val = input ? input.value.trim() : '';
  if (val) {
    userName = val;
    localStorage.setItem('aurora_username', userName);
    document.getElementById('welcomeModal').classList.add('hidden');
    initUserGreeting();
    triggerHaptic(30);
    showToast('Boas-vindas', `Tudo pronto, ${userName}!`, 'success');
  }
}

function openConfirmModal(title, message, onConfirm) {
  document.getElementById('confirmModalTitle').innerText = title;
  document.getElementById('confirmModalMessage').innerText = message;
  pendingConfirmAction = onConfirm;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
  pendingConfirmAction = null;
  document.getElementById('confirmModal').classList.add('hidden');
}

document.getElementById('confirmModalActionBtn')?.addEventListener('click', () => {
  if (typeof pendingConfirmAction === 'function') {
    pendingConfirmAction();
  }
  closeConfirmModal();
});

function switchTab(tabId, btn) {
  triggerHaptic(20);
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
  document.querySelectorAll('.nav-tab-btn').forEach(b => {
    b.classList.remove('active', 'theme-bg', 'theme-shadow', 'text-white', 'font-bold');
    b.classList.add('text-slate-500', 'hover:text-slate-900', 'hover:bg-slate-100', 'font-semibold');
  });

  document.getElementById(tabId).classList.remove('hidden');
  btn.classList.add('active', 'theme-bg', 'theme-shadow', 'text-white', 'font-bold');
  btn.classList.remove('text-slate-500', 'hover:text-slate-900', 'hover:bg-slate-100', 'font-semibold');

  if (tabId === 'launchTab') renderLaunchScreen();
  if (tabId === 'catalogTab') renderCatalogScreen();
  if (tabId === 'reportTab') renderReportScreen();
}

function changeQty(id, delta) {
  triggerHaptic(20);
  const current = productQuantities[id] || 1;
  const next = Math.max(1, current + delta);
  productQuantities[id] = next;
  const el = document.getElementById(`qty-${id}`);
  if (el) el.innerText = next;
}

function addRecord(productId) {
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  triggerHaptic([35, 30, 35]);
  const qty = productQuantities[productId] || 1;
  const total = qty * prod.price;
  const now = new Date();

  records.unshift({
    id: Date.now(),
    productName: prod.name,
    category: prod.category,
    unitPrice: prod.price,
    quantity: qty,
    totalPrice: total,
    date: now.toLocaleDateString('pt-BR'),
    time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  });

  saveState();
  productQuantities[productId] = 1;
  const el = document.getElementById(`qty-${productId}`);
  if (el) el.innerText = 1;

  showToast(`Lançado: ${qty}x ${prod.name}`, `Valor: ${formatCurrency(total)}`, 'success');
}

function renderLaunchScreen() {
  const container = document.getElementById('launchGroupedContainer');
  const emptyState = document.getElementById('launchEmpty');
  const search = (document.getElementById('launchSearch')?.value || '').trim().toLowerCase();

  if (!container || !emptyState) return;
  container.innerHTML = '';

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  const grouped = {};
  filtered.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  for (const [category, items] of Object.entries(grouped)) {
    const block = document.createElement('div');
    block.className = 'space-y-2.5';
    block.innerHTML = `
      <div class="flex items-center space-x-2">
        <span class="theme-bg-soft theme-text-dark px-2.5 py-1 font-extrabold text-[11px] uppercase tracking-wider rounded-lg">
          ${category}
        </span>
        <div class="h-px bg-slate-200 flex-1"></div>
      </div>
      <div class="space-y-2.5 cards-list"></div>
    `;
    container.appendChild(block);

    const list = block.querySelector('.cards-list');
    items.forEach(p => {
      if (!productQuantities[p.id]) productQuantities[p.id] = 1;

      const card = document.createElement('div');
      card.className = 'bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3';
      card.innerHTML = `
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-slate-900 text-sm truncate">${p.name}</h3>
          <div class="theme-text text-base font-extrabold mt-0.5">${formatCurrency(p.price)}</div>
        </div>

        <div class="flex items-center space-x-2 flex-shrink-0">
          <div class="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5">
            <button type="button" onclick="changeQty(${p.id}, -1)" class="w-9 h-9 rounded-lg bg-white text-slate-700 font-extrabold text-base flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer">-</button>
            <span id="qty-${p.id}" class="w-8 text-center text-xs font-extrabold text-slate-900 select-none">${productQuantities[p.id]}</span>
            <button type="button" onclick="changeQty(${p.id}, 1)" class="w-9 h-9 rounded-lg bg-white text-slate-700 font-extrabold text-base flex items-center justify-center shadow-sm active:scale-95 transition cursor-pointer">+</button>
          </div>

          <button type="button" onclick="addRecord(${p.id})" class="theme-bg theme-shadow h-10 px-3.5 active:scale-95 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center cursor-pointer">
            Lançar
          </button>
        </div>
      `;
      list.appendChild(card);
    });
  }
}

function renderCatalogScreen() {
  const container = document.getElementById('catalogList');
  const label = document.getElementById('catalogCountLabel');
  const search = (document.getElementById('catalogSearch')?.value || '').trim().toLowerCase();
  if (!container || !label) return;
  container.innerHTML = '';

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search) || p.category.toLowerCase().includes(search)
  );

  label.innerText = `${products.length} ${products.length === 1 ? 'item' : 'itens'}`;

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-6">Nenhum produto encontrado.</p>`;
    return;
  }

  filtered.forEach(p => {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl';
    row.innerHTML = `
      <div class="min-w-0 flex-1 pr-2">
        <h4 class="font-bold text-sm text-slate-900 truncate">${p.name}</h4>
        <div class="flex items-center space-x-2 mt-0.5">
          <span class="theme-bg-soft theme-text-dark text-[10px] font-bold px-2 py-0.5 rounded-md">${p.category}</span>
          <span class="theme-text text-xs font-extrabold">${formatCurrency(p.price)}</span>
        </div>
      </div>
      <div class="flex items-center space-x-1.5 flex-shrink-0">
        <button type="button" onclick="openEditProductModal(${p.id})" title="Editar Produto" class="w-9 h-9 rounded-xl bg-white border border-slate-200 theme-text hover:bg-slate-100 flex items-center justify-center active:scale-95 transition cursor-pointer">
          <i class="ph-bold ph-pencil-simple text-base"></i>
        </button>
        <button type="button" onclick="requestDeleteProduct(${p.id})" title="Excluir Produto" class="w-9 h-9 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center active:scale-95 transition cursor-pointer">
          <i class="ph-bold ph-trash text-base"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function openEditProductModal(id) {
  triggerHaptic(20);
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('editProdId').value = prod.id;
  document.getElementById('editCatInput').value = prod.category;
  document.getElementById('editNameInput').value = prod.name;
  document.getElementById('editPriceInput').value = prod.price.toFixed(2);
  document.getElementById('editProductModal').classList.remove('hidden');
}

function closeEditProductModal() {
  document.getElementById('editProductModal').classList.add('hidden');
}

function handleUpdateProduct(e) {
  e.preventDefault();
  const id = Number(document.getElementById('editProdId').value);
  const category = document.getElementById('editCatInput').value.trim();
  const name = document.getElementById('editNameInput').value.trim();
  const price = parseFloat(document.getElementById('editPriceInput').value);

  if (!category || !name || isNaN(price) || price <= 0) return;

  const idx = products.findIndex(p => p.id === id);
  if (idx !== -1) {
    products[idx] = { ...products[idx], category, name, price };
    saveState();
    closeEditProductModal();
    renderCatalogScreen();
    renderLaunchScreen();
    triggerHaptic(30);
    showToast('Produto Atualizado', `${name} (${formatCurrency(price)}) salvo.`, 'success');
  }
}

function handleCreateProduct(e) {
  e.preventDefault();
  const catInput = document.getElementById('catInput');
  const nameInput = document.getElementById('nameInput');
  const priceInput = document.getElementById('priceInput');

  const category = catInput.value.trim();
  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);

  if (category && name && !isNaN(price) && price > 0) {
    triggerHaptic(30);
    products.push({
      id: Date.now(),
      name,
      category,
      price
    });
    saveState();
    catInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    renderCatalogScreen();
    showToast('Produto Cadastrado', `${name} adicionado com sucesso.`, 'success');
  }
}

function requestDeleteProduct(id) {
  triggerHaptic(25);
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  openConfirmModal(
    'Excluir Produto',
    `Deseja realmente excluir este produto (${prod.name})?`,
    () => {
      products = products.filter(p => p.id !== id);
      saveState();
      renderCatalogScreen();
      showToast('Produto Excluído', `${prod.name} foi removido.`, 'danger');
    }
  );
}

function formatDateBR(dateObj) {
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function isoToBRDate(isoStr) {
  if (!isoStr || !isoStr.includes('-')) return '';
  const [y, m, d] = isoStr.split('-');
  return `${d}/${m}/${y}`;
}

function setReportFilter(mode, btn) {
  triggerHaptic(20);
  reportFilterMode = mode;
  reportCustomDateStr = '';
  const customInput = document.getElementById('reportCustomDate');
  if (customInput) customInput.value = '';

  document.querySelectorAll('.report-filter-btn').forEach(b => {
    b.classList.remove('active', 'theme-bg', 'text-white', 'font-bold');
    b.classList.add('bg-slate-100', 'text-slate-600', 'font-semibold');
  });

  if (btn) {
    btn.classList.add('active', 'theme-bg', 'text-white', 'font-bold');
    btn.classList.remove('bg-slate-100', 'text-slate-600', 'font-semibold');
  }

  renderReportScreen();
}

function setReportCustomDate(isoValue) {
  triggerHaptic(20);
  if (!isoValue) {
    const todayBtn = document.querySelector('.report-filter-btn[data-filter="today"]');
    setReportFilter('today', todayBtn);
    return;
  }
  reportFilterMode = 'custom';
  reportCustomDateStr = isoToBRDate(isoValue);

  document.querySelectorAll('.report-filter-btn').forEach(b => {
    b.classList.remove('active', 'theme-bg', 'text-white', 'font-bold');
    b.classList.add('bg-slate-100', 'text-slate-600', 'font-semibold');
  });

  renderReportScreen();
}

function getFilteredRecords() {
  const now = new Date();
  const todayBR = formatDateBR(now);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterdayBR = formatDateBR(yesterdayDate);

  const currentMonthYear = todayBR.slice(3);

  let periodTitle = 'Hoje';
  let filtered = records;

  if (reportFilterMode === 'today') {
    periodTitle = `Hoje (${todayBR})`;
    filtered = records.filter(r => r.date === todayBR);
  } else if (reportFilterMode === 'yesterday') {
    periodTitle = `Ontem (${yesterdayBR})`;
    filtered = records.filter(r => r.date === yesterdayBR);
  } else if (reportFilterMode === 'month') {
    periodTitle = `Este Mês (${currentMonthYear})`;
    filtered = records.filter(r => r.date && r.date.endsWith(currentMonthYear));
  } else if (reportFilterMode === 'custom' && reportCustomDateStr) {
    periodTitle = `Data: ${reportCustomDateStr}`;
    filtered = records.filter(r => r.date === reportCustomDateStr);
  } else {
    periodTitle = 'Todo o Histórico';
    filtered = records;
  }

  return { filtered, periodTitle };
}

function renderReportScreen() {
  const container = document.getElementById('reportList');
  const badge = document.getElementById('recordsCountBadge');
  const periodBadge = document.getElementById('activePeriodLabel');
  if (!container || !badge) return;
  container.innerHTML = '';

  const { filtered, periodTitle } = getFilteredRecords();
  if (periodBadge) periodBadge.innerText = periodTitle;

  let totalVal = 0;
  let totalQty = 0;

  badge.innerText = `${filtered.length} ${filtered.length === 1 ? 'registro' : 'registros'}`;

  if (filtered.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-8">Nenhum lançamento encontrado neste período.</p>`;
    document.getElementById('totalValue').innerText = 'R$ 0,00';
    document.getElementById('totalItems').innerText = '0 itens';
    return;
  }

  filtered.forEach(r => {
    totalVal += r.totalPrice;
    totalQty += r.quantity;

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between p-3 bg-slate-50 border border-slate-200/80 rounded-xl';
    row.innerHTML = `
      <div class="min-w-0 flex-1 pr-2">
        <h4 class="font-bold text-xs text-slate-900 truncate">
          <span class="theme-text font-extrabold">${r.quantity}x</span> ${r.productName}
        </h4>
        <p class="text-[11px] text-slate-500 mt-0.5">${r.category} • ${r.date} às ${r.time}</p>
      </div>
      <div class="flex items-center space-x-2.5 flex-shrink-0">
        <div class="text-right">
          <div class="theme-text font-extrabold text-xs">${formatCurrency(r.totalPrice)}</div>
          <div class="text-[10px] text-slate-400">${formatCurrency(r.unitPrice)} un</div>
        </div>
        <button type="button" onclick="requestDeleteRecord(${r.id})" class="no-print w-8 h-8 rounded-xl bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center active:scale-95 transition cursor-pointer">
          <i class="ph-bold ph-trash text-sm"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('totalValue').innerText = formatCurrency(totalVal);
  document.getElementById('totalItems').innerText = `${totalQty} ${totalQty === 1 ? 'item' : 'itens'}`;
}

function shareWhatsAppReport() {
  triggerHaptic(30);
  const { filtered, periodTitle } = getFilteredRecords();

  if (filtered.length === 0) {
    showToast('Sem registros', 'Não há lançamentos neste período para enviar.', 'danger');
    return;
  }

  let totalVal = 0;
  let totalQty = 0;
  const lines = [];

  lines.push(`✨ *RESUMO AURORA* ✨`);
  lines.push(`📅 *Período:* ${periodTitle}`);
  if (userName) lines.push(`👤 *Operador:* ${userName}`);
  lines.push(`------------------------------`);

  filtered.forEach(r => {
    totalVal += r.totalPrice;
    totalQty += r.quantity;
    lines.push(`• *${r.quantity}x* ${r.productName} — *${formatCurrency(r.totalPrice)}* (${r.time})`);
  });

  lines.push(`------------------------------`);
  lines.push(`🛒 *Total de Itens:* ${totalQty}`);
  lines.push(`💰 *VALOR TOTAL:* *${formatCurrency(totalVal)}*`);

  const text = encodeURIComponent(lines.join('\n'));
  const url = `https://api.whatsapp.com/send?text=${text}`;
  window.open(url, '_blank');
}

function exportCSVReport() {
  triggerHaptic(30);
  const { filtered, periodTitle } = getFilteredRecords();

  if (filtered.length === 0) {
    showToast('Sem dados', 'Nenhum lançamento para exportar.', 'danger');
    return;
  }

  const headers = ['Data', 'Hora', 'Categoria', 'Produto', 'Quantidade', 'Valor Unitario (R$)', 'Valor Total (R$)'];
  const rows = filtered.map(r => [
    r.date,
    r.time,
    `"${String(r.category).replace(/"/g, '""')}"`,
    `"${String(r.productName).replace(/"/g, '""')}"`,
    r.quantity,
    r.unitPrice.toFixed(2).replace('.', ','),
    r.totalPrice.toFixed(2).replace('.', ',')
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const safeName = periodTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const link = document.createElement('a');
  link.href = url;
  link.download = `aurora_relatorio_${safeName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Planilha Exportada', 'Arquivo CSV salvo no seu dispositivo.', 'success');
}

function exportJSONBackup() {
  triggerHaptic(30);
  const backupData = {
    app: 'AURORA',
    version: '2.0',
    exportedAt: new Date().toISOString(),
    userName,
    themeColor: savedThemeColor,
    products,
    records
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateTag = formatDateBR(new Date()).replace(/\//g, '-');

  const link = document.createElement('a');
  link.href = url;
  link.download = `aurora_backup_${dateTag}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Backup Gerado', 'Arquivo JSON baixado com sucesso.', 'success');
}

function triggerImportJSONBackup() {
  triggerHaptic(20);
  const input = document.getElementById('jsonBackupInput');
  if (input) {
    input.value = '';
    input.click();
  }
}

function handleImportJSONBackup(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.records)) {
        throw new Error('Formato inválido');
      }

      products = parsed.products;
      records = parsed.records;
      if (parsed.userName) {
        userName = parsed.userName;
        localStorage.setItem('aurora_username', userName);
      }
      if (parsed.themeColor) {
        applyThemeColor(parsed.themeColor);
      }

      saveState();
      initUserGreeting();
      renderLaunchScreen();
      renderCatalogScreen();
      renderReportScreen();

      triggerHaptic([40, 30, 40]);
      showToast('Backup Restaurado', `${products.length} produtos e ${records.length} lançamentos carregados.`, 'success');
    } catch (err) {
      showToast('Erro no Arquivo', 'Selecione um backup JSON válido do AURORA.', 'danger');
    }
  };
  reader.readAsText(file);
}

function requestDeleteRecord(id) {
  triggerHaptic(25);
  const rec = records.find(r => r.id === id);
  if (!rec) return;
  openConfirmModal(
    'Excluir Lançamento',
    `Deseja realmente excluir este lançamento (${rec.quantity}x ${rec.productName})?`,
    () => {
      records = records.filter(r => r.id !== id);
      saveState();
      renderReportScreen();
      showToast('Registro Excluído', 'O lançamento foi apagado.', 'danger');
    }
  );
}

function updateClockAndDate() {
  const now = new Date();
  const dateEl = document.getElementById('digitalDate');
  if (dateEl) {
    dateEl.innerText = now.toLocaleDateString('pt-BR');
  }
  const clockEl = document.getElementById('digitalClock');
  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString('pt-BR');
  }
}

updateClockAndDate();
setInterval(updateClockAndDate, 1000);

applyThemeColor(savedThemeColor);
initUserGreeting();
renderLaunchScreen();
