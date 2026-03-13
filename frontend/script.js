/* ================================================
   RestaurantOS — script.js
   Conexión completa con FastAPI en localhost:8000
   ================================================ */

const API = 'http://localhost:8000';

/* =====================================================
   API — Capa de comunicación con el backend
   ===================================================== */
const api = {

  async get(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `POST ${path} → ${res.status}`);
    }
    return res.json();
  },

  async put(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `PUT ${path} → ${res.status}`);
    }
    return res.json();
  },

  async delete(path) {
    const res = await fetch(`${API}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`);
    return res.status === 204 ? null : res.json().catch(() => null);
  }
};

/* =====================================================
   UI — Utilidades de interfaz
   ===================================================== */
const UI = {

  /** Muestra una notificación toast */
  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 3500);
  },

  /** Abre un modal */
  openModal(id) {
    document.getElementById(id).classList.add('open');
  },

  /** Cierra un modal */
  closeModal(id) {
    document.getElementById(id).classList.remove('open');
  },

  /** Muestra fila de carga en una tabla */
  tableLoading(tbodyId, cols) {
    document.getElementById(tbodyId).innerHTML =
      `<tr class="loading-row"><td colspan="${cols}"><span class="spinner"></span></td></tr>`;
  },

  /** Muestra fila vacía en una tabla */
  tableEmpty(tbodyId, cols, msg = 'Sin datos disponibles') {
    document.getElementById(tbodyId).innerHTML =
      `<tr><td colspan="${cols}" class="tbl-empty">${msg}</td></tr>`;
  },

  /** Formatea fecha ISO a legible */
  formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  },

  /** Formatea número como moneda */
  currency(n) {
    return '$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  /** Badge de margen */
  marginBadge(precio, costo) {
    if (!precio || !costo) return '<span class="badge badge-gold">—</span>';
    const pct = ((precio - costo) / precio * 100).toFixed(1);
    const cls = pct >= 50 ? 'badge-green' : pct >= 25 ? 'badge-gold' : 'badge-red';
    return `<span class="badge ${cls}">${pct}%</span>`;
  },

  /** Confirmar antes de eliminar */
  confirm(msg, onConfirm) {
    document.getElementById('confirm-msg').textContent = msg;
    const btn = document.getElementById('btn-confirm-ok');
    btn.onclick = () => { UI.closeModal('modal-confirm'); onConfirm(); };
    UI.openModal('modal-confirm');
  }
};

/* =====================================================
   STATE — Caché local de datos
   ===================================================== */
const State = {
  productos: [],
  ventas: [],

  getProducto(id) {
    return this.productos.find(p => p.id === id);
  },

  setProductos(list) { this.productos = list; },
  setVentas(list)    { this.ventas    = list; }
};

/* =====================================================
   App — Lógica principal
   ===================================================== */
const App = {

  /* ---------- INIT ---------- */
  async init() {
    this._setupNav();
    this._setupModalClicks();
    await this._checkConnection();
    await this.loadDashboard();
  },

  _setupNav() {
    // Botones de navegación sidebar
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
    // Botones ghost que navegan (ej: "Ver todas →")
    document.querySelectorAll('[data-page]:not(.nav-btn)').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });
  },

  _setupModalClicks() {
    // Cerrar modal al hacer clic fuera del contenido
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) backdrop.classList.remove('open');
      });
    });

    // Cuando se selecciona un producto en el modal de venta, auto-rellenar precio
    document.getElementById('venta-producto').addEventListener('change', e => {
      const prod = State.getProducto(parseInt(e.target.value));
      if (prod) document.getElementById('venta-precio').value = prod.precio;
    });
  },

  async _checkConnection() {
    const dot   = document.getElementById('conn-dot');
    const label = document.getElementById('conn-label');
    try {
      await fetch(`${API}/metricas/resumen`, { signal: AbortSignal.timeout(3000) });
      dot.className   = 'connection-dot online';
      label.textContent = 'API conectada';
    } catch {
      dot.className   = 'connection-dot offline';
      label.textContent = 'Sin conexión';
      UI.toast('No se pudo conectar con la API en ' + API, 'error');
    }
  },

  /* ---------- NAVIGATE ---------- */
  navigate(page) {
    // Actualizar clases de sidebar
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) btn.classList.add('active');

    // Mostrar página
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Cargar datos de esa sección
    if (page === 'dashboard')  this.loadDashboard();
    if (page === 'productos')  this.loadProductos();
    if (page === 'ventas')     this.loadVentas();
  },

  /* ========================================
     DASHBOARD
     ======================================== */
  async loadDashboard() {
    await Promise.all([
      this._loadMetricas(),
      this._loadDashVentas(),
      this._loadDashProductos()
    ]);
  },

  async _loadMetricas() {
    try {
      const m = await api.get('/metricas/resumen');
      document.querySelector('#kpi-ventas   .kpi-value').textContent = UI.currency(m.ingresos_totales);
      document.querySelector('#kpi-pedidos  .kpi-value').textContent = m.total_ventas;
      document.querySelector('#kpi-productos.kpi-value').textContent = m.productos_registrados;
    } catch {
      ['kpi-ventas','kpi-pedidos','kpi-productos'].forEach(id => {
        document.querySelector(`#${id} .kpi-value`).textContent = 'Error';
      });
    }
  },

  async _loadDashVentas() {
    const tbody = document.getElementById('dash-ventas-body');
    UI.tableLoading('dash-ventas-body', 4);
    try {
      const ventas = await api.get('/ventas');
      State.setVentas(ventas);
      const last = [...ventas].reverse().slice(0, 6);
      if (!last.length) { UI.tableEmpty('dash-ventas-body', 4, 'Sin ventas registradas'); return; }
      tbody.innerHTML = last.map(v => {
        const prod = State.getProducto(v.id_producto);
        const total = (v.cantidad * v.precio_unitario);
        return `<tr>
          <td>${prod ? prod.nombre : `#${v.id_producto}`}</td>
          <td>${v.cantidad}</td>
          <td>${UI.currency(total)}</td>
          <td>${UI.formatDate(v.fecha)}</td>
        </tr>`;
      }).join('');
    } catch {
      UI.tableEmpty('dash-ventas-body', 4, 'Error al cargar ventas');
    }
  },

  async _loadDashProductos() {
    const tbody = document.getElementById('dash-productos-body');
    UI.tableLoading('dash-productos-body', 3);
    try {
      const productos = await api.get('/productos');
      State.setProductos(productos);
      const top = productos.slice(0, 6);
      if (!top.length) { UI.tableEmpty('dash-productos-body', 3, 'Sin productos'); return; }
      tbody.innerHTML = top.map(p => `<tr>
        <td>${p.nombre}</td>
        <td><span class="badge badge-gold">${p.categoria}</span></td>
        <td>${UI.currency(p.precio)}</td>
      </tr>`).join('');
    } catch {
      UI.tableEmpty('dash-productos-body', 3, 'Error al cargar productos');
    }
  },

  /* ========================================
     PRODUCTOS
     ======================================== */
  async loadProductos() {
    UI.tableLoading('productos-body', 7);
    try {
      const productos = await api.get('/productos');
      State.setProductos(productos);
      this._renderProductos(productos);
      this._fillProductoSelect(productos);
    } catch (e) {
      UI.tableEmpty('productos-body', 7, 'Error al cargar productos');
      UI.toast('Error: ' + e.message, 'error');
    }
  },

  _renderProductos(list) {
    const tbody = document.getElementById('productos-body');
    if (!list.length) { UI.tableEmpty('productos-body', 7, 'No hay productos registrados'); return; }
    tbody.innerHTML = list.map(p => `<tr>
      <td><span style="color:var(--muted);font-size:.8rem">#${p.id}</span></td>
      <td><strong>${p.nombre}</strong></td>
      <td><span class="badge badge-gold">${p.categoria}</span></td>
      <td>${UI.currency(p.precio)}</td>
      <td>${UI.currency(p.costo)}</td>
      <td>${UI.marginBadge(p.precio, p.costo)}</td>
      <td>
        <div class="tbl-actions">
          <button class="btn-icon" title="Editar" onclick="App.editProducto(${p.id})">
            <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon" title="Eliminar" onclick="App.deleteProducto(${p.id})" style="color:var(--red)">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
  },

  _fillProductoSelect(productos) {
    const sel = document.getElementById('venta-producto');
    sel.innerHTML = '<option value="">Seleccionar producto...</option>';
    productos.forEach(p => {
      sel.innerHTML += `<option value="${p.id}">${p.nombre} — ${UI.currency(p.precio)}</option>`;
    });
  },

  filterProductos(q) {
    const filtered = State.productos.filter(p =>
      p.nombre.toLowerCase().includes(q.toLowerCase()) ||
      p.categoria.toLowerCase().includes(q.toLowerCase())
    );
    this._renderProductos(filtered);
  },

  /* Abrir modal para CREAR */
  openNuevoProducto() {
    document.getElementById('modal-producto-title').textContent = 'Nuevo Producto';
    document.getElementById('btn-submit-producto').textContent  = 'Guardar Producto';
    document.getElementById('form-producto').reset();
    document.getElementById('prod-id').value = '';
    UI.openModal('modal-producto');
  },

  /* Abrir modal para EDITAR */
  async editProducto(id) {
    try {
      const p = await api.get(`/productos/${id}`);
      document.getElementById('modal-producto-title').textContent = 'Editar Producto';
      document.getElementById('btn-submit-producto').textContent  = 'Actualizar Producto';
      document.getElementById('prod-id').value        = p.id;
      document.getElementById('prod-nombre').value    = p.nombre;
      document.getElementById('prod-categoria').value = p.categoria;
      document.getElementById('prod-precio').value    = p.precio;
      document.getElementById('prod-costo').value     = p.costo;
      UI.openModal('modal-producto');
    } catch (e) {
      UI.toast('No se pudo cargar el producto: ' + e.message, 'error');
    }
  },

  /* Submit del formulario de producto (crea o actualiza) */
  async submitProducto(e) {
    e.preventDefault();
    const id       = document.getElementById('prod-id').value;
    const payload  = {
      nombre:    document.getElementById('prod-nombre').value.trim(),
      categoria: document.getElementById('prod-categoria').value,
      precio:    parseFloat(document.getElementById('prod-precio').value),
      costo:     parseFloat(document.getElementById('prod-costo').value),
    };

    const btn = document.getElementById('btn-submit-producto');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      if (id) {
        await api.put(`/productos/${id}`, payload);
        UI.toast('Producto actualizado correctamente', 'success');
      } else {
        await api.post('/productos', payload);
        UI.toast('Producto creado correctamente', 'success');
      }
      UI.closeModal('modal-producto');
      await this.loadProductos();
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = id ? 'Actualizar Producto' : 'Guardar Producto';
    }
  },

  /* Eliminar producto */
  deleteProducto(id) {
    const prod = State.getProducto(id);
    UI.confirm(
      `¿Eliminar el producto "${prod?.nombre || id}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await api.delete(`/productos/${id}`);
          UI.toast('Producto eliminado', 'success');
          await this.loadProductos();
        } catch (e) {
          UI.toast('Error al eliminar: ' + e.message, 'error');
        }
      }
    );
  },

  /* ========================================
     VENTAS
     ======================================== */
  async loadVentas() {
    UI.tableLoading('ventas-body', 6);
    // Asegurar que productos estén cargados para el select
    if (!State.productos.length) {
      try {
        const productos = await api.get('/productos');
        State.setProductos(productos);
        this._fillProductoSelect(productos);
      } catch { /* continuar */ }
    }

    // Precargar fecha actual en el formulario
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('venta-fecha').value = now.toISOString().slice(0, 16);

    try {
      const ventas = await api.get('/ventas');
      State.setVentas(ventas);
      this._renderVentas(ventas);
    } catch (e) {
      UI.tableEmpty('ventas-body', 6, 'Error al cargar ventas');
      UI.toast('Error: ' + e.message, 'error');
    }
  },

  _renderVentas(list) {
    const tbody = document.getElementById('ventas-body');
    if (!list.length) { UI.tableEmpty('ventas-body', 6, 'No hay ventas registradas'); return; }
    const sorted = [...list].reverse();
    tbody.innerHTML = sorted.map(v => {
      const prod  = State.getProducto(v.id_producto);
      const total = v.cantidad * v.precio_unitario;
      return `<tr>
        <td><span style="color:var(--muted);font-size:.8rem">#${v.id}</span></td>
        <td>${prod ? prod.nombre : `ID ${v.id_producto}`}</td>
        <td>${v.cantidad}</td>
        <td>${UI.currency(v.precio_unitario)}</td>
        <td><strong style="color:var(--gold)">${UI.currency(total)}</strong></td>
        <td>${UI.formatDate(v.fecha)}</td>
      </tr>`;
    }).join('');
  },

  filterVentas(q) {
    const filtered = State.ventas.filter(v => {
      const prod = State.getProducto(v.id_producto);
      return prod?.nombre.toLowerCase().includes(q.toLowerCase()) ||
             String(v.id).includes(q);
    });
    this._renderVentas(filtered);
  },

  /* Submit del formulario de venta */
  async submitVenta(e) {
    e.preventDefault();
    const payload = {
      id_producto:    parseInt(document.getElementById('venta-producto').value),
      cantidad:       parseInt(document.getElementById('venta-cantidad').value),
      precio_unitario: parseFloat(document.getElementById('venta-precio').value),
      fecha:          document.getElementById('venta-fecha').value,
    };

    if (!payload.id_producto || !payload.cantidad || !payload.precio_unitario) {
      UI.toast('Completa todos los campos', 'error');
      return;
    }

    const btn = e.submitter;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      await api.post('/ventas', payload);
      UI.toast('Venta registrada correctamente', 'success');
      UI.closeModal('modal-venta');
      document.getElementById('form-venta').reset();
      await this.loadVentas();
      // Refrescar métricas del dashboard si está visible
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        this._loadMetricas();
      }
    } catch (err) {
      UI.toast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Registrar Venta';
    }
  }
};

/* =====================================================
   Conectar botón "Nuevo Producto" al método correcto
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Re-enlazar el botón de nuevo producto para usar openNuevoProducto
  document.querySelector('[onclick="UI.openModal(\'modal-producto\')"]')
    ?.setAttribute('onclick', 'App.openNuevoProducto()');

  App.init();
});

