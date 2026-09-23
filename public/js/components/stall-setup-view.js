/**
 * Stall Setup View — Shown to Coordinators who don't have a stall yet.
 * Coordinator enters stall name, category, location, and initial catalog items.
 */

import api from '../api.js';

export function renderStallSetupView(container, user, state, onComplete) {
  // If coordinator already has a stall, they shouldn't see this
  if (user.stall_id) {
    onComplete();
    return;
  }

  container.innerHTML = `
    <div class="setup-page">
      <div class="setup-header">
        <div class="setup-brand">
          <div class="login-logo" style="width:44px;height:44px;font-size:20px;">V</div>
          <div>
            <div class="setup-title">Set Up Your Stall</div>
            <div class="setup-subtitle">Welcome, ${user.name}! Let's configure your stall before you begin.</div>
          </div>
        </div>
      </div>

      <div class="setup-body">
        <!-- Step 1: Stall Details -->
        <div class="setup-section">
          <div class="setup-section-title">
            <span class="setup-step-badge">1</span>
            Stall Details
          </div>
          <div class="setup-grid-2">
            <div class="form-group">
              <label class="form-label">Stall Name <span class="required">*</span></label>
              <input type="text" id="stall-name" class="form-input" placeholder="e.g. Food Fiesta, Tech Zone" />
            </div>
            <div class="form-group">
              <label class="form-label">Category</label>
              <select id="stall-category" class="form-input">
                <option value="Food & Beverage">🍕 Food & Beverage</option>
                <option value="Tech & Gaming">💻 Tech & Gaming</option>
                <option value="Electronics & DIY">🔌 Electronics & DIY</option>
                <option value="Robotics">🤖 Robotics</option>
                <option value="Rural Tech">🌾 Rural Tech</option>
                <option value="Art & Craft">🎨 Art & Craft</option>
                <option value="General">📦 General</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Location / Booth</label>
              <input type="text" id="stall-location" class="form-input" placeholder="e.g. Hall A - Booth 12" />
            </div>
            <div class="form-group">
              <label class="form-label">Banner Colour</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;" id="color-picker">
                ${['#4F46E5','#0284C7','#DC2626','#059669','#D97706','#7C3AED','#DB2777'].map(c => `
                  <button type="button" class="color-swatch ${c === '#4F46E5' ? 'selected' : ''}"
                    data-color="${c}" style="background:${c};" title="${c}"></button>
                `).join('')}
              </div>
              <input type="hidden" id="stall-color" value="#4F46E5" />
            </div>
          </div>
        </div>

        <!-- Step 2: Catalog Items -->
        <div class="setup-section">
          <div class="setup-section-title">
            <span class="setup-step-badge">2</span>
            Items & Prices
            <span class="setup-section-note">(You can add more later from your POS dashboard)</span>
          </div>

          <div id="catalog-items-list">
            <!-- Rows injected dynamically -->
          </div>

          <button type="button" class="btn btn-outline btn-sm" id="add-item-btn" style="margin-top:8px;">
            + Add Item
          </button>
        </div>

        <!-- Error / Action -->
        <div id="setup-error" class="auth-error" style="display:none;margin-bottom:12px;"></div>
        <div style="display:flex;gap:12px;align-items:center;">
          <button type="button" class="btn btn-primary" id="save-stall-btn" style="min-width:180px;">
            <span id="save-btn-text">Save & Open My Dashboard →</span>
          </button>
          <span style="font-size:13px;color:var(--text-secondary);">
            You can always edit catalog items later from the POS tab.
          </span>
        </div>
      </div>
    </div>
  `;

  // Color picker
  let selectedColor = '#4F46E5';
  container.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
      document.getElementById('stall-color').value = selectedColor;
    });
  });

  // Catalog items
  const itemsList = document.getElementById('catalog-items-list');
  let itemCount = 0;

  function addItemRow(name = '', price = '', category = 'Standard') {
    itemCount++;
    const id = `item-row-${itemCount}`;
    const row = document.createElement('div');
    row.className = 'catalog-row';
    row.id = id;
    row.innerHTML = `
      <input type="text" class="form-input item-name" placeholder="Item name (e.g. Samosa)" value="${name}" />
      <div class="price-input-wrap">
        <span class="price-prefix">₹</span>
        <input type="number" class="form-input item-price" placeholder="0" min="1" value="${price}" />
      </div>
      <input type="text" class="form-input item-category" placeholder="Category" value="${category}" />
      <button type="button" class="btn-icon-danger remove-item-btn" data-id="${id}" title="Remove">✕</button>
    `;
    itemsList.appendChild(row);

    row.querySelector('.remove-item-btn').addEventListener('click', () => {
      row.remove();
    });
  }

  // Start with 3 empty rows
  addItemRow();
  addItemRow();
  addItemRow();

  document.getElementById('add-item-btn').addEventListener('click', () => addItemRow());

  // Save stall
  document.getElementById('save-stall-btn').addEventListener('click', async () => {
    const name = document.getElementById('stall-name').value.trim();
    const category = document.getElementById('stall-category').value;
    const location = document.getElementById('stall-location').value.trim();
    const color = selectedColor;
    const errorEl = document.getElementById('setup-error');
    const btn = document.getElementById('save-stall-btn');

    errorEl.style.display = 'none';

    if (!name) {
      errorEl.textContent = 'Please enter a stall name.';
      errorEl.style.display = 'block';
      return;
    }

    // Collect catalog items
    const items = [];
    document.querySelectorAll('.catalog-row').forEach(row => {
      const iName = row.querySelector('.item-name')?.value.trim();
      const iPrice = parseFloat(row.querySelector('.item-price')?.value);
      const iCat = row.querySelector('.item-category')?.value.trim() || 'Standard';
      if (iName && iPrice > 0) {
        items.push({ name: iName, price: iPrice, category: iCat });
      }
    });

    btn.disabled = true;
    document.getElementById('save-btn-text').textContent = 'Setting up stall…';

    try {
      await api.setupStall({ name, category, location, banner_color: color, items });
      window.showToast?.(`✅ Stall "${name}" is ready! ${items.length} items in catalog.`, 'success');
      onComplete();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save stall. Please try again.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      document.getElementById('save-btn-text').textContent = 'Save & Open My Dashboard →';
    }
  });
}
