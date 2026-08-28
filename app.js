const defaultProducts = [
      { id: 1, code: "P0001", name: "Papel sulfite A4", price: 32.9, salePrice: 49.9, sales: [] },
      { id: 2, code: "P0002", name: "Caneta azul caixa", price: 18.5, salePrice: 29.9, sales: [] },
      { id: 3, code: "P0003", name: "Toner impressora", price: 249.9, salePrice: 349.9, sales: [] },
      { id: 4, code: "P0004", name: "Mouse sem fio", price: 58.9, salePrice: 89.9, sales: [] },
      { id: 5, code: "P0005", name: "Alcool gel 5L", price: 64.0, salePrice: 94.9, sales: [] },
      { id: 6, code: "P0006", name: "Papel toalha", price: 41.3, salePrice: 64.9, sales: [] },
      { id: 7, code: "P0007", name: "Cadeira escritorio", price: 389.0, salePrice: 549.0, sales: [] },
      { id: 8, code: "P0008", name: "Filtro de linha", price: 44.9, salePrice: 69.9, sales: [] }
    ];

    const defaultSuppliers = [
      { id: 1, name: "Papelaria Central", contact: "compras@papelariacentral.com", phone: "", terms: "1 boleto", notes: "" },
      { id: 2, name: "Tech Supply", contact: "vendas@techsupply.com", phone: "", terms: "2 boletos", notes: "" },
      { id: 3, name: "Higiene Pro", contact: "atendimento@higienepro.com", phone: "", terms: "3 boletos", notes: "" },
      { id: 4, name: "Moveis Office", contact: "comercial@moveisoffice.com", phone: "", terms: "2 boletos", notes: "" }
    ];

    const tabText = {
      painel: ["Painel de compras", "Acompanhe valores, pendencias, fornecedores e produtos mais comprados."],
      catalogo: ["Catalogo de produtos", "Consulte a lista do catalogo e adicione o que precisa ser comprado."],
      importacao: ["Importacao de dados", "Importe catalogo e vendas mensais em colunas separadas."],
      auditoria: ["Auditoria do sistema", "Consulte quem alterou catalogo, vendas, fornecedores, pedidos e recebimentos."],
      lista: ["Lista de compras", "Selecione somente os itens que devem seguir para montagem do pedido."],
      fornecedores: ["Cadastro de fornecedores", "Cadastre e organize os fornecedores usados na montagem do pedido."],
      cotacoes: ["Cotacoes", "Compare precos e prazos dos fornecedores antes de montar o pedido."],
      historicoPreco: ["Historico de precos", "Acompanhe a evolucao do custo e da venda de cada produto."],
      listaIconha: ["Lista Loja Iconha", "Confira a lista enviada pela Loja Iconha e transforme em pedido."],
      listaReta: ["Lista Loja Reta", "Confira a lista enviada pela Loja Reta e transforme em pedido."],
      pedido: ["Montagem do pedido", "Revise os itens enviados da lista, ajuste a quantidade sugerida e envie para aprovacao."],
      aprovacao: ["Aprovacao do admin", "Aprove ou recuse os pedidos enviados pelo setor de compras."],
      recebimento: ["Recebimento", "Confira o que chegou, ajuste quantidades e valores, e confirme a chegada."],
      financeiro: ["Financeiro", "Boletos simulados de todos os pedidos, os que ja chegaram e os que ainda vao chegar, com vencimento, valores e total."],
      pedidoConcluido: ["Pedido concluido", "Consulte pedidos criados automaticamente pelas listas das lojas."],
      alertas: ["Alertas operacionais", "Veja pedidos aguardando aprovacao, recebimentos e divergencias."],
      seguranca: ["Seguranca da conta", "Altere a senha e configure autenticacao em duas etapas."]
    };

    const salesMonths = [
      "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const users = {
      comprador: { role: "comprador", profileRole: "comprador", name: "Comprador", email: "comprador@petville", tabs: ["painel", "catalogo", "cotacoes", "historicoPreco", "lista", "pedido", "aprovacao", "recebimento", "financeiro", "alertas"] },
      admin: { role: "admin", profileRole: "admin", name: "Admin", email: "admin@petville", tabs: ["painel", "catalogo", "importacao", "auditoria", "cotacoes", "historicoPreco", "lista", "fornecedores", "pedido", "aprovacao", "recebimento", "financeiro", "alertas", "seguranca"] },
      lojaIconha: { role: "loja", profileRole: "loja", storeKey: "iconha", storeName: "LOJA ICONHA", name: "LOJA ICONHA", email: "lojaiconha@petville", tabs: ["catalogo", "lista"] },
      lojaReta: { role: "loja", profileRole: "loja", storeKey: "reta", storeName: "LOJA RETA", name: "LOJA RETA", email: "lojareta@petville", tabs: ["catalogo", "lista"] },
      comprasInternas: { role: "comprasInternas", profileRole: "compras_internas", name: "Compras internas", email: "comprasinternas@petville", tabs: ["listaIconha", "listaReta", "pedidoConcluido"] }
    };

    const SUPABASE_URL = "https://jmbiuoqavknllfrghrid.supabase.co";
    const SUPABASE_KEY = "sb_publishable_Rxp-5dX_CgdPrivRPfXfrA_BtKGIcbR";
    const APP_STATE_ID = "main";
    const SALES_CLEAR_VERSION = "2026-07-14-clear-monthly-sales";

    let state = loadState();
    let supabaseSession = loadSupabaseSession();
    let remoteSaveTimer = null;
    let remoteStateLoaded = false;
    let remoteUpdatedAt = "";
    let remoteSaveInFlight = false;
    let remoteSaveQueued = false;
    let localChangeVersion = 0;
    let pendingImport = null;
    let mfaEnrollment = null;
    migrateState();
    let activeTab = "catalogo";
    let currentUser = loadUser();
    let catalogPage = 1;
    let selectedPriceHistoryProductId = null;
    const CATALOG_PAGE_SIZE = 100;

    function loadState() {
      const saved = localStorage.getItem("purchaseSystemState");
      if (!saved) {
        return { products: defaultProducts.map((product) => ({ ...product, sales: [...product.sales] })), suppliers: defaultSuppliers.map((supplier) => ({ ...supplier })), quotations: [], priceHistory: [], settings: { autoApprovalLimit: 0, priceIncreaseAlertPercent: 10 }, list: [], storeLists: { iconha: [], reta: [] }, selectedFromList: [], orderDraft: [], orderQty: {}, orderPrice: {}, orders: [], auditLog: [], salesYear: new Date().getFullYear() };
      }

      try {
        return JSON.parse(saved);
      } catch (error) {
        return { products: defaultProducts.map((product) => ({ ...product, sales: [...product.sales] })), suppliers: defaultSuppliers.map((supplier) => ({ ...supplier })), quotations: [], priceHistory: [], settings: { autoApprovalLimit: 0, priceIncreaseAlertPercent: 10 }, list: [], storeLists: { iconha: [], reta: [] }, selectedFromList: [], orderDraft: [], orderQty: {}, orderPrice: {}, orders: [], auditLog: [], salesYear: new Date().getFullYear() };
      }
    }

    function normalizeSalesSeries(values) {
      return Array.from({ length: 12 }, (_, index) => Math.max(0, Number(values?.[index]) || 0));
    }

    function migrateState() {
      if (!Array.isArray(state.products)) {
        state.products = defaultProducts.map((product) => ({ ...product, sales: [...product.sales] }));
      }
      const fallbackSalesYear = new Date().getFullYear();
      state.salesYear = Math.min(2100, Math.max(2000, Number(state.salesYear) || fallbackSalesYear));
      state.products = state.products.map((product) => {
        const legacySales = normalizeSalesSeries(product.sales);
        const salesByYear = product.salesByYear && typeof product.salesByYear === "object"
          ? Object.fromEntries(Object.entries(product.salesByYear).map(([year, values]) => [year, normalizeSalesSeries(values)]))
          : {};
        if (!salesByYear[state.salesYear] && legacySales.some((value) => value > 0)) {
          salesByYear[state.salesYear] = legacySales;
        }
        return {
          id: Number(product.id),
          code: product.code || `P${String(product.id || 0).padStart(4, "0")}`,
          name: product.name,
          price: Number(product.price) || 0,
          salePrice: Number(product.salePrice ?? product.sale_price ?? product.sellPrice ?? product.sale ?? 0) || 0,
          active: product.active !== false,
          archivedAt: product.archivedAt || "",
          archivedBy: product.archivedBy || "",
          salesByYear,
          sales: normalizeSalesSeries(salesByYear[state.salesYear] || legacySales)
        };
      });
      if (state.salesClearVersion !== SALES_CLEAR_VERSION) {
        state.products = state.products.map((product) => ({ ...product, sales: [], salesByYear: {} }));
        state.salesClearVersion = SALES_CLEAR_VERSION;
      }
      if (!Array.isArray(state.suppliers)) {
        state.suppliers = defaultSuppliers.map((supplier) => ({ ...supplier }));
      }
      state.suppliers = state.suppliers.map((supplier) => ({
        id: Number(supplier.id),
        name: supplier.name,
        contact: supplier.contact || "",
        phone: supplier.phone || "",
        terms: supplier.terms || "",
        notes: supplier.notes || ""
      }));
      if (!Array.isArray(state.list)) state.list = [];
      if (!state.storeLists || typeof state.storeLists !== "object") state.storeLists = {};
      if (!Array.isArray(state.storeLists.iconha)) state.storeLists.iconha = [];
      if (!Array.isArray(state.storeLists.reta)) state.storeLists.reta = [];
      if (!Array.isArray(state.selectedFromList)) state.selectedFromList = [];
      if (!Array.isArray(state.orderDraft)) state.orderDraft = Array.isArray(state.selectedForOrder) ? state.selectedForOrder : [];
      if (!state.orderQty || typeof state.orderQty !== "object") state.orderQty = {};
      if (!state.orderPrice || typeof state.orderPrice !== "object") state.orderPrice = {};
      if (!Array.isArray(state.orders)) state.orders = [];
      if (!Array.isArray(state.auditLog)) state.auditLog = [];
      if (!Array.isArray(state.quotations)) state.quotations = [];
      if (!Array.isArray(state.priceHistory)) state.priceHistory = [];
      if (!state.settings || typeof state.settings !== "object") state.settings = {};
      state.settings.autoApprovalLimit = Math.max(0, Number(state.settings.autoApprovalLimit) || 0);
      const priceAlertPercent = Number(state.settings.priceIncreaseAlertPercent);
      state.settings.priceIncreaseAlertPercent = Number.isFinite(priceAlertPercent) ? Math.max(0, priceAlertPercent) : 10;
      state.quotations = state.quotations.map((quotation) => ({
        ...quotation,
        id: Number(quotation.id),
        productId: Number(quotation.productId),
        supplierId: Number(quotation.supplierId),
        price: Math.max(0, Number(quotation.price) || 0),
        deliveryDays: Math.max(0, Number(quotation.deliveryDays) || 0)
      }));
      state.priceHistory = state.priceHistory.map((entry, index) => ({
        id: Number(entry.id) || index + 1,
        productId: Number(entry.productId),
        costPrice: Math.max(0, Number(entry.costPrice ?? entry.price) || 0),
        salePrice: Math.max(0, Number(entry.salePrice) || 0),
        source: entry.source || "Registro migrado",
        sourceOrderId: Number(entry.sourceOrderId) || null,
        changedAt: entry.changedAt || entry.createdAt || new Date().toISOString(),
        changedBy: entry.changedBy || entry.user || "Sistema"
      })).filter((entry) => state.products.some((product) => product.id === entry.productId));
      const historyProductIds = new Set(state.priceHistory.map((entry) => entry.productId));
      let nextHistoryId = Math.max(0, ...state.priceHistory.map((entry) => Number(entry.id) || 0)) + 1;
      const migrationDate = new Date().toISOString();
      state.products.forEach((product) => {
        if (historyProductIds.has(product.id)) return;
        state.priceHistory.push({
          id: nextHistoryId++,
          productId: product.id,
          costPrice: Math.max(0, Number(product.price) || 0),
          salePrice: Math.max(0, Number(product.salePrice) || 0),
          source: "Cadastro inicial",
          sourceOrderId: null,
          changedAt: migrationDate,
          changedBy: "Sistema"
        });
      });
      state.orders = state.orders.map((order) => ({
        ...order,
        status: order.status === "approved" && order.receiving?.confirmedAt ? "received" : order.status,
        items: Array.isArray(order.items) ? order.items.map((item) => {
          const product = state.products.find((entry) => entry.id === Number(item.productId));
          return {
            ...item,
            productCode: item.productCode || product?.code || "",
            productName: item.productName || product?.name || "Produto removido"
          };
        }) : [],
        receiving: {
          items: order.receiving?.items || {},
          deliveries: Array.isArray(order.receiving?.deliveries) ? order.receiving.deliveries : [],
          confirmedAt: order.receiving?.confirmedAt || "",
          lastPartialAt: order.receiving?.lastPartialAt || ""
        }
      }));
      delete state.selectedForOrder;
      deduplicateProducts();
      saveState();
    }

    function saveState() {
      localStorage.setItem("purchaseSystemState", JSON.stringify(state));
      localChangeVersion += 1;
      queueRemoteStateSave();
    }

    function loadUser() {
      const saved = localStorage.getItem("purchaseSystemUser");
      if (!saved || !users[saved] || !supabaseSession?.access_token) return null;
      return users[saved];
    }

    function saveUser(role) {
      localStorage.setItem("purchaseSystemUser", role);
      currentUser = users[role];
    }

    function loadSupabaseSession() {
      const saved = localStorage.getItem("purchaseSystemSupabaseSession");
      if (!saved) return null;
      try {
        const session = JSON.parse(saved);
        if (!session?.access_token) return null;
        return session;
      } catch (error) {
        localStorage.removeItem("purchaseSystemSupabaseSession");
        return null;
      }
    }

    function saveSupabaseSession(session) {
      supabaseSession = session;
      localStorage.setItem("purchaseSystemSupabaseSession", JSON.stringify(session));
    }

    async function refreshSupabaseSession() {
      if (!supabaseSession?.refresh_token) return false;
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refresh_token: supabaseSession.refresh_token })
      });
      if (!response.ok) return false;
      saveSupabaseSession(await response.json());
      return true;
    }

    async function supabaseRequest(path, options = {}, allowRefresh = true) {
      const headers = {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        ...(options.headers || {})
      };
      if (supabaseSession?.access_token) {
        headers.Authorization = `Bearer ${supabaseSession.access_token}`;
      }

      const response = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers
      });

      if (response.status === 401 && allowRefresh && await refreshSupabaseSession()) {
        return supabaseRequest(path, options, false);
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Erro Supabase ${response.status}`);
      }

      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    async function signInSupabase(email, password) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        let message = "E-mail ou senha nao conferem no Supabase.";
        try {
          const errorData = await response.json();
          message = errorData.msg || errorData.message || message;
        } catch (error) {
          message = await response.text() || message;
        }
        throw new Error(message);
      }

      return response.json();
    }

    function jwtClaims(token) {
      try {
        const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(atob(payload).split("").map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
      } catch (error) {
        return {};
      }
    }

    async function authFactorRequest(path, token, options = {}) {
      const response = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
        ...options,
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
      });
      const body = await response.text();
      const data = body ? JSON.parse(body) : {};
      if (!response.ok) throw new Error(data.msg || data.message || "Falha na autenticacao em duas etapas.");
      return data;
    }

    async function completeMfaIfNeeded(session) {
      const factor = session?.user?.factors?.find((entry) => entry.status === "verified" || entry.verified_at);
      if (!factor || jwtClaims(session.access_token).aal === "aal2") return session;
      const code = window.prompt("Digite o codigo de 6 digitos do aplicativo autenticador:", "");
      if (code === null) throw new Error("Autenticacao em duas etapas cancelada.");
      const challenge = await authFactorRequest(`/factors/${factor.id}/challenge`, session.access_token, { method: "POST", body: "{}" });
      const verified = await authFactorRequest(`/factors/${factor.id}/verify`, session.access_token, { method: "POST", body: JSON.stringify({ challenge_id: challenge.id, code: code.trim() }) });
      return { ...session, ...verified, user: verified.user || session.user };
    }

    async function requestPasswordRecovery() {
      const email = document.getElementById("loginEmail").value.trim();
      if (!email) {
        toast("Informe o e-mail para recuperar a senha.");
        return;
      }
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/recover`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        toast("Se o e-mail estiver cadastrado, as instrucoes de recuperacao serao enviadas.");
      } catch (error) {
        toast("Nao foi possivel solicitar a recuperacao agora.");
      }
    }

    async function changePassword() {
      const password = document.getElementById("newPasswordInput").value;
      const confirmation = document.getElementById("confirmPasswordInput").value;
      if (password.length < 10 || password !== confirmation) {
        toast("Use ao menos 10 caracteres e confirme a mesma senha.");
        return;
      }
      try {
        await authFactorRequest("/user", supabaseSession.access_token, { method: "PUT", body: JSON.stringify({ password }) });
        document.getElementById("newPasswordInput").value = "";
        document.getElementById("confirmPasswordInput").value = "";
        recordAudit("system", "Senha alterada", "", "Senha da conta administrativa atualizada");
        saveState();
        toast("Senha alterada.");
      } catch (error) {
        toast(error.message);
      }
    }

    async function startMfaEnrollment() {
      if (!isAdmin()) return;
      try {
        mfaEnrollment = await authFactorRequest("/factors", supabaseSession.access_token, { method: "POST", body: JSON.stringify({ factor_type: "totp", friendly_name: "Sistema de Compras" }) });
        document.getElementById("mfaQrImage").src = mfaEnrollment.totp?.qr_code || "";
        document.getElementById("mfaSecretInput").value = mfaEnrollment.totp?.secret || "";
        document.getElementById("mfaEnrollment").style.display = "grid";
      } catch (error) {
        toast(error.message);
      }
    }

    async function verifyMfaEnrollment() {
      const code = document.getElementById("mfaCodeInput").value.trim();
      if (!mfaEnrollment?.id || code.length !== 6) {
        toast("Informe o codigo de 6 digitos.");
        return;
      }
      try {
        const challenge = await authFactorRequest(`/factors/${mfaEnrollment.id}/challenge`, supabaseSession.access_token, { method: "POST", body: "{}" });
        const verified = await authFactorRequest(`/factors/${mfaEnrollment.id}/verify`, supabaseSession.access_token, { method: "POST", body: JSON.stringify({ challenge_id: challenge.id, code }) });
        if (verified.access_token) saveSupabaseSession({ ...supabaseSession, ...verified });
        document.getElementById("mfaEnrollment").style.display = "none";
        document.getElementById("mfaCodeInput").value = "";
        mfaEnrollment = null;
        recordAudit("system", "MFA ativado", "", "Autenticacao em duas etapas configurada");
        saveState();
        toast("Autenticacao em duas etapas ativada.");
      } catch (error) {
        toast(error.message);
      }
    }

    function exportBackup() {
      if (!isAdmin()) return;
      const backup = { version: 2, exportedAt: new Date().toISOString(), data: state };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-sistema-compras-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      recordAudit("system", "Backup exportado", "", "Copia completa dos dados gerada pelo Admin");
      saveState();
    }

    async function restoreBackup(input) {
      if (!isAdmin()) return;
      const file = input.files?.[0];
      if (!file) return;
      try {
        const backup = JSON.parse(await file.text());
        const restored = backup?.data || backup;
        if (!Array.isArray(restored.products) || !Array.isArray(restored.orders) || !Array.isArray(restored.suppliers)) throw new Error("Arquivo de backup invalido.");
        if (!confirm("Restaurar este backup substituirá os dados atuais. Deseja continuar?")) return;
        state = restored;
        migrateState();
        recordAudit("system", "Backup restaurado", "", file.name);
        saveState();
        render();
        toast("Backup restaurado.");
      } catch (error) {
        toast(error.message || "Nao foi possivel restaurar o backup.");
      } finally {
        input.value = "";
      }
    }

    function userKeyFromProfile(profile) {
      if (!profile?.active) return "";
      if (profile.role === "admin") return "admin";
      if (profile.role === "comprador") return "comprador";
      if (profile.role === "compras_internas") return "comprasInternas";
      if (profile.role === "loja" && profile.store_key === "iconha") return "lojaIconha";
      if (profile.role === "loja" && profile.store_key === "reta") return "lojaReta";
      return "";
    }

    async function loadAuthenticatedProfile() {
      const userId = supabaseSession?.user?.id;
      if (!userId) throw new Error("Sessao sem usuario valido.");
      const rows = await supabaseRequest(`/rest/v1/app_profiles?auth_user_id=eq.${encodeURIComponent(userId)}&select=role,display_name,store_key,active`);
      const roleKey = userKeyFromProfile(rows?.[0]);
      if (!roleKey) throw new Error("Usuario sem perfil ativo no sistema.");
      return roleKey;
    }

    async function loadRemoteState() {
      if (!supabaseSession?.access_token) return;
      const rows = await supabaseRequest(`/rest/v1/app_state?id=eq.${encodeURIComponent(APP_STATE_ID)}&select=data,updated_at`);
      if (!rows?.[0]?.data) return;

      state = JSON.parse(JSON.stringify(rows[0].data));
      remoteUpdatedAt = rows[0].updated_at || "";
      localStorage.removeItem("purchaseSystemState");
      localStorage.setItem("purchaseSystemMigratedToSupabase", "true");
      migrateState();
      remoteStateLoaded = true;
      localStorage.setItem("purchaseSystemState", JSON.stringify(state));
      render();
    }

    function queueRemoteStateSave() {
      if (!supabaseSession?.access_token || !remoteStateLoaded) return;
      remoteSaveQueued = true;
      window.clearTimeout(remoteSaveTimer);
      remoteSaveTimer = window.setTimeout(() => {
        persistStateToSupabase();
      }, 500);
    }

    async function persistStateToSupabase() {
      if (!supabaseSession?.access_token || !remoteStateLoaded || remoteSaveInFlight || !remoteSaveQueued) return;
      remoteSaveInFlight = true;
      remoteSaveQueued = false;
      const snapshot = JSON.parse(JSON.stringify(state));
      const snapshotVersion = localChangeVersion;
      const nextUpdatedAt = new Date().toISOString();
      const concurrencyFilter = remoteUpdatedAt ? `&updated_at=eq.${encodeURIComponent(remoteUpdatedAt)}` : "";
      try {
        const rows = await supabaseRequest(`/rest/v1/app_state?id=eq.${encodeURIComponent(APP_STATE_ID)}${concurrencyFilter}&select=updated_at`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ data: snapshot, updated_at: nextUpdatedAt })
        });
        if (!rows?.length) {
          remoteStateLoaded = false;
          localStorage.setItem("purchaseSystemPendingState", JSON.stringify(snapshot));
          toast("Outro usuario atualizou os dados. Sua alteracao ficou salva neste computador; recarregue a pagina antes de continuar.");
          return;
        }
        remoteUpdatedAt = rows[0].updated_at || nextUpdatedAt;
        localStorage.removeItem("purchaseSystemPendingState");
        if (localChangeVersion > snapshotVersion) remoteSaveQueued = true;
      } catch (error) {
        toast("Nao consegui salvar no Supabase agora. Mantive uma copia local.");
      } finally {
        remoteSaveInFlight = false;
        if (remoteSaveQueued && remoteStateLoaded) {
          window.clearTimeout(remoteSaveTimer);
          remoteSaveTimer = window.setTimeout(persistStateToSupabase, 100);
        }
      }
    }

    function loadRememberedLogin() {
      const saved = localStorage.getItem("purchaseSystemRememberLogin");
      if (!saved) {
        syncLoginEmailWithRole();
        return;
      }

      try {
        const credentials = JSON.parse(saved);
        if (!users[credentials.role]) {
          syncLoginEmailWithRole();
          return;
        }
        document.getElementById("loginRole").value = credentials.role;
        document.getElementById("loginEmail").value = credentials.email || users[credentials.role].email;
        document.getElementById("loginPassword").value = "";
        document.getElementById("rememberLogin").checked = true;
      } catch (error) {
        localStorage.removeItem("purchaseSystemRememberLogin");
        syncLoginEmailWithRole();
      }
    }

    function saveRememberedLogin(role, email) {
      if (!document.getElementById("rememberLogin").checked) {
        localStorage.removeItem("purchaseSystemRememberLogin");
        return;
      }

      localStorage.setItem("purchaseSystemRememberLogin", JSON.stringify({ role, email }));
    }

    function syncLoginEmailWithRole() {
      const role = document.getElementById("loginRole").value;
      document.getElementById("loginEmail").value = users[role]?.email || "";
    }

    function isAdmin() {
      return currentUser?.role === "admin";
    }

    function isStoreUser() {
      return currentUser?.role === "loja";
    }

    function currentSalesYear() {
      return Math.min(2100, Math.max(2000, Number(state.salesYear) || new Date().getFullYear()));
    }

    function salesForProduct(product, year = currentSalesYear()) {
      if (!product) return normalizeSalesSeries([]);
      return normalizeSalesSeries(product.salesByYear?.[year] || []);
    }

    function syncProductsToSalesYear() {
      state.products.forEach((product) => {
        product.sales = salesForProduct(product, currentSalesYear());
      });
    }

    function setSalesYear(value) {
      const year = Math.min(2100, Math.max(2000, Number(value) || new Date().getFullYear()));
      state.salesYear = year;
      syncProductsToSalesYear();
      document.getElementById("salesYearInput").value = year;
      saveState();
      render();
    }

    function recordAudit(area, action, entityId, details) {
      if (!Array.isArray(state.auditLog)) state.auditLog = [];
      state.auditLog.unshift({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        user: currentUser?.name || "Sistema",
        email: currentUser?.email || "",
        area,
        action,
        entityId: String(entityId ?? ""),
        details: String(details || "")
      });
      state.auditLog = state.auditLog.slice(0, 2000);
    }

    function activeList() {
      if (isStoreUser()) return state.storeLists[currentUser.storeKey];
      return state.list;
    }

    function canAccessTab(tab) {
      return currentUser?.tabs.includes(tab);
    }

    function firstAllowedTab() {
      return currentUser?.tabs[0] || "catalogo";
    }

    function money(value) {
      return (Number(value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatInputMoney(value) {
      return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function parseLocalDate(str) {
      if (!str) return null;
      const parts = String(str).split("-");
      if (parts.length !== 3) return null;
      const [y, m, d] = parts.map(Number);
      if (!y || !m || !d) return null;
      const dt = new Date(y, m - 1, d);
      return isNaN(dt.getTime()) ? null : dt;
    }

    function addMonthsClamped(baseDate, monthsToAdd) {
      const day = baseDate.getDate();
      const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsToAdd, day);
      // Se o dia "estourou" para o mes seguinte (ex.: 31 em mes sem dia 31), usa o ultimo dia do mes pretendido.
      if (target.getDate() !== day) target.setDate(0);
      return target;
    }

    function addDays(baseDate, days) {
      const target = new Date(baseDate.getTime());
      target.setDate(target.getDate() + days);
      return target;
    }

    // Intervalo dos boletos: "month" = mesmo dia a cada mes; numero = intervalo fixo em dias (7, 14, 30...).
    function normalizeInterval(interval) {
      if (interval === "month") return "month";
      const days = Number(interval);
      return days > 0 ? days : "month";
    }

    function boletoDate(base, index, interval) {
      const normalized = normalizeInterval(interval);
      return normalized === "month" ? addMonthsClamped(base, index) : addDays(base, index * normalized);
    }

    function intervalSubtitle(interval, count) {
      const normalized = normalizeInterval(interval);
      if (normalized === "month") return `${count} boleto(s) mensais, no mesmo dia da chegada`;
      return `${count} boleto(s) a cada ${normalized} dias apos a chegada`;
    }

    function intervalLabel(interval) {
      const normalized = normalizeInterval(interval);
      return normalized === "month" ? "Mensal (mesmo dia)" : `${normalized} em ${normalized} dias`;
    }

    // Simula os boletos a partir da data de chegada, conforme o intervalo escolhido.
    // O arredondamento em centavos e distribuido nos primeiros boletos para o somatorio bater com o total.
    function buildPaymentSchedule(total, installments, deliveryStr, interval) {
      const n = Math.max(1, Number(installments) || 1);
      const base = parseLocalDate(deliveryStr);
      const totalCents = Math.round((Number(total) || 0) * 100);
      const baseCents = Math.floor(totalCents / n);
      const remainder = totalCents - baseCents * n;
      const rows = [];
      for (let i = 1; i <= n; i += 1) {
        const cents = baseCents + (i <= remainder ? 1 : 0);
        rows.push({ index: i, date: base ? boletoDate(base, i, interval) : null, value: cents / 100 });
      }
      return rows;
    }

    function currentPaymentInterval() {
      const days = Math.floor(Number(document.getElementById("intervalSelect")?.value));
      return days > 0 ? String(days) : "30";
    }

    function formatScheduleDate(date) {
      return date ? date.toLocaleDateString("pt-BR") : "--/--/----";
    }

    function renderPaymentSchedule(total, installments) {
      const scheduleEl = document.getElementById("paymentSchedule");
      if (!scheduleEl) return;
      const deliveryStr = document.getElementById("deliveryInput")?.value || "";
      const interval = currentPaymentInterval();
      const hasDate = !!parseLocalDate(deliveryStr);
      const rows = buildPaymentSchedule(total, installments, deliveryStr, interval);
      const subtitle = hasDate
        ? intervalSubtitle(interval, rows.length)
        : "Escolha a data de chegada para simular as datas";
      const list = rows.map((row) => `
        <div class="payment-row">
          <span class="payment-idx">${row.index}o boleto</span>
          <span class="payment-date${hasDate ? "" : " muted"}">${formatScheduleDate(row.date)}</span>
          <span class="payment-val">${money(row.value)}</span>
        </div>`).join("");
      scheduleEl.innerHTML = `
        <div class="payment-sim-head">
          <strong>Simulacao de pagamentos</strong>
          <span class="muted">${subtitle}</span>
        </div>
        <div class="payment-list">${list}</div>`;
    }

    // Todos os pedidos com obrigacao de pagamento: os que ja chegaram e os que ainda vao chegar.
    // Apenas os recusados ficam de fora (nao geram boleto).
    function financeOrders() {
      return state.orders.filter((order) => order.status !== "rejected");
    }

    // Todos os boletos simulados dos pedidos, ja ordenados por vencimento.
    function financeBoletos() {
      const rows = [];
      financeOrders().forEach((order) => {
        const total = totalFor(order.items);
        buildPaymentSchedule(total, order.installments || 1, order.delivery, order.interval).forEach((boleto) => {
          rows.push({
            date: boleto.date,
            time: boleto.date ? boleto.date.getTime() : Number.POSITIVE_INFINITY,
            value: boleto.value,
            index: boleto.index,
            installments: order.installments || 1,
            orderId: order.id,
            supplier: order.supplier,
            status: order.status
          });
        });
      });
      rows.sort((a, b) => a.time - b.time);
      return rows;
    }

    function renderFinanceiro() {
      const boletos = financeBoletos();
      const totalValue = boletos.reduce((sum, boleto) => sum + boleto.value, 0);
      const orders = financeOrders();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const next = boletos.find((boleto) => boleto.date && boleto.date.getTime() >= today.getTime());

      document.getElementById("financeTotalStat").textContent = money(totalValue);
      document.getElementById("financeCountStat").textContent = boletos.length;
      document.getElementById("financeNextStat").textContent = next ? formatScheduleDate(next.date) : "-";
      document.getElementById("financeOrdersStat").textContent = orders.length;

      const tableBody = document.getElementById("financeTable");
      const foot = document.getElementById("financeFoot");
      const empty = document.getElementById("financeEmpty");

      let rowsHtml = "";
      let currentKey = null;
      let monthSum = 0;

      const flushSubtotal = () => {
        if (currentKey !== null) {
          rowsHtml += `<tr class="finance-subtotal"><td colspan="4">Subtotal do mes</td><td>${money(monthSum)}</td></tr>`;
        }
      };

      boletos.forEach((boleto) => {
        const key = boleto.date ? `${boleto.date.getFullYear()}-${boleto.date.getMonth()}` : "sem-data";
        if (key !== currentKey) {
          flushSubtotal();
          monthSum = 0;
          currentKey = key;
          const label = boleto.date
            ? `${salesMonths[boleto.date.getMonth()]} de ${boleto.date.getFullYear()}`
            : "Sem data de chegada definida";
          rowsHtml += `<tr class="finance-month"><td colspan="5">${label}</td></tr>`;
        }
        monthSum += boleto.value;
        rowsHtml += `
          <tr>
            <td><strong>${formatScheduleDate(boleto.date)}</strong></td>
            <td>Pedido #${boleto.orderId}</td>
            <td>${escapeHtml(boleto.supplier || "-")}</td>
            <td>${boleto.index}/${boleto.installments} <span class="status ${boleto.status}">${statusText(boleto.status)}</span></td>
            <td><strong>${money(boleto.value)}</strong></td>
          </tr>`;
      });
      flushSubtotal();

      tableBody.innerHTML = rowsHtml;
      foot.innerHTML = boletos.length
        ? `<tr class="finance-total"><td colspan="4">Total a pagar</td><td>${money(totalValue)}</td></tr>`
        : "";
      tableBody.closest(".table-wrap").style.display = boletos.length ? "block" : "none";
      empty.style.display = boletos.length ? "none" : "block";
    }

    function productById(id) {
      return state.products.find((product) => product.id === Number(id));
    }

    function nextPriceHistoryId() {
      return Math.max(0, ...state.priceHistory.map((entry) => Number(entry.id) || 0)) + 1;
    }

    function priceHistoryForProduct(productId) {
      return state.priceHistory
        .filter((entry) => Number(entry.productId) === Number(productId))
        .sort((a, b) => {
          const dateDifference = new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime();
          return dateDifference || Number(a.id) - Number(b.id);
        });
    }

    function priceVariationPercent(currentPrice, previousPrice) {
      const current = Math.max(0, Number(currentPrice) || 0);
      const previous = Math.max(0, Number(previousPrice) || 0);
      if (!previous) return current ? 100 : 0;
      return ((current - previous) / previous) * 100;
    }

    function recordPriceHistory(productId, costPrice, salePrice, source, sourceOrderId = null, changedAt = "") {
      if (!Array.isArray(state.priceHistory)) state.priceHistory = [];
      const product = productById(productId);
      if (!product) return false;
      const cost = Math.round(Math.max(0, Number(costPrice) || 0) * 100) / 100;
      const sale = Math.round(Math.max(0, Number(salePrice) || 0) * 100) / 100;
      const entries = priceHistoryForProduct(product.id);
      const latest = entries[entries.length - 1];
      if (latest && Math.abs(latest.costPrice - cost) < 0.009 && Math.abs(latest.salePrice - sale) < 0.009) return false;

      state.priceHistory.push({
        id: nextPriceHistoryId(),
        productId: product.id,
        costPrice: cost,
        salePrice: sale,
        source: source || "Atualizacao manual",
        sourceOrderId: Number(sourceOrderId) || null,
        changedAt: changedAt || new Date().toISOString(),
        changedBy: currentUser?.name || "Sistema"
      });
      return true;
    }

    function productByCodeOrName(code, name) {
      const normalizedCode = normalizeName(code);
      const normalizedName = normalizeName(name);
      return state.products.find((product) => productMatchesCodeOrName(product, normalizedCode, normalizedName));
    }

    function productMatchesCodeOrName(product, normalizedCode, normalizedName) {
      return (normalizedCode && normalizeName(product.code) === normalizedCode) ||
        (normalizedName && normalizeName(product.name) === normalizedName);
    }

    function productMatchesByCodeOrName(code, name) {
      const normalizedCode = normalizeName(code);
      const normalizedName = normalizeName(name);
      if (!normalizedCode && !normalizedName) return [];
      const codeMatches = normalizedCode
        ? state.products.filter((product) => normalizeName(product.code) === normalizedCode)
        : [];
      if (codeMatches.length) {
        return codeMatches.sort((a, b) => Number(a.id) - Number(b.id));
      }
      return normalizedName
        ? state.products
          .filter((product) => normalizeName(product.name) === normalizedName)
          .sort((a, b) => Number(a.id) - Number(b.id))
        : [];
    }

    function productIdentityConflict(code, name) {
      const normalizedCode = normalizeName(code);
      const normalizedName = normalizeName(name);
      if (!normalizedCode || !normalizedName) return false;
      const codeMatch = state.products.find((product) => normalizeName(product.code) === normalizedCode);
      const nameMatch = state.products.find((product) => normalizeName(product.name) === normalizedName);
      return Boolean(codeMatch && nameMatch && codeMatch.id !== nameMatch.id);
    }

    function replaceProductReference(oldId, newId) {
      const fromId = Number(oldId);
      const toId = Number(newId);
      if (!fromId || !toId || fromId === toId) return;

      const replaceItem = (item) => {
        if (Number(item.productId) === fromId) item.productId = toId;
      };

      state.list.forEach(replaceItem);
      Object.values(state.storeLists).forEach((items) => items.forEach(replaceItem));
      state.selectedFromList = state.selectedFromList.map((id) => Number(id) === fromId ? toId : Number(id));
      state.orderDraft = state.orderDraft.map((id) => Number(id) === fromId ? toId : Number(id));
      state.orders.forEach((order) => {
        order.items.forEach(replaceItem);
        if (order.receiving?.items?.[fromId]) {
          order.receiving.items[toId] = order.receiving.items[toId] || order.receiving.items[fromId];
          delete order.receiving.items[fromId];
        }
      });
      state.priceHistory.forEach(replaceItem);

      if (state.orderQty[fromId] && !state.orderQty[toId]) state.orderQty[toId] = state.orderQty[fromId];
      if (state.orderPrice[fromId] && !state.orderPrice[toId]) state.orderPrice[toId] = state.orderPrice[fromId];
      delete state.orderQty[fromId];
      delete state.orderPrice[fromId];
    }

    function mergeProductRecords(primary, duplicate) {
      if (!primary || !duplicate || primary.id === duplicate.id) return primary;
      if (!primary.code && duplicate.code) primary.code = duplicate.code;
      if (!primary.name && duplicate.name) primary.name = duplicate.name;
      if (!primary.price && duplicate.price) primary.price = duplicate.price;
      if (!primary.salePrice && duplicate.salePrice) primary.salePrice = duplicate.salePrice;
      if ((!primary.sales || !primary.sales.length) && duplicate.sales?.length) {
        primary.sales = [...duplicate.sales];
      }
      if (!primary.salesByYear || typeof primary.salesByYear !== "object") primary.salesByYear = {};
      Object.entries(duplicate.salesByYear || {}).forEach(([year, values]) => {
        const currentValues = normalizeSalesSeries(primary.salesByYear[year]);
        if (!currentValues.some((value) => value > 0)) {
          primary.salesByYear[year] = normalizeSalesSeries(values);
        }
      });
      if (duplicate.active !== false) {
        primary.active = true;
        primary.archivedAt = "";
        primary.archivedBy = "";
      }
      replaceProductReference(duplicate.id, primary.id);
      state.products = state.products.filter((product) => product.id !== duplicate.id);
      return primary;
    }

    function consolidateProductByCodeOrName(code, name) {
      const matches = productMatchesByCodeOrName(code, name);
      if (!matches.length) return null;
      const primary = matches[0];
      matches.slice(1).forEach((duplicate) => mergeProductRecords(primary, duplicate));
      return primary;
    }

    function deduplicateProducts() {
      [...state.products].forEach((product) => {
        consolidateProductByCodeOrName(product.code, product.name);
      });
      state.selectedFromList = [...new Set(state.selectedFromList.map(Number))];
      state.orderDraft = [...new Set(state.orderDraft.map(Number))];
    }

    function supplierById(id) {
      return state.suppliers.find((supplier) => supplier.id === Number(id));
    }

    function normalizeName(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char]));
    }

    function parseColumn(text) {
      return text.split(/\r?\n/).map((line) => line.trim());
    }

    function fillColumn(id, values) {
      document.getElementById(id).value = values.map((value) => String(value ?? "").trim()).join("\n");
    }

    function looksLikeHeader(values, expected) {
      const normalized = values.map((value) => normalizeName(value));
      return expected.some((word) => normalized.some((value) => value.includes(word)));
    }

    function headerColumnIndex(header, aliases) {
      const normalizedHeader = header.map((value) => normalizeName(value));
      return normalizedHeader.findIndex((value) => aliases.some((alias) => value === alias || value.startsWith(`${alias} `)));
    }

    function parseDelimited(text) {
      const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
      const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
      const rows = [];
      let row = [];
      let cell = "";
      let quoted = false;

      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const next = text[index + 1];

        if (char === '"' && quoted && next === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = !quoted;
        } else if (char === delimiter && !quoted) {
          row.push(cell.trim());
          cell = "";
        } else if ((char === "\n" || char === "\r") && !quoted) {
          if (char === "\r" && next === "\n") index += 1;
          row.push(cell.trim());
          if (row.some((value) => value !== "")) rows.push(row);
          row = [];
          cell = "";
        } else {
          cell += char;
        }
      }

      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      return rows;
    }

    function getColumnName(ref) {
      return String(ref || "").replace(/[0-9]/g, "");
    }

    function columnIndex(name) {
      return String(name || "").toUpperCase().split("").reduce((sum, char) => {
        return sum * 26 + char.charCodeAt(0) - 64;
      }, 0) - 1;
    }

    async function inflateRaw(bytes) {
      if (!("DecompressionStream" in window)) {
        throw new Error("Este navegador nao consegue descompactar XLSX localmente.");
      }

      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    async function unzipXlsx(arrayBuffer) {
      const view = new DataView(arrayBuffer);
      const bytes = new Uint8Array(arrayBuffer);
      let endOffset = -1;

      for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 66000); index -= 1) {
        if (view.getUint32(index, true) === 0x06054b50) {
          endOffset = index;
          break;
        }
      }

      if (endOffset < 0) throw new Error("Arquivo XLSX invalido.");

      const entries = view.getUint16(endOffset + 10, true);
      const centralOffset = view.getUint32(endOffset + 16, true);
      const files = {};
      let offset = centralOffset;

      for (let entry = 0; entry < entries; entry += 1) {
        if (view.getUint32(offset, true) !== 0x02014b50) break;

        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);

        if (method === 0) {
          files[name] = compressed;
        } else if (method === 8) {
          files[name] = await inflateRaw(compressed);
        }

        offset += 46 + nameLength + extraLength + commentLength;
      }

      return files;
    }

    function xmlText(bytes) {
      return new TextDecoder("utf-8").decode(bytes);
    }

    function parseXml(text) {
      return new DOMParser().parseFromString(text, "application/xml");
    }

    function sharedStrings(files) {
      if (!files["xl/sharedStrings.xml"]) return [];
      const xml = parseXml(xmlText(files["xl/sharedStrings.xml"]));
      return Array.from(xml.getElementsByTagName("si")).map((item) => {
        return Array.from(item.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
      });
    }

    function firstSheetPath(files) {
      const workbook = parseXml(xmlText(files["xl/workbook.xml"]));
      const sheet = workbook.getElementsByTagName("sheet")[0];
      if (!sheet) throw new Error("A planilha nao possui abas.");

      const relId = sheet.getAttribute("r:id");
      const rels = parseXml(xmlText(files["xl/_rels/workbook.xml.rels"]));
      const relation = Array.from(rels.getElementsByTagName("Relationship")).find((rel) => rel.getAttribute("Id") === relId);
      const target = relation?.getAttribute("Target") || "worksheets/sheet1.xml";
      return target.startsWith("xl/") ? target : `xl/${target.replace(/^\/xl\//, "")}`;
    }

    function sheetRows(files) {
      const strings = sharedStrings(files);
      const sheetPath = firstSheetPath(files);
      const xml = parseXml(xmlText(files[sheetPath]));
      const rows = [];

      Array.from(xml.getElementsByTagName("row")).forEach((rowNode) => {
        const row = [];
        Array.from(rowNode.getElementsByTagName("c")).forEach((cell) => {
          const ref = cell.getAttribute("r") || "";
          const index = columnIndex(getColumnName(ref));
          const type = cell.getAttribute("t");
          let value = "";

          if (type === "s") {
            const sharedIndex = Number(cell.getElementsByTagName("v")[0]?.textContent || 0);
            value = strings[sharedIndex] || "";
          } else if (type === "inlineStr") {
            value = Array.from(cell.getElementsByTagName("t")).map((node) => node.textContent || "").join("");
          } else {
            value = cell.getElementsByTagName("v")[0]?.textContent || "";
          }

          row[index] = value;
        });

        if (row.some((value) => String(value || "").trim() !== "")) rows.push(row.map((value) => value ?? ""));
      });

      return rows;
    }

    async function rowsFromFile(file) {
      const name = file.name.toLowerCase();
      if (name.endsWith(".csv")) {
        return parseDelimited(await file.text());
      }

      if (name.endsWith(".xlsx")) {
        const files = await unzipXlsx(await file.arrayBuffer());
        return sheetRows(files);
      }

      throw new Error("Use arquivo .xlsx ou .csv.");
    }

    function fillCatalogFromRows(rows) {
      const header = rows[0] || [];
      const hasHeader = looksLikeHeader(header, ["codigo", "produto", "custo", "venda", "valor"]);
      const usefulRows = hasHeader ? rows.slice(1) : rows;
      const hasCode = hasHeader ? headerColumnIndex(header, ["codigo", "cod", "sku"]) >= 0 : (rows[0] || []).length >= 4;
      const codeIndex = hasHeader ? headerColumnIndex(header, ["codigo", "cod", "sku"]) : (hasCode ? 0 : -1);
      const nameIndex = hasHeader ? headerColumnIndex(header, ["produto", "nome", "descricao"]) : (hasCode ? 1 : 0);
      const costIndex = hasHeader ? headerColumnIndex(header, ["preco custo", "preco de custo", "custo", "valor custo"]) : (hasCode ? 2 : 1);
      const saleIndex = hasHeader ? headerColumnIndex(header, ["preco venda", "preco de venda", "venda", "valor venda"]) : (hasCode ? 3 : 2);
      fillColumn("catalogCodesInput", usefulRows.map((row) => codeIndex >= 0 ? row[codeIndex] || "" : ""));
      fillColumn("catalogNamesInput", usefulRows.map((row) => nameIndex >= 0 ? row[nameIndex] || "" : ""));
      fillColumn("catalogPricesInput", usefulRows.map((row) => costIndex >= 0 ? row[costIndex] || "" : ""));
      fillColumn("catalogSalePricesInput", usefulRows.map((row) => saleIndex >= 0 ? row[saleIndex] || "" : ""));
    }

    function fillSalesFromRows(rows) {
      const header = rows[0] || [];
      const hasHeader = looksLikeHeader(header, ["codigo", "produto", "mes", "jan", "venda"]);
      const usefulRows = hasHeader ? rows.slice(1) : rows;
      const hasCode = hasHeader ? headerColumnIndex(header, ["codigo", "cod", "sku"]) >= 0 : (rows[0] || []).length >= salesMonths.length + 2;
      const codeIndex = hasHeader ? headerColumnIndex(header, ["codigo", "cod", "sku"]) : (hasCode ? 0 : -1);
      const nameIndex = hasHeader ? headerColumnIndex(header, ["produto", "nome", "descricao"]) : (hasCode ? 1 : 0);
      fillColumn("salesCodesInput", usefulRows.map((row) => codeIndex >= 0 ? row[codeIndex] || "" : ""));
      fillColumn("salesNamesInput", usefulRows.map((row) => nameIndex >= 0 ? row[nameIndex] || "" : ""));
      salesMonths.forEach((month, monthIndex) => {
        const monthName = normalizeName(month);
        const sourceIndex = hasHeader
          ? headerColumnIndex(header, [monthName, monthName.slice(0, 3)])
          : (hasCode ? 2 : 1) + monthIndex;
        fillColumn(`salesMonth${monthIndex + 1}Input`, usefulRows.map((row) => sourceIndex >= 0 ? row[sourceIndex] || "" : ""));
      });
    }

    async function loadImportFile(kind, input) {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const rows = await rowsFromFile(file);
        if (kind === "catalog") {
          fillCatalogFromRows(rows);
        } else {
          fillSalesFromRows(rows);
        }
        toast(`${file.name} carregado. Confira as colunas e clique em importar.`);
      } catch (error) {
        toast(error.message || "Nao foi possivel ler o arquivo.");
        input.value = "";
      }
    }

    function parseNumber(value) {
      const raw = String(value || "0").replace(/[^\d,.-]/g, "");
      const hasComma = raw.includes(",");
      const clean = hasComma ? raw.replace(/\./g, "").replace(",", ".") : raw;
      return Number(clean) || 0;
    }

    function suggestedQty(product) {
      if (!product || !Array.isArray(product.sales) || product.sales.length === 0) return 1;
      const average = product.sales.reduce((sum, value) => sum + value, 0) / product.sales.length;
      return Math.max(1, Math.ceil(average));
    }

    function movingAverage(product, periods = 3) {
      if (!product || !Array.isArray(product.sales) || product.sales.length === 0) return 0;
      const values = product.sales.slice(-periods);
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function trendInfo(product) {
      if (!product || !Array.isArray(product.sales) || product.sales.length < 2) {
        return { label: "Sem historico", className: "pending" };
      }

      const first = product.sales[0];
      const last = product.sales[product.sales.length - 1];
      if (first === 0 && last > 0) return { label: "Crescimento novo", className: "approved" };
      if (first === 0 && last === 0) return { label: "Estavel", className: "pending" };

      const percent = ((last - first) / first) * 100;
      if (percent > 5) return { label: `Crescendo ${percent.toFixed(1)}%`, className: "approved" };
      if (percent < -5) return { label: `Caindo ${Math.abs(percent).toFixed(1)}%`, className: "rejected" };
      return { label: "Estavel", className: "pending" };
    }

    function productSalesValue(product) {
      const totalSales = Array.isArray(product.sales) ? product.sales.reduce((sum, value) => sum + value, 0) : 0;
      return totalSales * (Number(product.price) || 0);
    }

    function abcMap(products) {
      const ranked = [...products]
        .map((product) => ({ product, value: productSalesValue(product) }))
        .sort((a, b) => b.value - a.value);
      const total = ranked.reduce((sum, item) => sum + item.value, 0);
      const map = {};
      let accumulated = 0;

      ranked.forEach((item) => {
        accumulated += item.value;
        const percent = total > 0 ? (accumulated / total) * 100 : 100;
        map[item.product.id] = percent <= 80 ? "A" : percent <= 95 ? "B" : "C";
      });

      return map;
    }

    function currentInstallments() {
      return Math.max(1, Number(document.getElementById("installmentsInput")?.value) || 1);
    }

    function toast(message) {
      const toastEl = document.getElementById("toast");
      toastEl.textContent = message;
      toastEl.classList.add("show");
      window.clearTimeout(toastEl.hideTimer);
      toastEl.hideTimer = window.setTimeout(() => toastEl.classList.remove("show"), 2200);
    }

    function setTab(tab) {
      if (!canAccessTab(tab)) {
        tab = firstAllowedTab();
      }
      activeTab = tab;
      document.querySelectorAll(".tab-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tab);
      });
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.classList.toggle("active", panel.id === tab);
      });
      document.getElementById("pageTitle").textContent = tabText[tab][0];
      document.getElementById("pageDescription").textContent = tabText[tab][1];
      document.getElementById("searchInput").style.display = tab === "catalogo" ? "block" : "none";
      render();
    }

    function renderAuth() {
      const loggedIn = Boolean(currentUser);
      document.getElementById("loginScreen").style.display = loggedIn ? "none" : "grid";
      document.getElementById("appShell").classList.toggle("locked", !loggedIn);

      if (!loggedIn) return;

      document.getElementById("userPill").textContent = currentUser.name;
      document.getElementById("resetButton").style.display = isAdmin() ? "inline-flex" : "none";
      document.querySelectorAll(".tab-button").forEach((button) => {
        button.style.display = canAccessTab(button.dataset.tab) ? "grid" : "none";
      });

      if (!canAccessTab(activeTab)) {
        activeTab = firstAllowedTab();
      }
      setTab(activeTab);
    }

    async function login(event) {
      event.preventDefault();
      const role = document.getElementById("loginRole").value;
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const user = users[role];
      const loginEmail = email || user?.email || "";

      if (!user || !loginEmail || !password) {
        toast("Informe e-mail e senha.");
        return;
      }

      try {
        const initialSession = await signInSupabase(loginEmail, password);
        const session = await completeMfaIfNeeded(initialSession);
        saveSupabaseSession(session);
        const authenticatedRole = await loadAuthenticatedProfile();
        if (authenticatedRole !== role) {
          throw new Error("O perfil selecionado nao corresponde a este usuario.");
        }
        saveRememberedLogin(role, loginEmail);
        saveUser(authenticatedRole);
        await loadRemoteState();
        document.getElementById("loginPassword").value = "";
        renderAuth();
        toast(`Login realizado como ${user.name}. Dados carregados do Supabase.`);
      } catch (error) {
        localStorage.removeItem("purchaseSystemUser");
        localStorage.removeItem("purchaseSystemSupabaseSession");
        supabaseSession = null;
        currentUser = null;
        toast(error.message || "Nao consegui entrar no Supabase.");
      }
    }

    async function logout(revokeSession = true) {
      const accessToken = supabaseSession?.access_token;
      if (revokeSession && accessToken) {
        try {
          await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` }
          });
        } catch (error) {
          // A sessao local ainda deve ser encerrada quando a rede estiver indisponivel.
        }
      }
      localStorage.removeItem("purchaseSystemUser");
      localStorage.removeItem("purchaseSystemSupabaseSession");
      supabaseSession = null;
      remoteStateLoaded = false;
      remoteUpdatedAt = "";
      currentUser = null;
      activeTab = "catalogo";
      closeOrderModal();
      renderAuth();
    }

    async function restoreAuthenticatedSession() {
      const role = await loadAuthenticatedProfile();
      saveUser(role);
      await loadRemoteState();
      renderAuth();
    }

    function addToList(productId, qty) {
      const product = productById(productId);
      if (!product || product.active === false) {
        toast("Este produto esta arquivado e nao pode entrar em uma lista.");
        return;
      }
      const quantity = Math.max(1, Number(qty) || 1);
      const list = activeList();
      const existing = list.find((item) => item.productId === product.id);

      if (existing) {
        existing.qty += quantity;
      } else {
        list.push({ productId: product.id, qty: quantity });
      }

      saveState();
      toast(`${product.code} - ${product.name} adicionado a lista.`);
      render();
    }

    function updateListQty(productId, qty) {
      const item = state.list.find((entry) => entry.productId === Number(productId));
      if (!item) return;
      item.qty = Math.max(1, Number(qty) || 1);
      saveState();
      render();
    }

    function removeFromList(productId) {
      if (isStoreUser()) {
        state.storeLists[currentUser.storeKey] = state.storeLists[currentUser.storeKey].filter((item) => item.productId !== Number(productId));
      } else {
        state.list = state.list.filter((item) => item.productId !== Number(productId));
      }
      state.selectedFromList = state.selectedFromList.filter((id) => id !== Number(productId));
      state.orderDraft = state.orderDraft.filter((id) => id !== Number(productId));
      delete state.orderQty[productId];
      delete state.orderPrice[productId];
      saveState();
      render();
    }

    function removeProduct(productId) {
      if (currentUser?.role !== "admin") return;
      const product = productById(productId);
      if (!product || product.active === false) return;
      if (!confirm(`Arquivar ${product.code} - ${product.name}? O historico dos pedidos sera preservado.`)) return;

      product.active = false;
      product.archivedAt = new Date().toISOString();
      product.archivedBy = currentUser.name;
      state.list = state.list.filter((item) => item.productId !== Number(productId));
      Object.keys(state.storeLists || {}).forEach((storeKey) => {
        state.storeLists[storeKey] = state.storeLists[storeKey].filter((item) => item.productId !== Number(productId));
      });
      state.selectedFromList = state.selectedFromList.filter((id) => id !== Number(productId));
      state.orderDraft = state.orderDraft.filter((id) => id !== Number(productId));
      delete state.orderQty[productId];
      delete state.orderPrice[productId];

      recordAudit("catalog", "Produto arquivado", product.id, `${product.code} - ${product.name}`);
      saveState();
      render();
      toast("Produto arquivado. O historico foi preservado.");
    }

    function restoreProduct(productId) {
      if (!isAdmin()) return;
      const product = productById(productId);
      if (!product || product.active !== false) return;
      product.active = true;
      product.archivedAt = "";
      product.archivedBy = "";
      recordAudit("catalog", "Produto restaurado", product.id, `${product.code} - ${product.name}`);
      saveState();
      render();
      toast("Produto restaurado no catalogo.");
    }

    function selectedOrderItems() {
      return state.list
        .filter((item) => state.orderDraft.includes(item.productId))
        .map((item) => {
          const product = productById(item.productId);
          const qty = Math.max(1, Number(state.orderQty[item.productId]) || suggestedQty(product));
          const unitPrice = Math.max(0, Number(state.orderPrice[item.productId]) || product?.price || 0);
          const suggested = suggestedQty(product);
          return { ...item, qty, unitPrice, suggestedQty: suggested };
        });
    }

    function totalFor(items) {
      return items.reduce((sum, item) => {
        const product = productById(item.productId);
        const unitPrice = Number(item.unitPrice ?? product?.price ?? 0) || 0;
        return sum + (unitPrice * item.qty);
      }, 0);
    }

    function receivingItems(order) {
      const deliveredByProduct = {};
      (order.receiving?.deliveries || []).forEach((delivery) => {
        (delivery.items || []).forEach((item) => {
          deliveredByProduct[item.productId] = (deliveredByProduct[item.productId] || 0) + (Number(item.receivedQty) || 0);
        });
      });
      return order.items.map((item) => {
        const saved = order.receiving?.items?.[item.productId] || {};
        const previousQty = Math.max(0, Number(deliveredByProduct[item.productId]) || 0);
        const remainingQty = Math.max(0, (Number(item.qty) || 0) - previousQty);
        return {
          ...item,
          previousQty,
          remainingQty,
          receivedQty: Math.max(0, Number(saved.receivedQty ?? remainingQty) || 0),
          receivedPrice: Math.max(0, Number(saved.receivedPrice ?? item.unitPrice) || 0)
        };
      });
    }

    function receiptEntries(order) {
      const deliveries = order.receiving?.deliveries || [];
      if (deliveries.length) {
        return deliveries.map((delivery) => ({
          ...delivery,
          total: (delivery.items || []).reduce((sum, item) => sum + (Number(item.receivedQty) || 0) * (Number(item.receivedPrice) || 0), 0)
        }));
      }
      if (!order.receiving?.confirmedAt) return [];
      const legacyItems = order.items.map((item) => {
        const saved = order.receiving?.items?.[item.productId] || {};
        return { productId: item.productId, receivedQty: Number(saved.receivedQty ?? item.qty) || 0, receivedPrice: Number(saved.receivedPrice ?? item.unitPrice) || 0 };
      });
      return [{ id: `legacy-${order.id}`, confirmedAt: order.receiving.confirmedAt, confirmedBy: "Sistema", items: legacyItems, total: legacyItems.reduce((sum, item) => sum + item.receivedQty * item.receivedPrice, 0) }];
    }

    function receivingTotal(order) {
      return receiptEntries(order).reduce((sum, entry) => sum + entry.total, 0);
    }

    function receivingDivergences(order) {
      if (!["approved", "received"].includes(order.status)) return 0;
      const entries = receiptEntries(order);
      return order.items.filter((orderedItem) => {
        const receivedItems = entries.flatMap((entry) => entry.items || []).filter((item) => Number(item.productId) === Number(orderedItem.productId));
        const totalQty = receivedItems.reduce((sum, item) => sum + (Number(item.receivedQty) || 0), 0);
        const priceChanged = receivedItems.some((item) => Math.abs((Number(item.receivedPrice) || 0) - (Number(orderedItem.unitPrice) || 0)) > 0.009);
        return Math.abs(totalQty - (Number(orderedItem.qty) || 0)) > 0.009 || priceChanged;
      }).length;
    }

    function currentMonthValue() {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    function monthValueFromDateText(dateText) {
      const text = String(dateText || "").trim();
      const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (brDate) {
        return `${brDate[3]}-${String(brDate[2]).padStart(2, "0")}`;
      }
      const parsed = new Date(text);
      if (Number.isNaN(parsed.getTime())) return "";
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    }

    function dateTimeText(dateText) {
      const text = String(dateText || "").trim();
      if (!text) return "-";
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) return text;
      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? text : parsed.toLocaleString("pt-BR");
    }

    function shortDateText(dateText) {
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) return String(dateText || "-").slice(0, 10);
      return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }

    function renderReceivingMonthSummary() {
      const monthInput = document.getElementById("receivingMonthInput");
      if (!monthInput.value) monthInput.value = currentMonthValue();
      const selectedMonth = monthInput.value;
      const entries = state.orders.flatMap((order) => receiptEntries(order)).filter((entry) => monthValueFromDateText(entry.confirmedAt) === selectedMonth);
      const total = entries.reduce((sum, entry) => sum + entry.total, 0);

      document.getElementById("receivedMonthTotalStat").textContent = money(total);
      document.getElementById("receivedMonthCountStat").textContent = `${entries.length} entrega(s) registrada(s)`;
    }

    function renderCatalog() {
      const term = normalizeName(document.getElementById("searchInput").value);
      const statusFilter = document.getElementById("catalogStatusFilter");
      statusFilter.style.display = isAdmin() ? "block" : "none";
      const selectedStatus = isAdmin() ? statusFilter.value : "active";
      const listedProductIds = new Set(activeList().map((item) => item.productId));
      const filtered = state.products.filter((product) => {
        if (listedProductIds.has(product.id)) return false;
        const matchesTerm = normalizeName(product.name).includes(term) || normalizeName(product.code).includes(term);
        const matchesStatus = selectedStatus === "all" ||
          (selectedStatus === "active" && product.active !== false) ||
          (selectedStatus === "archived" && product.active === false);
        return matchesTerm && matchesStatus;
      });
      const abc = abcMap(state.products.filter((product) => product.active !== false));
      const showPrices = !isStoreUser();
      const showIndicators = !isStoreUser();
      const showAdminDelete = currentUser?.role === "admin";
      const totalPages = Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE));
      catalogPage = Math.min(Math.max(1, catalogPage), totalPages);
      const pageStart = (catalogPage - 1) * CATALOG_PAGE_SIZE;
      const visibleProducts = filtered.slice(pageStart, pageStart + CATALOG_PAGE_SIZE);

      document.getElementById("catalogTableHead").innerHTML = `
        <tr>
          <th>Codigo</th>
          <th>Produto</th>
          ${showPrices ? "<th>Preco custo</th><th>Preco venda</th>" : ""}
          ${showIndicators ? "<th>Tendencia</th><th>Media movel</th><th>ABC</th>" : ""}
          <th>Acoes</th>
        </tr>
      `;

      document.getElementById("catalogTable").innerHTML = visibleProducts.map((product) => `
        ${(() => {
          const trend = trendInfo(product);
          const abcClass = abc[product.id] || "C";
          const priceCells = showPrices ? `
          <td><strong>${money(Number(product.price) || 0)}</strong></td>
          <td><strong>${money(Number(product.salePrice) || 0)}</strong></td>
          ` : "";
          return `
        <tr>
          <td><strong>${escapeHtml(product.code)}</strong></td>
          <td>
            <strong>${escapeHtml(product.name)}</strong>
            ${product.active === false ? `<br><span class="status rejected">Arquivado</span>` : ""}
          </td>
          ${priceCells}
          ${showIndicators ? `
          <td><span class="status ${trend.className}">${trend.label}</span></td>
          <td><strong>${formatInputMoney(movingAverage(product))}</strong></td>
          <td><span class="tag abc-${abcClass.toLowerCase()}">Classe ${abcClass}</span></td>
          ` : ""}
          <td>
            <div class="row-actions">
              ${product.active !== false ? `<button class="button" type="button" onclick="addToList(${product.id}, 1)">Adicionar</button>` : ""}
              ${showPrices ? `<button class="button secondary" type="button" onclick="openPriceHistory(${product.id})">Historico</button>` : ""}
              ${showAdminDelete && product.active !== false ? `<button class="button danger" type="button" title="Arquivar produto" onclick="removeProduct(${product.id})">Arquivar</button>` : ""}
              ${showAdminDelete && product.active === false ? `<button class="button success" type="button" title="Restaurar produto" onclick="restoreProduct(${product.id})">Restaurar</button>` : ""}
            </div>
          </td>
        </tr>
          `;
        })()}
      `).join("");

      document.getElementById("catalogEmpty").style.display = filtered.length ? "none" : "block";
      document.querySelector("#catalogo .table-wrap").style.display = filtered.length ? "block" : "none";
      document.getElementById("catalogPagination").style.display = filtered.length ? "flex" : "none";
      const firstVisible = filtered.length ? pageStart + 1 : 0;
      const lastVisible = Math.min(pageStart + CATALOG_PAGE_SIZE, filtered.length);
      document.getElementById("catalogPageInfo").textContent = `${firstVisible}-${lastVisible} de ${filtered.length} produto(s) | Pagina ${catalogPage} de ${totalPages}`;
      document.getElementById("catalogPrevButton").disabled = catalogPage <= 1;
      document.getElementById("catalogNextButton").disabled = catalogPage >= totalPages;
    }

    function openPriceHistory(productId) {
      if (!canAccessTab("historicoPreco")) return;
      selectedPriceHistoryProductId = Number(productId);
      setTab("historicoPreco");
    }

    function priceIncreaseAlerts() {
      if (isStoreUser()) return [];
      const threshold = Math.max(0, Number(state.settings.priceIncreaseAlertPercent) || 0);
      if (!threshold) return [];
      return state.products.filter((product) => product.active !== false).flatMap((product) => {
        const entries = priceHistoryForProduct(product.id);
        if (entries.length < 2) return [];
        const current = entries[entries.length - 1];
        const previous = entries[entries.length - 2];
        const variation = priceVariationPercent(current.costPrice, previous.costPrice);
        if (variation < threshold) return [];
        return [{
          level: "rejected",
          title: `Aumento de preco: ${product.code} - ${product.name}`,
          detail: `+${variation.toFixed(1)}% | ${money(previous.costPrice)} para ${money(current.costPrice)}`,
          tab: "historicoPreco",
          productId: product.id
        }];
      });
    }

    function renderPriceHistory() {
      const select = document.getElementById("priceHistoryProductSelect");
      const products = [...state.products].sort((a, b) => String(a.code).localeCompare(String(b.code), "pt-BR", { numeric: true }));
      const preservedId = selectedPriceHistoryProductId || Number(select.value) || products[0]?.id || 0;
      select.innerHTML = products.map((product) => `<option value="${product.id}">${escapeHtml(product.code)} - ${escapeHtml(product.name)}${product.active === false ? " (arquivado)" : ""}</option>`).join("");
      selectedPriceHistoryProductId = products.some((product) => product.id === Number(preservedId)) ? Number(preservedId) : products[0]?.id || null;
      if (selectedPriceHistoryProductId) select.value = String(selectedPriceHistoryProductId);

      const product = productById(selectedPriceHistoryProductId);
      const entries = product ? priceHistoryForProduct(product.id) : [];
      const latest = entries[entries.length - 1];
      const previous = entries[entries.length - 2];
      const variation = latest && previous ? priceVariationPercent(latest.costPrice, previous.costPrice) : 0;
      const costs = entries.map((entry) => entry.costPrice);

      document.getElementById("priceHistoryCurrentCost").textContent = latest ? money(latest.costPrice) : "-";
      document.getElementById("priceHistoryCurrentSale").textContent = latest ? money(latest.salePrice) : "-";
      document.getElementById("priceHistoryVariation").textContent = entries.length > 1 ? `${variation > 0 ? "+" : ""}${variation.toFixed(1)}%` : "Sem comparacao";
      document.getElementById("priceHistoryVariation").className = variation > 0 ? "price-up" : variation < 0 ? "price-down" : "";
      document.getElementById("priceHistoryRange").textContent = costs.length ? `${money(Math.min(...costs))} a ${money(Math.max(...costs))}` : "-";

      const chartEntries = entries.slice(-12);
      const chartMax = Math.max(1, ...chartEntries.flatMap((entry) => [entry.costPrice, entry.salePrice]));
      document.getElementById("priceHistoryChart").innerHTML = chartEntries.map((entry) => `
        <div class="price-point" title="${escapeHtml(dateTimeText(entry.changedAt))} | Custo ${money(entry.costPrice)} | Venda ${money(entry.salePrice)}">
          <div class="price-bars">
            <span class="price-bar cost" style="height:${Math.max(3, (entry.costPrice / chartMax) * 100)}%"></span>
            <span class="price-bar sale" style="height:${Math.max(3, (entry.salePrice / chartMax) * 100)}%"></span>
          </div>
          <span>${escapeHtml(shortDateText(entry.changedAt))}</span>
        </div>
      `).join("");

      const rows = entries.map((entry, index) => {
        const prior = entries[index - 1];
        const rowVariation = prior ? priceVariationPercent(entry.costPrice, prior.costPrice) : 0;
        const variationText = prior ? `${rowVariation > 0 ? "+" : ""}${rowVariation.toFixed(1)}%` : "Base";
        return `<tr><td>${escapeHtml(dateTimeText(entry.changedAt))}</td><td><strong>${money(entry.costPrice)}</strong></td><td>${money(entry.salePrice)}</td><td><span class="${rowVariation > 0 ? "price-up" : rowVariation < 0 ? "price-down" : ""}">${variationText}</span></td><td>${escapeHtml(entry.source)}</td><td>${escapeHtml(entry.changedBy)}</td></tr>`;
      }).reverse();
      document.getElementById("priceHistoryTable").innerHTML = rows.join("");
      document.getElementById("priceHistoryEmpty").style.display = entries.length ? "none" : "block";
      document.querySelector("#historicoPreco .table-wrap").style.display = entries.length ? "block" : "none";
      document.getElementById("priceHistoryChartEmpty").style.display = chartEntries.length ? "none" : "block";
      document.getElementById("priceHistoryChart").style.display = chartEntries.length ? "grid" : "none";
      document.getElementById("priceAlertRulePanel").style.display = isAdmin() ? "block" : "none";
      document.getElementById("priceIncreaseAlertInput").value = String(state.settings.priceIncreaseAlertPercent);
    }

    function savePriceAlertRule() {
      if (!isAdmin()) return;
      state.settings.priceIncreaseAlertPercent = Math.max(0, Number(document.getElementById("priceIncreaseAlertInput").value) || 0);
      recordAudit("system", "Regra de aumento de preco atualizada", "", `Alerta a partir de ${state.settings.priceIncreaseAlertPercent.toFixed(1)}%`);
      saveState();
      render();
      toast("Regra de alerta de preco salva.");
    }

    function exportPriceHistory() {
      const product = productById(selectedPriceHistoryProductId);
      if (!product) return;
      const entries = priceHistoryForProduct(product.id);
      const csv = [
        "Codigo;Produto;Data;Preco custo;Preco venda;Origem;Responsavel",
        ...entries.map((entry) => [product.code, product.name, dateTimeText(entry.changedAt), entry.costPrice.toFixed(2), entry.salePrice.toFixed(2), entry.source, entry.changedBy].map(csvCell).join(";"))
      ].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `historico-precos-${product.code}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }

    function renderSuppliers() {
      const table = document.getElementById("supplierTable");
      const empty = document.getElementById("supplierEmpty");
      const select = document.getElementById("supplierSelect");
      const selectedValue = select.value;
      const hasSuppliers = state.suppliers.length > 0;

      table.innerHTML = state.suppliers.map((supplier) => `
        <tr>
          <td><strong>${escapeHtml(supplier.name)}</strong></td>
          <td>${escapeHtml(supplier.contact || "-")}</td>
          <td>${escapeHtml(supplier.phone || "-")}</td>
          <td>${escapeHtml(supplier.terms || "-")}</td>
          <td>
            <div class="row-actions">
              <button class="button danger icon-only" type="button" title="Remover" onclick="removeSupplier(${supplier.id})">x</button>
            </div>
          </td>
        </tr>
      `).join("");

      empty.style.display = hasSuppliers ? "none" : "block";
      document.querySelector("#fornecedores .table-wrap").style.display = hasSuppliers ? "block" : "none";
      select.innerHTML = `<option value="">Selecione</option>` + state.suppliers.map((supplier) => `
        <option value="${supplier.id}">${escapeHtml(supplier.name)}</option>
      `).join("");
      if (state.suppliers.some((supplier) => String(supplier.id) === selectedValue)) {
        select.value = selectedValue;
      }
    }

    function clearSupplierForm() {
      ["supplierNameInput", "supplierContactInput", "supplierPhoneInput", "supplierTermsInput", "supplierNotesInput"].forEach((id) => {
        document.getElementById(id).value = "";
      });
    }

    function nextSupplierId() {
      return Math.max(0, ...state.suppliers.map((supplier) => Number(supplier.id) || 0)) + 1;
    }

    function saveSupplier() {
      if (!isAdmin()) {
        toast("Somente admin pode cadastrar fornecedores.");
        return;
      }
      const name = document.getElementById("supplierNameInput").value.trim();
      const contact = document.getElementById("supplierContactInput").value.trim();
      const phone = document.getElementById("supplierPhoneInput").value.trim();
      const terms = document.getElementById("supplierTermsInput").value.trim();
      const notes = document.getElementById("supplierNotesInput").value.trim();

      if (!name) {
        toast("Informe o nome do fornecedor.");
        return;
      }

      const existing = state.suppliers.find((supplier) => normalizeName(supplier.name) === normalizeName(name));
      if (existing) {
        existing.contact = contact;
        existing.phone = phone;
        existing.terms = terms;
        existing.notes = notes;
      } else {
        state.suppliers.push({ id: nextSupplierId(), name, contact, phone, terms, notes });
      }

      recordAudit("supplier", existing ? "Fornecedor atualizado" : "Fornecedor cadastrado", existing?.id || state.suppliers[state.suppliers.length - 1]?.id, name);
      saveState();
      clearSupplierForm();
      render();
      toast(existing ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
    }

    function removeSupplier(supplierId) {
      if (!isAdmin()) {
        toast("Somente admin pode remover fornecedores.");
        return;
      }
      const supplier = supplierById(supplierId);
      if (!supplier) return;
      if (!confirm(`Remover ${supplier.name}?`)) return;
      state.suppliers = state.suppliers.filter((entry) => entry.id !== Number(supplierId));
      recordAudit("supplier", "Fornecedor removido", supplier.id, supplier.name);
      saveState();
      render();
      toast("Fornecedor removido.");
    }

    function renderList() {
      const table = document.getElementById("listTable");
      const empty = document.getElementById("listEmpty");
      const list = activeList();
      const hasItems = list.length > 0;
      const abc = abcMap(state.products);
      const showIndicators = !isStoreUser();
      const showSelection = !isStoreUser();

      document.getElementById("listTableHead").innerHTML = `
        <tr>
          ${showSelection ? "<th>Selecionar</th>" : ""}
          <th>Codigo</th>
          <th>Produto</th>
          ${showIndicators ? "<th>Tendencia</th><th>Media movel</th><th>ABC</th>" : ""}
          <th>Acoes</th>
        </tr>
      `;

      table.innerHTML = list.map((item) => {
        const product = productById(item.productId);
        if (!product) return "";
        const checked = state.selectedFromList.includes(product.id) ? "checked" : "";
        const trend = trendInfo(product);
        const abcClass = abc[product.id] || "C";
        return `
          <tr>
            ${showSelection ? `
            <td>
              <input class="checkbox" type="checkbox" ${checked} onchange="toggleListItem(${product.id}, this.checked)" aria-label="Selecionar ${escapeHtml(product.name)}">
            </td>
            ` : ""}
            <td><strong>${escapeHtml(product.code)}</strong></td>
            <td><strong>${escapeHtml(product.name)}</strong></td>
            ${showIndicators ? `
            <td><span class="status ${trend.className}">${trend.label}</span></td>
            <td><strong>${formatInputMoney(movingAverage(product))}</strong></td>
            <td><span class="tag abc-${abcClass.toLowerCase()}">Classe ${abcClass}</span></td>
            ` : ""}
            <td>
              <div class="row-actions">
                <button class="button danger icon-only" type="button" title="Remover" onclick="removeFromList(${product.id})">x</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");

      empty.style.display = hasItems ? "none" : "block";
      document.querySelector("#lista .table-wrap").style.display = hasItems ? "block" : "none";
      document.getElementById("goOrderButton").style.display = isStoreUser() ? "none" : "inline-flex";
      document.getElementById("listSelectedCard").style.display = isStoreUser() ? "none" : "block";
      document.getElementById("goOrderButton").disabled = state.selectedFromList.length === 0;
      document.getElementById("listItemsStat").textContent = list.length;
      document.getElementById("listSelectedStat").textContent = state.selectedFromList.length;
    }

    function toggleListItem(productId, checked) {
      const id = Number(productId);
      if (checked && !state.selectedFromList.includes(id)) {
        state.selectedFromList.push(id);
      }
      if (!checked) {
        state.selectedFromList = state.selectedFromList.filter((selectedId) => selectedId !== id);
      }
      saveState();
      renderList();
      renderCounts();
    }

    function renderStoreList(storeKey) {
      const suffix = storeKey === "iconha" ? "Iconha" : "Reta";
      const table = document.getElementById(`storeList${suffix}Table`);
      const empty = document.getElementById(`storeList${suffix}Empty`);
      const list = state.storeLists[storeKey] || [];
      const abc = abcMap(state.products);

      table.innerHTML = list.map((item) => {
        const product = productById(item.productId);
        if (!product) return "";
        const trend = trendInfo(product);
        const abcClass = abc[product.id] || "C";
        return `
          <tr>
            <td><strong>${escapeHtml(product.code)}</strong></td>
            <td><strong>${escapeHtml(product.name)}</strong></td>
            <td>${item.qty}</td>
            <td><span class="status ${trend.className}">${trend.label}</span></td>
            <td><strong>${formatInputMoney(movingAverage(product))}</strong></td>
            <td><span class="tag abc-${abcClass.toLowerCase()}">Classe ${abcClass}</span></td>
          </tr>
        `;
      }).join("");

      table.closest(".table-wrap").style.display = list.length ? "block" : "none";
      empty.style.display = list.length ? "none" : "block";
    }

    function storeLabel(storeKey) {
      return storeKey === "iconha" ? "LOJA ICONHA" : "LOJA RETA";
    }

    function createCompletedOrderFromStore(storeKey) {
      if (currentUser?.role !== "comprasInternas") {
        toast("Somente Compras internas pode transformar listas das lojas em pedido.");
        return;
      }
      const list = state.storeLists[storeKey] || [];
      if (!list.length) {
        toast(`A lista da ${storeLabel(storeKey)} esta vazia.`);
        return;
      }

      const items = list.map((item) => {
        const product = productById(item.productId);
        return {
          productId: item.productId,
          productCode: product?.code || "",
          productName: product?.name || "Produto removido",
          qty: Math.max(1, Number(item.qty) || 1),
          unitPrice: product?.price || 0,
          suggestedQty: suggestedQty(product)
        };
      });

      const now = new Date().toISOString();
      const order = {
        id: Date.now(),
        supplierId: "",
        supplier: "LOJA PETVILLE",
        supplierContact: "",
        supplierPhone: "",
        supplierTerms: "",
        buyer: storeLabel(storeKey),
        sourceStore: storeKey,
        priority: "Normal",
        delivery: "",
        installments: 1,
        installmentValue: totalFor(items),
        notes: "Pedido criado automaticamente por Compras Internas.",
        status: "completed",
        createdAt: now,
        approvedAt: now,
        completedAt: now,
        receiving: { items: {}, confirmedAt: now },
        items
      };

      state.orders.unshift(order);
      state.storeLists[storeKey] = [];
      recordAudit("order", "Pedido interno concluido", order.id, `${storeLabel(storeKey)} | ${items.length} item(ns) | ${money(totalFor(items))}`);
      saveState();
      setTab("pedidoConcluido");
      toast("Pedido concluido criado automaticamente.");
    }

    function sendSelectedListToOrder() {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) {
        toast("Este perfil nao pode montar pedidos.");
        return;
      }
      if (!state.selectedFromList.length) {
        toast("Selecione pelo menos um item na lista.");
        return;
      }

      state.orderDraft = state.selectedFromList.filter((id) => state.list.some((item) => item.productId === id));
      state.orderQty = {};
      state.orderPrice = {};
      state.orderDraft.forEach((id) => {
        const product = productById(id);
        state.orderQty[id] = suggestedQty(product);
        state.orderPrice[id] = product?.price || 0;
      });
      saveState();
      setTab("pedido");
      toast("Itens selecionados enviados para o pedido.");
    }

    function renderOrder() {
      const selection = document.getElementById("orderSelection");
      const empty = document.getElementById("orderEmpty");
      const draftItems = selectedOrderItems();
      const hasItems = draftItems.length > 0;

      selection.style.display = hasItems ? "block" : "none";
      empty.style.display = hasItems ? "none" : "block";
      selection.innerHTML = draftItems.map((item) => {
        const product = productById(item.productId);
        if (!product) return "";
        const checked = "checked";
        return `
          <label class="check-row">
            <input class="checkbox" type="checkbox" ${checked} onchange="toggleOrderItem(${product.id}, this.checked)">
            <span>
              <strong>${escapeHtml(product.code)} - ${escapeHtml(product.name)}</strong><br>
              <span class="muted">Sugestao: ${item.suggestedQty} un.</span>
            </span>
            <span class="row-actions">
              <span class="muted">Qtd sugerida: <strong>${item.suggestedQty}</strong></span>
              <span class="muted">Custo sugerido: <strong>${money(product.price)}</strong></span>
              <input class="input wide-input" type="number" min="1" value="${item.qty}" onchange="updateOrderQty(${product.id}, this.value)" aria-label="Quantidade do pedido de ${escapeHtml(product.name)}">
              <input class="input price-input" type="text" value="${formatInputMoney(item.unitPrice)}" onchange="updateOrderPrice(${product.id}, this.value)" aria-label="Valor unitario de ${escapeHtml(product.name)}">
              <strong>${money(item.unitPrice * item.qty)}</strong>
            </span>
          </label>
        `;
      }).join("");

      const selected = selectedOrderItems();
      const total = totalFor(selected);
      const installments = currentInstallments();
      document.getElementById("orderItemsStat").textContent = selected.length;
      document.getElementById("orderTotalStat").textContent = money(total);
      document.getElementById("installmentValueStat").textContent = money(total / installments);
      renderPaymentSchedule(total, installments);
    }

    function toggleOrderItem(productId, checked) {
      const id = Number(productId);
      if (checked && !state.orderDraft.includes(id)) {
        state.orderDraft.push(id);
      }
      if (!checked) {
        state.orderDraft = state.orderDraft.filter((selectedId) => selectedId !== id);
        delete state.orderQty[id];
        delete state.orderPrice[id];
      }
      saveState();
      renderOrder();
      renderCounts();
    }

    function selectAllOrderItems() {
      const sourceIds = state.selectedFromList.filter((id) => state.list.some((item) => item.productId === id));
      const allSelected = sourceIds.length > 0 && state.orderDraft.length === sourceIds.length;
      state.orderDraft = allSelected ? [] : sourceIds;
      state.orderDraft.forEach((id) => {
        if (!state.orderQty[id]) state.orderQty[id] = suggestedQty(productById(id));
        if (!state.orderPrice[id]) state.orderPrice[id] = productById(id)?.price || 0;
      });
      saveState();
      render();
    }

    function updateOrderQty(productId, qty) {
      state.orderQty[productId] = Math.max(1, Number(qty) || 1);
      saveState();
      renderOrder();
    }

    function updateOrderPrice(productId, price) {
      state.orderPrice[productId] = Math.max(0, parseNumber(price));
      saveState();
      renderOrder();
    }

    function sendApproval() {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) {
        toast("Este perfil nao pode enviar pedidos para aprovacao.");
        return;
      }
      const supplierId = Number(document.getElementById("supplierSelect").value);
      const supplier = supplierById(supplierId);
      const buyer = document.getElementById("buyerInput").value.trim();
      const priority = document.getElementById("prioritySelect").value;
      const delivery = document.getElementById("deliveryInput").value;
      const installments = currentInstallments();
      const interval = currentPaymentInterval();
      const notes = document.getElementById("notesInput").value.trim();
      const items = selectedOrderItems();

      if (!items.length) {
        toast("Selecione pelo menos um item para montar o pedido.");
        return;
      }

      if (!supplier) {
        toast("Escolha um fornecedor antes de enviar.");
        return;
      }

      const orderTotal = totalFor(items);
      const autoApprovalLimit = Math.max(0, Number(state.settings.autoApprovalLimit) || 0);
      const autoApproved = autoApprovalLimit > 0 && orderTotal <= autoApprovalLimit;
      const createdAt = new Date().toISOString();

      const order = {
        id: Date.now(),
        supplierId: supplier.id,
        supplier: supplier.name,
        supplierContact: supplier.contact,
        supplierPhone: supplier.phone,
        supplierTerms: supplier.terms,
        buyer: buyer || "Sem solicitante",
        priority,
        delivery,
        installments,
        interval,
        installmentValue: orderTotal / installments,
        notes,
        status: autoApproved ? "approved" : "pending",
        approvalType: autoApproved ? "automatic" : "manual",
        approvedAt: autoApproved ? createdAt : "",
        createdAt,
        receiving: { items: {}, deliveries: [], confirmedAt: "", lastPartialAt: "" },
        items: items.map((item) => {
          const product = productById(item.productId);
          return {
            ...item,
            productCode: product?.code || "",
            productName: product?.name || "Produto removido"
          };
        })
      };

      state.orders.unshift(order);
      if (autoApproved) {
        order.items.forEach((item) => {
          const product = productById(item.productId);
          recordPriceHistory(item.productId, item.unitPrice, product?.salePrice || 0, `Pedido #${order.id} aprovado automaticamente`, order.id, createdAt);
        });
      }
      const sentIds = items.map((item) => item.productId);
      state.list = state.list.filter((item) => !sentIds.includes(item.productId));
      state.selectedFromList = state.selectedFromList.filter((id) => !sentIds.includes(id));
      state.orderDraft = [];
      sentIds.forEach((id) => delete state.orderQty[id]);
      sentIds.forEach((id) => delete state.orderPrice[id]);

      document.getElementById("supplierSelect").value = "";
      document.getElementById("installmentsInput").value = "1";
      document.getElementById("intervalSelect").value = "30";
      document.getElementById("notesInput").value = "";

      recordAudit("order", autoApproved ? "Pedido aprovado automaticamente" : "Pedido enviado para aprovacao", order.id, `${order.supplier} | ${order.items.length} item(ns) | ${money(orderTotal)}`);
      saveState();
      setTab(autoApproved ? "recebimento" : "aprovacao");
      toast(autoApproved ? `Pedido aprovado automaticamente pela regra de ${money(autoApprovalLimit)}.` : "Pedido enviado para aprovacao.");
    }

    function renderApprovals() {
      const list = document.getElementById("approvalList");
      const empty = document.getElementById("approvalEmpty");
      const orders = state.orders.filter((order) => order.status !== "completed");
      const hasOrders = orders.length > 0;

      list.style.display = hasOrders ? "block" : "none";
      empty.style.display = hasOrders ? "none" : "block";
      list.innerHTML = orders.map((order) => {
        const total = totalFor(order.items);
        const statusLabel = statusText(order.status);
        const itemList = order.items.map((item) => {
          const product = productById(item.productId);
          const code = product?.code || item.productCode;
          const name = product?.name || item.productName || "Produto removido";
          return `${Number(item.qty) || 0}x ${code ? escapeHtml(code) + " - " : ""}${escapeHtml(name)}`;
        }).join(", ");
        const actions = order.status === "pending" && isAdmin() ? `
          <div class="row-actions">
            <button class="button success" type="button" onclick="event.stopPropagation(); decideOrder(${order.id}, 'approved')">Aprovar</button>
            <button class="button danger" type="button" onclick="event.stopPropagation(); decideOrder(${order.id}, 'rejected')">Recusar</button>
          </div>
        ` : "";

        return `
          <article class="approval-card" onclick="openOrderModal(${order.id})" tabindex="0" onkeydown="if(event.key === 'Enter') openOrderModal(${order.id})">
            <div class="approval-head">
              <div>
                <h3>Pedido #${order.id}</h3>
                <div class="muted">${escapeHtml(order.supplier)} | ${escapeHtml(order.buyer)} | ${escapeHtml(dateTimeText(order.createdAt))}</div>
              </div>
              <span class="status ${order.status}">${statusLabel}</span>
            </div>
            <div><strong>Itens:</strong> ${itemList}</div>
            <div class="muted">Prioridade: ${escapeHtml(order.priority)}${order.delivery ? " | Entrega: " + escapeHtml(order.delivery) : ""} | Boletos: ${order.installments || 1}x de ${money(order.installmentValue || total)}</div>
            ${order.notes ? `<div class="muted">Obs.: ${escapeHtml(order.notes)}</div>` : ""}
            <div class="approval-head">
              <strong>Total: ${money(total)}</strong>
              ${actions}
            </div>
          </article>
        `;
      }).join("");
    }

    function renderCompletedOrders() {
      const list = document.getElementById("completedOrderList");
      const empty = document.getElementById("completedOrderEmpty");
      const orders = state.orders.filter((order) => order.status === "completed");

      list.style.display = orders.length ? "block" : "none";
      empty.style.display = orders.length ? "none" : "block";
      list.innerHTML = orders.map((order) => {
        const total = totalFor(order.items);
        const itemList = order.items.map((item) => {
          const product = productById(item.productId);
          const code = product?.code || item.productCode;
          const name = product?.name || item.productName || "Produto removido";
          return `${Number(item.qty) || 0}x ${code ? escapeHtml(code) + " - " : ""}${escapeHtml(name)}`;
        }).join(", ");

        return `
          <article class="approval-card" onclick="openOrderModal(${order.id})" tabindex="0" onkeydown="if(event.key === 'Enter') openOrderModal(${order.id})">
            <div class="approval-head">
              <div>
                <h3>Pedido #${order.id}</h3>
                <div class="muted">${escapeHtml(order.buyer)} | ${escapeHtml(order.supplier)} | ${escapeHtml(dateTimeText(order.completedAt || order.createdAt))}</div>
              </div>
              <span class="status approved">Concluido</span>
            </div>
            <div><strong>Itens:</strong> ${itemList}</div>
            <div class="muted">Criado automaticamente por Compras Internas</div>
            <div class="approval-head">
              <strong>Total: ${money(total)}</strong>
            </div>
          </article>
        `;
      }).join("");
    }

    function decideOrder(orderId, status) {
      if (!isAdmin()) {
        toast("Somente admin pode aprovar ou recusar pedidos.");
        return;
      }
      const order = state.orders.find((entry) => entry.id === Number(orderId));
      if (!order) return;
      if (status === "rejected") {
        const reason = window.prompt("Informe a justificativa da recusa:", order.decisionReason || "");
        if (reason === null) return;
        if (!reason.trim()) {
          toast("A justificativa e obrigatoria para recusar.");
          return;
        }
        order.decisionReason = reason.trim();
      }
      order.status = status;
      const decidedAt = new Date().toISOString();
      if (status === "approved") order.approvedAt = decidedAt;
      if (status === "rejected") order.rejectedAt = decidedAt;
      if (status === "approved" && !order.receiving) {
        order.receiving = { items: {}, deliveries: [], confirmedAt: "", lastPartialAt: "" };
      }
      if (status === "approved") {
        order.items.forEach((item) => {
          const product = productById(item.productId);
          recordPriceHistory(item.productId, item.unitPrice, product?.salePrice || 0, `Pedido #${order.id} aprovado`, order.id, decidedAt);
        });
      }
      order.approvalType = status === "approved" ? "manual" : order.approvalType;
      recordAudit("order", status === "approved" ? "Pedido aprovado" : "Pedido recusado", order.id, `${order.supplier} | ${money(totalFor(order.items))}${order.decisionReason ? ` | ${order.decisionReason}` : ""}`);
      saveState();
      render();
      toast(status === "approved" ? "Pedido aprovado." : "Pedido recusado.");
    }

    function renderReceiving() {
      const list = document.getElementById("receivingList");
      const empty = document.getElementById("receivingEmpty");
      const orders = state.orders.filter((order) => ["approved", "received"].includes(order.status));

      renderReceivingMonthSummary();
      list.style.display = orders.length ? "block" : "none";
      empty.style.display = orders.length ? "none" : "block";
      list.innerHTML = orders.map((order) => {
        const complete = order.status === "received";
        const draftItems = receivingItems(order);
        const rows = draftItems.map((item) => {
          const product = productById(item.productId);
          const cumulativeQty = item.previousQty + item.receivedQty;
          const qtyOk = Math.abs(cumulativeQty - item.qty) < 0.009;
          const priceOk = Math.abs(item.receivedPrice - item.unitPrice) < 0.009;

          return `
            <tr>
              <td><strong>${escapeHtml(product?.code || item.productCode || "-")}</strong></td>
              <td><strong>${escapeHtml(product?.name || item.productName || "Produto removido")}</strong></td>
              <td>${item.qty}</td>
              <td>${item.previousQty}</td>
              <td>${item.remainingQty}</td>
              <td>
                <input class="input mini-input" type="number" min="0" value="${complete ? 0 : item.receivedQty}" ${complete ? "disabled" : ""} onchange="updateReceivingItem(${order.id}, ${item.productId}, 'receivedQty', this.value)">
              </td>
              <td>
                <input class="input price-input" type="text" value="${formatInputMoney(item.receivedPrice)}" ${complete ? "disabled" : ""} onchange="updateReceivingItem(${order.id}, ${item.productId}, 'receivedPrice', this.value)">
              </td>
              <td><span class="status ${qtyOk && priceOk ? "approved" : "pending"}">${priceOk ? (qtyOk ? "Completo" : "Parcial") : "Preco divergente"}</span></td>
              <td><strong>${money(item.receivedQty * item.receivedPrice)}</strong><br><span class="muted">Pedido: ${money(item.unitPrice)}</span></td>
            </tr>
          `;
        }).join("");
        const history = receiptEntries(order).map((delivery, index) => `<div class="muted"><strong>Entrega ${index + 1}</strong> | ${escapeHtml(dateTimeText(delivery.confirmedAt))} | ${escapeHtml(delivery.confirmedBy || "Sistema")} | ${money(delivery.total)}</div>`).join("");

        return `
          <article class="approval-card">
            <div class="approval-head">
              <div>
                <h3>Pedido #${order.id}</h3>
                <div class="muted">${escapeHtml(order.supplier)} | aprovado | ${escapeHtml(dateTimeText(order.createdAt))}</div>
              </div>
              <span class="status ${complete ? "approved" : "pending"}">${complete ? "Recebido" : receiptEntries(order).length ? "Recebimento parcial" : "Aguardando recebimento"}</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Produto</th>
                    <th>Qtd pedida</th>
                    <th>Ja recebida</th>
                    <th>Restante</th>
                    <th>Qtd desta entrega</th>
                    <th>Preco recebido</th>
                    <th>Status</th>
                    <th>Total desta entrega</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="approval-head">
              <div>
                <strong>Total acumulado recebido: ${money(receivingTotal(order))}</strong>
                <div class="muted">${receivingDivergences(order)} divergencia(s)</div>
              </div>
              ${complete ? "" : `<button class="button success" type="button" onclick="confirmReceiving(${order.id})">Registrar entrega</button>`}
            </div>
            ${history ? `<div class="receipt-history">${history}</div>` : ""}
          </article>
        `;
      }).join("");
    }

    function updateReceivingItem(orderId, productId, field, value) {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) return;
      const order = state.orders.find((entry) => entry.id === Number(orderId));
      if (!order || order.status === "received") return;
      if (!order.receiving) order.receiving = { items: {}, deliveries: [], confirmedAt: "", lastPartialAt: "" };
      if (!order.receiving.items[productId]) order.receiving.items[productId] = {};
      order.receiving.items[productId][field] = field === "receivedPrice" ? parseNumber(value) : Math.max(0, Number(value) || 0);
      saveState();
      renderReceiving();
      renderCounts();
    }

    function confirmReceiving(orderId) {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) {
        toast("Este perfil nao pode confirmar recebimentos.");
        return;
      }
      const order = state.orders.find((entry) => entry.id === Number(orderId));
      if (!order || order.status === "received") return;
      if (!order.receiving) order.receiving = { items: {}, deliveries: [], confirmedAt: "", lastPartialAt: "" };
      if (!Array.isArray(order.receiving.deliveries)) order.receiving.deliveries = [];
      const items = receivingItems(order).filter((item) => item.receivedQty > 0).map((item) => ({ productId: item.productId, receivedQty: item.receivedQty, receivedPrice: item.receivedPrice }));
      if (!items.length) {
        toast("Informe ao menos uma quantidade recebida.");
        return;
      }
      const confirmedAt = new Date().toISOString();
      const delivery = { id: `${order.id}-${Date.now()}`, confirmedAt, confirmedBy: currentUser.name, items };
      delivery.total = items.reduce((sum, item) => sum + item.receivedQty * item.receivedPrice, 0);
      order.receiving.deliveries.push(delivery);
      order.receiving.items = {};
      const complete = order.items.every((orderedItem) => receiptEntries(order).flatMap((entry) => entry.items || []).filter((item) => Number(item.productId) === Number(orderedItem.productId)).reduce((sum, item) => sum + (Number(item.receivedQty) || 0), 0) >= (Number(orderedItem.qty) || 0));
      order.receiving.lastPartialAt = confirmedAt;
      order.receiving.confirmedAt = complete ? confirmedAt : "";
      order.status = complete ? "received" : "approved";
      items.forEach((item) => {
        const product = productById(item.productId);
        if (!product) return;
        product.price = item.receivedPrice;
        recordPriceHistory(product.id, item.receivedPrice, product.salePrice, `Recebimento do pedido #${order.id}`, order.id, confirmedAt);
      });
      recordAudit("receipt", complete ? "Recebimento concluido" : "Recebimento parcial", order.id, `${order.supplier} | ${money(delivery.total)}`);
      saveState();
      render();
      toast(complete ? "Recebimento concluido." : "Entrega parcial registrada.");
    }

    function statusText(status) {
      if (status === "completed") return "Concluido";
      if (status === "received") return "Recebido";
      return status === "approved" ? "Aprovado" : status === "rejected" ? "Recusado" : "Pendente";
    }

    function openOrderModal(orderId) {
      const order = state.orders.find((entry) => entry.id === Number(orderId));
      if (!order) return;

      const total = totalFor(order.items);
      const rows = order.items.map((item) => {
        const product = productById(item.productId);
        const unitPrice = Number(item.unitPrice ?? product?.price ?? 0);
        const suggested = item.suggestedQty || suggestedQty(product);
        return `
          <tr>
            <td><strong>${escapeHtml(product?.code || item.productCode || "-")}</strong></td>
            <td><strong>${escapeHtml(product?.name || item.productName || "Produto removido")}</strong></td>
            <td>${suggested}</td>
            <td>${item.qty}</td>
            <td>${money(unitPrice)}</td>
            <td><strong>${money(unitPrice * item.qty)}</strong></td>
          </tr>
        `;
      }).join("");

      document.getElementById("modalTitle").textContent = `Pedido #${order.id}`;
      document.getElementById("modalContent").innerHTML = `
        <div class="detail-grid">
          <div class="detail-box"><span>Fornecedor</span><strong>${escapeHtml(order.supplier)}</strong></div>
          <div class="detail-box"><span>Contato fornecedor</span><strong>${escapeHtml(order.supplierContact || "-")}</strong></div>
          <div class="detail-box"><span>Telefone fornecedor</span><strong>${escapeHtml(order.supplierPhone || "-")}</strong></div>
          <div class="detail-box"><span>Condicao fornecedor</span><strong>${escapeHtml(order.supplierTerms || "-")}</strong></div>
          <div class="detail-box"><span>Solicitante</span><strong>${escapeHtml(order.buyer)}</strong></div>
          <div class="detail-box"><span>Prioridade</span><strong>${escapeHtml(order.priority)}</strong></div>
          <div class="detail-box"><span>Status</span><strong>${statusText(order.status)}</strong></div>
          <div class="detail-box"><span>Aprovacao</span><strong>${order.approvalType === "automatic" ? "Automatica" : order.approvedAt ? "Manual" : "Pendente"}</strong></div>
          <div class="detail-box"><span>Criado em</span><strong>${escapeHtml(dateTimeText(order.createdAt))}</strong></div>
          <div class="detail-box"><span>Entrega desejada</span><strong>${escapeHtml(order.delivery || "-")}</strong></div>
          <div class="detail-box"><span>Itens</span><strong>${order.items.length}</strong></div>
          <div class="detail-box"><span>Boletos</span><strong>${order.installments || 1}x</strong></div>
          <div class="detail-box"><span>Intervalo</span><strong>${escapeHtml(intervalLabel(order.interval))}</strong></div>
          <div class="detail-box"><span>Valor por boleto</span><strong>${money(order.installmentValue || total)}</strong></div>
          <div class="detail-box"><span>Total</span><strong>${money(total)}</strong></div>
          <div class="detail-box"><span>Recebimento</span><strong>${receiptEntries(order).length ? `${receiptEntries(order).length} entrega(s) | ${money(receivingTotal(order))}` : "Pendente"}</strong></div>
        </div>
        <div class="print-area">
          <div class="panel" style="box-shadow: none;">
            <div class="panel-header"><h2>Itens do pedido</h2></div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Nome</th>
                    <th>Qtd sugerida</th>
                    <th>Qtd pedido</th>
                    <th>Valor un.</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
          ${(() => {
            const sched = buildPaymentSchedule(total, order.installments || 1, order.delivery, order.interval);
            const scheduleRows = sched.map((row) => `
                  <tr>
                    <td><strong>${row.index}o boleto</strong></td>
                    <td>${formatScheduleDate(row.date)}</td>
                    <td><strong>${money(row.value)}</strong></td>
                  </tr>`).join("");
            return `
          <div class="panel" style="box-shadow: none; margin-top: 12px;">
            <div class="panel-header"><h2>Simulacao de pagamentos</h2></div>
            <div class="panel-body">
              <p class="help-text" style="margin-bottom: 10px;">${order.delivery ? `${intervalSubtitle(order.interval, sched.length)}, a partir da chegada (${escapeHtml(order.delivery)}).` : "Sem data de chegada definida; datas nao calculadas."}</p>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead>
                  <tbody>${scheduleRows}</tbody>
                </table>
              </div>
            </div>
          </div>`;
          })()}
          ${order.notes ? `<div class="detail-box" style="margin-top: 12px;"><span>Observacoes</span><strong>${escapeHtml(order.notes)}</strong></div>` : ""}
          ${order.decisionReason ? `<div class="detail-box" style="margin-top: 12px;"><span>Justificativa da decisao</span><strong>${escapeHtml(order.decisionReason)}</strong></div>` : ""}
          ${receiptEntries(order).length ? `<div class="detail-box" style="margin-top: 12px;"><span>Historico de recebimentos</span>${receiptEntries(order).map((entry, index) => `<strong>Entrega ${index + 1}: ${escapeHtml(dateTimeText(entry.confirmedAt))} | ${money(entry.total)}</strong>`).join("<br>")}</div>` : ""}
        </div>
      `;
      document.getElementById("orderModal").classList.add("show");
    }

    function closeOrderModal() {
      document.getElementById("orderModal").classList.remove("show");
    }

    function printOrder() {
      window.print();
    }

    function nextProductId() {
      return Math.max(0, ...state.products.map((product) => Number(product.id) || 0)) + 1;
    }

    function nextProductCode() {
      return `P${String(nextProductId()).padStart(4, "0")}`;
    }

    function buildCatalogImportPreview() {
      const codes = parseColumn(document.getElementById("catalogCodesInput").value);
      const names = parseColumn(document.getElementById("catalogNamesInput").value);
      const prices = parseColumn(document.getElementById("catalogPricesInput").value);
      const salePrices = parseColumn(document.getElementById("catalogSalePricesInput").value);
      const rowCount = Math.max(codes.length, names.length, prices.length, salePrices.length);
      return Array.from({ length: rowCount }, (_, index) => {
        const code = codes[index] || "";
        const name = names[index] || "";
        if (!name || normalizeName(name) === "produto") {
          return { line: index + 1, code, name, status: "ignored", label: "Ignorada", details: "Nome vazio ou cabecalho." };
        }
        if (productIdentityConflict(code, name)) {
          return { line: index + 1, code, name, status: "conflict", label: "Conflito", details: "Codigo e nome pertencem a produtos diferentes." };
        }
        const existing = productByCodeOrName(code, name);
        return { line: index + 1, code, name, status: existing ? "update" : "new", label: existing ? "Atualizar" : "Novo", details: existing ? `Produto #${existing.id}` : "Pronto para cadastrar." };
      });
    }

    function buildSalesImportPreview() {
      const codes = parseColumn(document.getElementById("salesCodesInput").value);
      const names = parseColumn(document.getElementById("salesNamesInput").value);
      const monthColumns = salesMonths.map((month, index) => parseColumn(document.getElementById(`salesMonth${index + 1}Input`).value));
      const rowCount = Math.max(codes.length, names.length, ...monthColumns.map((column) => column.length));
      return Array.from({ length: rowCount }, (_, index) => {
        const code = codes[index] || "";
        const name = names[index] || "";
        if ((!code && !name) || normalizeName(name) === "produto") {
          return { line: index + 1, code, name, status: "ignored", label: "Ignorada", details: "Produto vazio ou cabecalho." };
        }
        if (productIdentityConflict(code, name)) {
          return { line: index + 1, code, name, status: "conflict", label: "Conflito", details: "Codigo e nome pertencem a produtos diferentes." };
        }
        const product = productByCodeOrName(code, name);
        if (!product) {
          return { line: index + 1, code, name, status: "conflict", label: "Nao encontrado", details: "Cadastre o produto antes das vendas." };
        }
        const hasData = monthColumns.some((column) => String(column[index] ?? "").trim() !== "");
        return { line: index + 1, code, name, status: hasData ? "update" : "ignored", label: hasData ? "Atualizar" : "Ignorada", details: hasData ? `Vendas de ${currentSalesYear()}.` : "Nenhum mes preenchido." };
      });
    }

    function prepareImport(kind) {
      const rows = kind === "catalog" ? buildCatalogImportPreview() : buildSalesImportPreview();
      const accepted = rows.filter((row) => ["new", "update"].includes(row.status)).length;
      const errors = rows.filter((row) => row.status === "conflict").length;
      pendingImport = { kind, rows };
      document.getElementById("importPreviewTitle").textContent = kind === "catalog" ? "Revisao do catalogo" : `Revisao das vendas de ${currentSalesYear()}`;
      document.getElementById("importPreviewSummary").textContent = `${accepted} linha(s) prontas | ${errors} conflito(s) | ${rows.length - accepted - errors} ignorada(s)`;
      document.getElementById("importPreviewTable").innerHTML = rows.slice(0, 100).map((row) => `
        <tr>
          <td>${row.line}</td>
          <td>${escapeHtml(row.code || "-")}</td>
          <td>${escapeHtml(row.name || "-")}</td>
          <td><span class="preview-${row.status}">${escapeHtml(row.label)}</span></td>
          <td>${escapeHtml(row.details)}</td>
        </tr>
      `).join("");
      document.getElementById("confirmImportButton").disabled = accepted === 0;
      document.getElementById("downloadImportErrorsButton").disabled = errors === 0;
      document.getElementById("importPreviewPanel").style.display = "block";
    }

    function closeImportPreview() {
      pendingImport = null;
      document.getElementById("importPreviewPanel").style.display = "none";
    }

    function confirmPendingImport() {
      if (!pendingImport) return;
      const kind = pendingImport.kind;
      if (kind === "catalog") importCatalog();
      else importSales();
      closeImportPreview();
    }

    function csvCell(value) {
      return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    function downloadImportErrors() {
      if (!pendingImport) return;
      const problems = pendingImport.rows.filter((row) => row.status === "conflict");
      if (!problems.length) return;
      const csv = ["Linha;Codigo;Produto;Erro", ...problems.map((row) => [row.line, row.code, row.name, row.details].map(csvCell).join(";"))].join("\r\n");
      const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `erros-importacao-${pendingImport.kind}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }

    function importCatalog() {
      if (!isAdmin()) {
        toast("Somente admin pode importar o catalogo.");
        return;
      }
      const codes = parseColumn(document.getElementById("catalogCodesInput").value);
      const names = parseColumn(document.getElementById("catalogNamesInput").value);
      const prices = parseColumn(document.getElementById("catalogPricesInput").value);
      const salePrices = parseColumn(document.getElementById("catalogSalePricesInput").value);
      const rowCount = Math.max(codes.length, names.length, prices.length, salePrices.length);
      let imported = 0;
      let conflicts = 0;

      for (let index = 0; index < rowCount; index += 1) {
        const code = codes[index];
        const name = names[index];
        const price = prices[index];
        const salePrice = salePrices[index];
        if (!name || normalizeName(name) === "produto") continue;
        if (productIdentityConflict(code, name)) {
          conflicts += 1;
          continue;
        }

        const existing = consolidateProductByCodeOrName(code, name);
        let importedProduct;
        if (existing) {
          existing.code = code || existing.code || nextProductCode();
          existing.price = price ? parseNumber(price) : existing.price;
          existing.salePrice = salePrice ? parseNumber(salePrice) : existing.salePrice;
          existing.name = name || existing.name;
          existing.active = true;
          existing.archivedAt = "";
          existing.archivedBy = "";
          importedProduct = existing;
        } else {
          importedProduct = {
            id: nextProductId(),
            code: code || nextProductCode(),
            name,
            price: parseNumber(price),
            salePrice: parseNumber(salePrice),
            active: true,
            archivedAt: "",
            archivedBy: "",
            salesByYear: {},
            sales: normalizeSalesSeries([])
          };
          state.products.push(importedProduct);
        }
        recordPriceHistory(importedProduct.id, importedProduct.price, importedProduct.salePrice, "Importacao de catalogo");
        imported += 1;
      }

      if (imported) recordAudit("catalog", "Importacao de catalogo", "", `${imported} produto(s) incluido(s) ou atualizado(s)`);
      if (conflicts) recordAudit("catalog", "Conflito na importacao", "", `${conflicts} linha(s) ignorada(s) por codigo e nome pertencerem a produtos diferentes`);
      saveState();
      render();
      toast(imported || conflicts
        ? `${imported} item(ns) importado(s). ${conflicts ? `${conflicts} conflito(s) ignorado(s).` : ""}`.trim()
        : "Nenhum item valido para importar.");
    }

    function importSales() {
      if (!isAdmin()) {
        toast("Somente admin pode importar vendas.");
        return;
      }
      const codes = parseColumn(document.getElementById("salesCodesInput").value);
      const names = parseColumn(document.getElementById("salesNamesInput").value);
      const monthColumns = salesMonths.map((month, index) => parseColumn(document.getElementById(`salesMonth${index + 1}Input`).value));
      const rowCount = Math.max(codes.length, names.length, ...monthColumns.map((column) => column.length));
      const salesYear = currentSalesYear();
      let imported = 0;
      let conflicts = 0;

      for (let index = 0; index < rowCount; index += 1) {
        const code = codes[index];
        const name = names[index];
        if ((!code && !name) || normalizeName(name) === "produto") continue;
        if (productIdentityConflict(code, name)) {
          conflicts += 1;
          continue;
        }
        const product = consolidateProductByCodeOrName(code, name);
        if (!product) continue;

        const hasSalesData = monthColumns.some((column) => String(column[index] ?? "").trim() !== "");
        if (!hasSalesData) continue;
        const sales = monthColumns.map((column) => Math.max(0, parseNumber(column[index])));
        if (!product.salesByYear || typeof product.salesByYear !== "object") product.salesByYear = {};
        product.salesByYear[salesYear] = sales;
        product.sales = sales;
        imported += 1;
      }

      if (imported) recordAudit("sales", "Importacao de vendas", salesYear, `${imported} produto(s) atualizado(s) no ano ${salesYear}`);
      if (conflicts) recordAudit("sales", "Conflito na importacao", salesYear, `${conflicts} linha(s) ignorada(s) por codigo e nome pertencerem a produtos diferentes`);
      saveState();
      state.orderDraft.forEach((id) => {
        state.orderQty[id] = suggestedQty(productById(id));
      });
      render();
      toast(imported || conflicts
        ? `${imported} historico(s) importado(s) para ${salesYear}. ${conflicts ? `${conflicts} conflito(s) ignorado(s).` : ""}`.trim()
        : "Nenhuma venda bateu com produtos do catalogo.");
    }

    function saveApprovalRules() {
      if (!isAdmin()) return;
      state.settings.autoApprovalLimit = Math.max(0, parseNumber(document.getElementById("autoApprovalLimitInput").value));
      recordAudit("system", "Regra de aprovacao atualizada", "", `Aprovacao automatica ate ${money(state.settings.autoApprovalLimit)}`);
      saveState();
      renderDashboard();
      toast("Regra de aprovacao salva.");
    }

    function nextQuotationId() {
      return Math.max(0, ...state.quotations.map((quotation) => Number(quotation.id) || 0)) + 1;
    }

    function saveQuotation() {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) return;
      const productId = Number(document.getElementById("quoteProductSelect").value);
      const supplierId = Number(document.getElementById("quoteSupplierSelect").value);
      const price = Math.max(0, parseNumber(document.getElementById("quotePriceInput").value));
      const deliveryDays = Math.max(0, Number(document.getElementById("quoteDeliveryDaysInput").value) || 0);
      const notes = document.getElementById("quoteNotesInput").value.trim();
      const product = productById(productId);
      const supplier = supplierById(supplierId);
      if (!product || !supplier || price <= 0) {
        toast("Selecione produto, fornecedor e informe um preco valido.");
        return;
      }
      const existing = state.quotations.find((quotation) => quotation.productId === productId && quotation.supplierId === supplierId);
      if (existing) {
        Object.assign(existing, { price, deliveryDays, notes, quotedAt: new Date().toISOString(), quotedBy: currentUser.name });
      } else {
        state.quotations.unshift({ id: nextQuotationId(), productId, supplierId, price, deliveryDays, notes, quotedAt: new Date().toISOString(), quotedBy: currentUser.name });
      }
      recordAudit("supplier", existing ? "Cotacao atualizada" : "Cotacao cadastrada", supplierId, `${product.code} | ${supplier.name} | ${money(price)}`);
      saveState();
      ["quotePriceInput", "quoteNotesInput"].forEach((id) => document.getElementById(id).value = "");
      document.getElementById("quoteDeliveryDaysInput").value = "0";
      render();
      toast("Cotacao salva.");
    }

    function removeQuotation(quotationId) {
      if (!currentUser || !["admin", "comprador"].includes(currentUser.role)) return;
      const quotation = state.quotations.find((entry) => entry.id === Number(quotationId));
      if (!quotation) return;
      state.quotations = state.quotations.filter((entry) => entry.id !== quotation.id);
      recordAudit("supplier", "Cotacao removida", quotation.supplierId, productById(quotation.productId)?.name || "Produto removido");
      saveState();
      render();
    }

    function renderQuotations() {
      const productSelect = document.getElementById("quoteProductSelect");
      const supplierSelect = document.getElementById("quoteSupplierSelect");
      const selectedProduct = productSelect.value;
      const selectedSupplier = supplierSelect.value;
      productSelect.innerHTML = `<option value="">Selecione</option>${state.products.filter((product) => product.active !== false).map((product) => `<option value="${product.id}">${escapeHtml(product.code)} - ${escapeHtml(product.name)}</option>`).join("")}`;
      supplierSelect.innerHTML = `<option value="">Selecione</option>${state.suppliers.map((supplier) => `<option value="${supplier.id}">${escapeHtml(supplier.name)}</option>`).join("")}`;
      productSelect.value = selectedProduct;
      supplierSelect.value = selectedSupplier;
      const bestByProduct = {};
      state.quotations.forEach((quotation) => {
        if (!bestByProduct[quotation.productId] || quotation.price < bestByProduct[quotation.productId].price) bestByProduct[quotation.productId] = quotation;
      });
      const table = document.getElementById("quotesTable");
      document.getElementById("quotesEmpty").style.display = state.quotations.length ? "none" : "block";
      table.innerHTML = state.quotations.map((quotation) => {
        const product = productById(quotation.productId);
        const supplier = supplierById(quotation.supplierId);
        const isBest = bestByProduct[quotation.productId]?.id === quotation.id;
        return `<tr><td><strong>${escapeHtml(product?.code || "-")} - ${escapeHtml(product?.name || "Produto removido")}</strong></td><td>${escapeHtml(supplier?.name || "Fornecedor removido")}</td><td>${money(quotation.price)}</td><td>${quotation.deliveryDays} dia(s)</td><td><span class="status ${isBest ? "approved" : "pending"}">${isBest ? "Melhor preco" : "Comparar"}</span></td><td><button class="button danger" type="button" onclick="removeQuotation(${quotation.id})">Remover</button></td></tr>`;
      }).join("");
    }

    function applySupplierQuotations() {
      const supplierId = Number(document.getElementById("supplierSelect").value);
      if (!supplierId) {
        toast("Escolha o fornecedor primeiro.");
        return;
      }
      let applied = 0;
      state.orderDraft.forEach((productId) => {
        const quotation = state.quotations.find((entry) => entry.productId === productId && entry.supplierId === supplierId);
        if (quotation) {
          state.orderPrice[productId] = quotation.price;
          applied += 1;
        }
      });
      saveState();
      renderOrder();
      toast(applied ? `${applied} cotacao(oes) aplicada(s).` : "Este fornecedor nao possui cotacoes para os itens do pedido.");
    }

    function orderMonthValue(order) {
      return monthValueFromDateText(order.createdAt);
    }

    function operationalAlerts() {
      const alerts = [];
      state.orders.forEach((order) => {
        if (order.status === "pending") alerts.push({ level: "pending", title: `Pedido #${order.id} aguardando aprovacao`, detail: `${order.supplier} | ${money(totalFor(order.items))}`, tab: "aprovacao" });
        if (order.status === "approved") {
          const partialCount = order.receiving?.deliveries?.length || 0;
          alerts.push({ level: partialCount ? "pending" : "rejected", title: `Pedido #${order.id} aguardando recebimento`, detail: partialCount ? `${partialCount} entrega(s) parcial(is) registrada(s)` : order.supplier, tab: "recebimento" });
        }
        if (order.status === "rejected") alerts.push({ level: "rejected", title: `Pedido #${order.id} recusado`, detail: order.decisionReason || "Sem justificativa registrada", tab: "aprovacao" });
      });
      return alerts.concat(priceIncreaseAlerts());
    }

    function openOperationalAlert(tab, productId) {
      if (tab === "historicoPreco" && productId) {
        openPriceHistory(productId);
        return;
      }
      setTab(tab);
    }

    function renderAlerts() {
      const alerts = operationalAlerts();
      document.getElementById("alertsEmpty").style.display = alerts.length ? "none" : "block";
      document.getElementById("alertsList").innerHTML = alerts.map((alert) => `<article class="approval-card" onclick="openOperationalAlert('${alert.tab}', ${Number(alert.productId) || 0})"><div class="approval-head"><div><h3>${escapeHtml(alert.title)}</h3><div class="muted">${escapeHtml(alert.detail)}</div></div><span class="status ${alert.level}">Ver</span></div></article>`).join("");
    }

    function renderDashboard() {
      const month = currentMonthValue();
      const monthOrders = state.orders.filter((order) => orderMonthValue(order) === month && order.status !== "rejected");
      const receivedTotal = state.orders.reduce((sum, order) => sum + receiptEntries(order).filter((entry) => monthValueFromDateText(entry.confirmedAt) === month).reduce((entrySum, entry) => entrySum + entry.total, 0), 0);
      document.getElementById("dashboardPurchaseTotal").textContent = money(monthOrders.reduce((sum, order) => sum + totalFor(order.items), 0));
      document.getElementById("dashboardPendingOrders").textContent = state.orders.filter((order) => order.status === "pending").length;
      document.getElementById("dashboardReceivedTotal").textContent = money(receivedTotal);
      document.getElementById("dashboardDivergences").textContent = state.orders.reduce((sum, order) => sum + receivingDivergences(order), 0);
      const supplierTotals = {};
      monthOrders.forEach((order) => supplierTotals[order.supplier] = (supplierTotals[order.supplier] || 0) + totalFor(order.items));
      const maxSupplierTotal = Math.max(1, ...Object.values(supplierTotals));
      document.getElementById("dashboardSupplierBars").innerHTML = Object.entries(supplierTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([supplier, total]) => `<div class="metric-bar"><strong>${escapeHtml(supplier)}</strong><div class="metric-track"><div class="metric-fill" style="width: ${(total / maxSupplierTotal) * 100}%"></div></div><span>${money(total)}</span></div>`).join("") || `<div class="empty">Nenhuma compra no mes.</div>`;
      const productTotals = {};
      monthOrders.forEach((order) => order.items.forEach((item) => {
        const key = item.productId;
        if (!productTotals[key]) productTotals[key] = { name: `${item.productCode || ""} - ${item.productName || productById(key)?.name || "Produto removido"}`, qty: 0, total: 0 };
        productTotals[key].qty += Number(item.qty) || 0;
        productTotals[key].total += (Number(item.qty) || 0) * (Number(item.unitPrice) || 0);
      }));
      document.getElementById("dashboardTopProducts").innerHTML = Object.values(productTotals).sort((a, b) => b.total - a.total).slice(0, 8).map((item) => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td>${item.qty}</td><td>${money(item.total)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">Nenhum produto comprado no mes.</td></tr>`;
      document.getElementById("approvalRulesPanel").style.display = isAdmin() ? "block" : "none";
      document.getElementById("autoApprovalLimitInput").value = formatInputMoney(state.settings.autoApprovalLimit);
      document.getElementById("approvalLimitInfo").textContent = state.settings.autoApprovalLimit > 0 ? `Pedidos de ate ${money(state.settings.autoApprovalLimit)} seguem aprovados para recebimento.` : "Todos os pedidos exigem aprovacao do Admin.";
    }

    function renderCounts() {
      document.getElementById("countPainel").textContent = state.orders.filter((order) => orderMonthValue(order) === currentMonthValue() && order.status !== "rejected").length;
      const listedIds = new Set(activeList().map((item) => item.productId));
      document.getElementById("countCatalogo").textContent = state.products.filter((product) => product.active !== false && !listedIds.has(product.id)).length;
      document.getElementById("countImportacao").textContent = state.products.filter((product) => salesForProduct(product).some((value) => Number(value) > 0)).length;
      document.getElementById("countAuditoria").textContent = state.auditLog.length;
      document.getElementById("countLista").textContent = isStoreUser() ? activeList().length : state.list.length;
      document.getElementById("countListaIconha").textContent = state.storeLists.iconha.length;
      document.getElementById("countListaReta").textContent = state.storeLists.reta.length;
      document.getElementById("countFornecedores").textContent = state.suppliers.length;
      document.getElementById("countCotacoes").textContent = state.quotations.length;
      document.getElementById("countHistoricoPreco").textContent = priceIncreaseAlerts().length;
      document.getElementById("countPedido").textContent = state.orderDraft.length;
      document.getElementById("countAprovacao").textContent = state.orders.filter((order) => order.status === "pending").length;
      document.getElementById("countRecebimento").textContent = state.orders.filter((order) => order.status === "approved").length;
      const countFinanceiroEl = document.getElementById("countFinanceiro");
      if (countFinanceiroEl) countFinanceiroEl.textContent = financeBoletos().length;
      document.getElementById("countPedidoConcluido").textContent = state.orders.filter((order) => order.status === "completed").length;
      document.getElementById("countAlertas").textContent = operationalAlerts().length;
      document.getElementById("countSeguranca").textContent = 0;
    }

    function renderSalesCoverage() {
      const year = currentSalesYear();
      const activeProducts = state.products.filter((product) => product.active !== false);
      const totalProducts = activeProducts.length;
      const productsWithSales = activeProducts.filter((product) => salesForProduct(product, year).some((value) => Number(value) > 0)).length;
      const months = salesMonths.map((label, index) => ({ label, index }));

      document.getElementById("salesYearInput").value = year;
      document.getElementById("salesCoverageTitle").textContent = `${productsWithSales} de ${totalProducts} produto(s) com vendas em ${year}`;
      document.getElementById("salesCoverageGrid").innerHTML = months.map((month) => {
        const filled = activeProducts.filter((product) => Number(salesForProduct(product, year)[month.index]) > 0).length;
        const percent = totalProducts ? Math.round((filled / totalProducts) * 100) : 0;
        const statusClass = filled ? "approved" : "pending";
        const statusLabel = filled ? "Preenchido" : "Vazio";

        return `
          <div class="month-status">
            <span>${month.label}</span>
            <strong>${filled}</strong>
            <span class="muted">${percent}% do catalogo</span><br>
            <span class="status ${statusClass}">${statusLabel}</span>
          </div>
        `;
      }).join("");
    }

    function renderAudit() {
      const filter = document.getElementById("auditActionFilter").value;
      const entries = state.auditLog
        .filter((entry) => filter === "all" || entry.area === filter)
        .slice(0, 500);
      const table = document.getElementById("auditTable");
      const empty = document.getElementById("auditEmpty");

      table.innerHTML = entries.map((entry) => {
        const parsedDate = new Date(entry.createdAt);
        const dateText = Number.isNaN(parsedDate.getTime()) ? entry.createdAt : parsedDate.toLocaleString("pt-BR");
        return `
          <tr>
            <td>${escapeHtml(dateText)}</td>
            <td><strong>${escapeHtml(entry.user)}</strong>${entry.email ? `<br><span class="muted">${escapeHtml(entry.email)}</span>` : ""}</td>
            <td>${escapeHtml(entry.area)}</td>
            <td><strong>${escapeHtml(entry.action)}</strong></td>
            <td>${escapeHtml(entry.details || "-")}</td>
          </tr>
        `;
      }).join("");

      table.closest(".table-wrap").style.display = entries.length ? "block" : "none";
      empty.style.display = entries.length ? "none" : "block";
    }

    function clearRenderedContent(ids) {
      ids.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = "";
      });
    }

    function render() {
      renderCatalog();
      if (canAccessTab("painel")) renderDashboard();
      else clearRenderedContent(["dashboardSupplierBars", "dashboardTopProducts"]);
      if (canAccessTab("pedido") || canAccessTab("fornecedores")) renderSuppliers();
      else clearRenderedContent(["supplierTable"]);
      if (canAccessTab("lista")) renderList();
      else clearRenderedContent(["listTable"]);
      if (canAccessTab("listaIconha")) renderStoreList("iconha");
      else clearRenderedContent(["storeListIconhaTable"]);
      if (canAccessTab("listaReta")) renderStoreList("reta");
      else clearRenderedContent(["storeListRetaTable"]);
      if (canAccessTab("pedido")) renderOrder();
      else clearRenderedContent(["orderSelection"]);
      if (canAccessTab("aprovacao")) renderApprovals();
      else clearRenderedContent(["approvalList"]);
      if (canAccessTab("recebimento")) renderReceiving();
      else clearRenderedContent(["receivingList"]);
      if (canAccessTab("financeiro")) renderFinanceiro();
      else clearRenderedContent(["financeTable", "financeFoot"]);
      if (canAccessTab("pedidoConcluido")) renderCompletedOrders();
      else clearRenderedContent(["completedOrderList"]);
      if (canAccessTab("cotacoes")) renderQuotations();
      else clearRenderedContent(["quotesTable"]);
      if (canAccessTab("historicoPreco")) renderPriceHistory();
      else clearRenderedContent(["priceHistoryTable", "priceHistoryChart"]);
      if (canAccessTab("alertas")) renderAlerts();
      else clearRenderedContent(["alertsList"]);
      renderCounts();
      if (canAccessTab("importacao")) renderSalesCoverage();
      else clearRenderedContent(["salesCoverageGrid"]);
      if (canAccessTab("auditoria")) renderAudit();
      else clearRenderedContent(["auditTable"]);
    }

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    });

    document.getElementById("loginForm").addEventListener("submit", login);
    document.getElementById("forgotPasswordButton").addEventListener("click", requestPasswordRecovery);
    document.getElementById("loginRole").addEventListener("change", syncLoginEmailWithRole);
    document.getElementById("logoutButton").addEventListener("click", logout);
    document.getElementById("searchInput").addEventListener("input", () => {
      catalogPage = 1;
      renderCatalog();
    });
    document.getElementById("catalogPrevButton").addEventListener("click", () => {
      catalogPage = Math.max(1, catalogPage - 1);
      renderCatalog();
    });
    document.getElementById("catalogNextButton").addEventListener("click", () => {
      catalogPage += 1;
      renderCatalog();
    });
    document.getElementById("catalogStatusFilter").addEventListener("change", () => {
      catalogPage = 1;
      renderCatalog();
    });
    document.getElementById("salesYearInput").addEventListener("change", (event) => setSalesYear(event.target.value));
    document.getElementById("auditActionFilter").addEventListener("change", renderAudit);
    document.getElementById("goOrderButton").addEventListener("click", sendSelectedListToOrder);
    document.getElementById("selectAllButton").addEventListener("click", selectAllOrderItems);
    document.getElementById("sendApprovalButton").addEventListener("click", sendApproval);
    document.getElementById("applyQuotesButton").addEventListener("click", applySupplierQuotations);
    document.getElementById("installmentsInput").addEventListener("input", renderOrder);
    document.getElementById("deliveryInput").addEventListener("input", renderOrder);
    document.getElementById("deliveryInput").addEventListener("change", renderOrder);
    document.getElementById("intervalSelect").addEventListener("input", renderOrder);
    document.getElementById("intervalSelect").addEventListener("change", renderOrder);
    document.getElementById("saveSupplierButton").addEventListener("click", saveSupplier);
    document.getElementById("clearSupplierButton").addEventListener("click", clearSupplierForm);
    document.getElementById("saveQuoteButton").addEventListener("click", saveQuotation);
    document.getElementById("priceHistoryProductSelect").addEventListener("change", (event) => {
      selectedPriceHistoryProductId = Number(event.target.value) || null;
      renderPriceHistory();
    });
    document.getElementById("savePriceAlertRuleButton").addEventListener("click", savePriceAlertRule);
    document.getElementById("exportPriceHistoryButton").addEventListener("click", exportPriceHistory);
    document.getElementById("saveApprovalRulesButton").addEventListener("click", saveApprovalRules);
    document.getElementById("importCatalogButton").addEventListener("click", () => prepareImport("catalog"));
    document.getElementById("importSalesButton").addEventListener("click", () => prepareImport("sales"));
    document.getElementById("closeImportPreviewButton").addEventListener("click", closeImportPreview);
    document.getElementById("confirmImportButton").addEventListener("click", confirmPendingImport);
    document.getElementById("downloadImportErrorsButton").addEventListener("click", downloadImportErrors);
    document.getElementById("catalogFileInput").addEventListener("change", (event) => loadImportFile("catalog", event.target));
    document.getElementById("salesFileInput").addEventListener("change", (event) => loadImportFile("sales", event.target));
    document.getElementById("receivingMonthInput").addEventListener("change", renderReceivingMonthSummary);
    document.getElementById("closeModalButton").addEventListener("click", closeOrderModal);
    document.getElementById("closeModalFooterButton").addEventListener("click", closeOrderModal);
    document.getElementById("printOrderButton").addEventListener("click", printOrder);
    document.getElementById("changePasswordButton").addEventListener("click", changePassword);
    document.getElementById("startMfaButton").addEventListener("click", startMfaEnrollment);
    document.getElementById("verifyMfaButton").addEventListener("click", verifyMfaEnrollment);
    document.getElementById("exportBackupButton").addEventListener("click", exportBackup);
    document.getElementById("backupFileInput").addEventListener("change", (event) => restoreBackup(event.target));
    document.getElementById("orderModal").addEventListener("click", (event) => {
      if (event.target.id === "orderModal") closeOrderModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeOrderModal();
    });
    document.getElementById("clearCatalogImportButton").addEventListener("click", () => {
      ["catalogCodesInput", "catalogNamesInput", "catalogPricesInput", "catalogSalePricesInput"].forEach((id) => {
        document.getElementById(id).value = "";
      });
      document.getElementById("catalogFileInput").value = "";
      closeImportPreview();
    });
    document.getElementById("clearSalesImportButton").addEventListener("click", () => {
      ["salesCodesInput", "salesNamesInput", ...salesMonths.map((month, index) => `salesMonth${index + 1}Input`)].forEach((id) => {
        document.getElementById(id).value = "";
      });
      document.getElementById("salesFileInput").value = "";
      closeImportPreview();
    });
    document.getElementById("resetButton").addEventListener("click", () => {
      if (!isAdmin()) {
        toast("Somente admin pode limpar os dados operacionais.");
        return;
      }
      if (!confirm("Deseja limpar lista, pedidos e aprovacoes?")) return;
      localStorage.removeItem("purchaseSystemState");
      state.list = [];
      state.storeLists = { iconha: [], reta: [] };
      state.selectedFromList = [];
      state.orderDraft = [];
      state.orderQty = {};
      state.orderPrice = {};
      state.orders = [];
      recordAudit("system", "Dados operacionais limpos", "", "Listas e pedidos foram removidos; catalogo, vendas e auditoria foram preservados");
      saveState();
      render();
      toast("Dados limpos.");
    });

    loadRememberedLogin();

    if (currentUser) {
      renderAuth();
      restoreAuthenticatedSession().catch(async () => {
        await logout(false);
        toast("Sua sessao expirou ou o perfil nao esta ativo. Entre novamente.");
      });
    } else {
      render();
      renderAuth();
    }
