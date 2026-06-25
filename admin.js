const state = {
  token: localStorage.getItem("ponkudamAdminToken"),
  user: JSON.parse(localStorage.getItem("ponkudamAdminUser") || "null"),
  products: [],
  categories: [],
  enquiries: [],
  users: [],
  goldRates: [],
  settings: {},
  editingProduct: null,
  editingCategory: null,
  productPage: 1,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const pageSize = 10;

const api = async (path, options = {}) => {
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.message || "Request failed");
  return data;
};

const toast = (message) => {
  const element = $("[data-toast]");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2400);
};

const asPrice = (value) =>
  value ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value) : "Contact";

const showApp = () => {
  $("[data-login-view]").classList.add("hidden");
  $("[data-admin-view]").classList.remove("hidden");
  $("[data-role-label]").textContent = state.user ? `${state.user.name} / ${state.user.role}` : "";
  const allowed =
    state.user?.role === "Super Admin"
      ? ["dashboard", "products", "categories", "gold", "enquiries", "settings", "users"]
      : state.user?.role === "Product Manager"
        ? ["dashboard", "products", "categories"]
        : ["dashboard", "enquiries", "settings"];
  $$("[data-admin-nav] [data-section]").forEach((button) => {
    button.hidden = !allowed.includes(button.dataset.section);
  });
  $$(".admin-section").forEach((panel) => {
    if (!allowed.includes(panel.dataset.panel)) panel.classList.remove("active");
  });
};

const showLogin = () => {
  $("[data-login-view]").classList.remove("hidden");
  $("[data-admin-view]").classList.add("hidden");
};

const loadAll = async () => {
  const isSuperAdmin = state.user?.role === "Super Admin";
  const isProductManager = state.user?.role === "Product Manager";
  const isContentManager = state.user?.role === "Content Manager";

  const requests = {
    products: isSuperAdmin || isProductManager ? api("products") : Promise.resolve({ products: [] }),
    categories: isSuperAdmin || isProductManager ? api("categories") : Promise.resolve({ categories: [] }),
    enquiries: isSuperAdmin || isContentManager ? api("enquiries") : Promise.resolve({ enquiries: [] }),
    users: isSuperAdmin ? api("users") : Promise.resolve({ users: [] }),
    goldRates: isSuperAdmin ? api("gold-rates") : Promise.resolve({ gold_rates: [] }),
    settings: isSuperAdmin || isContentManager ? api("settings") : Promise.resolve({ settings: {} }),
  };

  const [products, categories, enquiries, users, goldRates, settings] = await Promise.all(Object.values(requests));
  state.products = products.products || [];
  state.categories = categories.categories || [];
  state.enquiries = enquiries.enquiries || [];
  state.users = users.users || [];
  state.goldRates = goldRates.gold_rates || [];
  state.settings = settings.settings || {};
  renderAll();
};

const renderAll = () => {
  renderMetrics();
  renderProducts();
  renderCategories();
  renderGoldRates();
  renderEnquiries();
  renderSettings();
  renderUsers();
  fillCategorySelects();
};

const renderMetrics = () => {
  const active = state.products.filter((item) => item.status === "Published").length;
  const out = state.products.filter((item) => item.stockStatus === "Out of Stock").length;
  const latest = state.goldRates.at(-1);
  const metrics = [
    ["Total Products", state.products.length],
    ["Active Products", active],
    ["Out of Stock Products", out],
    ["Total Categories", state.categories.length],
    ["Latest Gold Rate", latest ? `22K ${latest.rate22K}` : "Not set"],
    ["Last Gold Rate Update Date", latest ? new Date(latest.updatedAt).toLocaleDateString("en-IN") : "-"],
    ["Recent Products Added", state.products.slice(0, 5).length],
    ["Recent Enquiries", state.enquiries.slice(0, 5).length],
  ];
  $("[data-metrics]").innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join("");
  $("[data-recent-products]").innerHTML = state.products.slice(0, 6).map((item) => `<p>${item.name} <span class="status">${item.status}</span></p>`).join("") || "<p>No products yet.</p>";
  $("[data-recent-enquiries]").innerHTML = state.enquiries.slice(0, 6).map((item) => `<p>${item.customerName || "Customer"} / ${item.status}</p>`).join("") || "<p>No enquiries yet.</p>";
};

const fillCategorySelects = () => {
  const options = `<option value="">All Categories</option>${state.categories.map((category) => `<option value="${category.slug}">${category.name}</option>`).join("")}`;
  $$('[data-product-filter="category"]').forEach((select) => (select.innerHTML = options));
  $$('[name="category"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = state.categories.map((category) => `<option value="${category.slug}">${category.name}</option>`).join("");
    select.value = current;
  });
  $$('[name="parent"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">None</option>${state.categories.map((category) => `<option value="${category.slug}">${category.name}</option>`).join("")}`;
    select.value = current;
  });
};

const filteredProducts = () => {
  const search = $("[data-product-search]").value.toLowerCase();
  const filters = Object.fromEntries($$("[data-product-filter]").map((select) => [select.dataset.productFilter, select.value]));
  return state.products
    .filter((item) => !search || `${item.name} ${item.code}`.toLowerCase().includes(search))
    .filter((item) => !filters.category || item.category === filters.category)
    .filter((item) => !filters.stockStatus || item.stockStatus === filters.stockStatus)
    .filter((item) => !filters.status || item.status === filters.status);
};

const renderProducts = () => {
  const products = filteredProducts();
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  state.productPage = Math.min(state.productPage, totalPages);
  const pageItems = products.slice((state.productPage - 1) * pageSize, state.productPage * pageSize);
  $("[data-products-table]").innerHTML = pageItems
    .map(
      (item) => `<tr>
        <td>${item.name}</td><td>${item.code || ""}</td><td>${item.category || ""}</td><td>${asPrice(item.offerPrice || item.price)}</td>
        <td><span class="status ${item.stockStatus === "In Stock" ? "good" : "warn"}">${item.stockStatus}</span></td><td>${item.status}</td>
        <td><div class="row-actions">
          <button class="mini-btn" data-view-product="${item.id}">View</button>
          <button class="mini-btn" data-edit-product="${item.id}">Edit</button>
          <button class="mini-btn" data-duplicate-product="${item.id}">Duplicate</button>
          <button class="mini-btn" data-toggle-product="${item.id}">${item.status === "Published" ? "Unpublish" : "Publish"}</button>
          <button class="mini-btn" data-delete-product="${item.id}">Delete</button>
        </div></td>
      </tr>`
    )
    .join("");
  $("[data-product-pagination]").innerHTML = `<button class="mini-btn" data-page-prev>Prev</button><span>${state.productPage} / ${totalPages}</span><button class="mini-btn" data-page-next>Next</button>`;
};

const objectToForm = (form, item) => {
  [...form.elements].forEach((field) => {
    if (!field.name) return;
    if (field.type === "checkbox") field.checked = Boolean(item[field.name]);
    else field.value = item[field.name] ?? "";
  });
};

const formToObject = (form) => {
  const data = Object.fromEntries(new FormData(form).entries());
  ["featured", "newArrival", "bestSeller", "visible", "enabled", "showOnHeader"].forEach((key) => {
    if (form.elements[key]) data[key] = form.elements[key].checked;
  });
  ["price", "offerPrice", "sortOrder"].forEach((key) => {
    if (data[key] !== undefined && data[key] !== "") data[key] = Number(data[key]);
  });
  return data;
};

const openProductForm = (product = null) => {
  state.editingProduct = product;
  const form = $("[data-product-form]");
  form.classList.remove("hidden");
  form.reset();
  form.elements.visible.checked = true;
  form.elements.priceMode.value = "show";
  $("[data-product-form-title]").textContent = product ? "Edit Product" : "Add Product";
  if (product) objectToForm(form, { ...product, featuredImage: product.featuredImage || product.image });
  renderImagePreviews();
};

const renderImagePreviews = () => {
  const form = $("[data-product-form]");
  const featured = form.elements.featuredImage.value;
  const gallery = state.editingProduct?.galleryImages || [];
  $("[data-featured-preview]").innerHTML = featured ? `<img src="${featured}" alt="">` : "";
  $("[data-gallery-preview]").innerHTML = gallery
    .map(
      (image, index) => `<div class="image-preview-item"><img src="${image}" alt=""><div class="image-preview-actions"><button type="button" data-gallery-up="${index}">Up</button><button type="button" data-gallery-down="${index}">Down</button><button type="button" data-gallery-delete="${index}">Delete</button></div></div>`
    )
    .join("");
};

const uploadFile = async (file, bucket = "product-images") => {
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
  const result = await api("uploads", { method: "POST", body: JSON.stringify({ name: file.name, dataUrl, bucket }) });
  return result.url;
};

const renderCategories = () => {
  $("[data-categories-table]").innerHTML = state.categories
    .map(
      (item) => `<tr><td>${item.name}</td><td>${item.slug}</td><td>${item.parent || "-"}</td><td>${item.visible ? "Visible" : "Hidden"}</td><td>${item.sortOrder || ""}</td>
      <td><div class="row-actions"><button class="mini-btn" data-edit-category="${item.id}">Edit</button><button class="mini-btn" data-delete-category="${item.id}">Delete</button></div></td></tr>`
    )
    .join("");
};

const openCategoryForm = (category = null) => {
  state.editingCategory = category;
  const form = $("[data-category-form]");
  form.classList.remove("hidden");
  form.reset();
  $("[data-category-form-title]").textContent = category ? "Edit Category" : "Add Category";
  if (category) objectToForm(form, category);
};

const renderGoldRates = () => {
  $("[data-gold-table]").innerHTML = state.goldRates
    .slice()
    .reverse()
    .map(
      (item) => `<tr><td>${item.rateDate || new Date(item.updatedAt).toLocaleDateString("en-IN")} ${item.rateTime || ""}</td><td>${item.rate24K}</td><td>${item.rate22K}</td><td>${item.rate22K8g}</td><td>${item.rate18K}</td><td>${item.silverRate || ""}</td><td>${item.updatedBy || ""}</td><td><button class="mini-btn" data-restore-rate="${item.id}">Restore This Rate</button></td></tr>`
    )
    .join("");
};

const renderEnquiries = () => {
  $("[data-enquiries-table]").innerHTML = state.enquiries
    .map(
      (item) => `<tr><td>${item.customerName || ""}<br>${item.email || ""}</td><td>${item.phone || ""}</td><td>${item.productName || ""}<br>${item.productCode || ""}</td><td>${new Date(item.date || item.createdAt).toLocaleString("en-IN")}</td><td>${item.status}</td><td><div class="row-actions"><button class="mini-btn" data-status-enquiry="${item.id}">Update</button><a class="mini-btn" href="https://wa.me/${item.phone || ""}" target="_blank">WhatsApp</a><button class="mini-btn" data-delete-enquiry="${item.id}">Delete</button></div></td></tr>`
    )
    .join("");
};

const renderSettings = () => objectToForm($("[data-settings-form]"), state.settings);

const renderUsers = () => {
  $("[data-users-table]").innerHTML = state.users.map((item) => `<tr><td>${item.name}</td><td>${item.username}</td><td>${item.role}</td></tr>`).join("");
};

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (event.target.matches("[data-login-form]")) {
      const data = await api("login", { method: "POST", body: JSON.stringify(formToObject(event.target)) });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("ponkudamAdminToken", state.token);
      localStorage.setItem("ponkudamAdminUser", JSON.stringify(state.user));
      showApp();
      await loadAll();
      toast("Logged in");
    }

    if (event.target.matches("[data-product-form]")) {
      const payload = formToObject(event.target);
      payload.galleryImages = state.editingProduct?.galleryImages?.length ? state.editingProduct.galleryImages : [payload.featuredImage];
      const id = state.editingProduct?.id;
      await api(id ? `products/${id}` : "products", { method: id ? "PUT" : "POST", body: JSON.stringify({ ...state.editingProduct, ...payload, id: id || `product-${Date.now()}` }) });
      event.target.classList.add("hidden");
      await loadAll();
      toast("Product saved");
    }

    if (event.target.matches("[data-category-form]")) {
      const payload = formToObject(event.target);
      payload.id = state.editingCategory?.id || payload.slug;
      payload.visible = payload.visible === true || payload.visible === "true";
      await api(state.editingCategory ? `categories/${state.editingCategory.id}` : "categories", { method: state.editingCategory ? "PUT" : "POST", body: JSON.stringify(payload) });
      event.target.classList.add("hidden");
      await loadAll();
      toast("Category saved");
    }

    if (event.target.matches("[data-gold-form]")) {
      await api("gold-rates", { method: "POST", body: JSON.stringify(formToObject(event.target)) });
      await loadAll();
      toast("Gold rate updated");
    }

    if (event.target.matches("[data-settings-form]")) {
      await api("settings", { method: "PUT", body: JSON.stringify(formToObject(event.target)) });
      await loadAll();
      toast("Settings saved");
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;
  try {
    if (target.dataset.section) {
      $$("[data-admin-nav] button").forEach((button) => button.classList.toggle("active", button === target));
      $$(".admin-section").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === target.dataset.section));
      $("[data-page-title]").textContent = target.textContent;
    }
    if (target.dataset.logout !== undefined) {
      await api("logout", { method: "POST", body: "{}" });
      localStorage.clear();
      showLogin();
    }
    if (target.dataset.newProduct !== undefined) openProductForm();
    if (target.dataset.cancelProduct !== undefined) $("[data-product-form]").classList.add("hidden");
    if (target.dataset.editProduct) openProductForm(state.products.find((item) => item.id === target.dataset.editProduct));
    if (target.dataset.viewProduct) window.open(`/product?id=${target.dataset.viewProduct}`, "_blank");
    if (target.dataset.duplicateProduct) {
      await api(`duplicate-product/${target.dataset.duplicateProduct}`, { method: "POST", body: "{}" });
      await loadAll();
      toast("Product duplicated");
    }
    if (target.dataset.toggleProduct) {
      const product = state.products.find((item) => item.id === target.dataset.toggleProduct);
      await api(`products/${product.id}`, { method: "PUT", body: JSON.stringify({ status: product.status === "Published" ? "Draft" : "Published" }) });
      await loadAll();
    }
    if (target.dataset.deleteProduct && confirm("Delete this product?")) {
      await api(`products/${target.dataset.deleteProduct}`, { method: "DELETE" });
      await loadAll();
    }
    if (target.dataset.pagePrev !== undefined) {
      state.productPage = Math.max(1, state.productPage - 1);
      renderProducts();
    }
    if (target.dataset.pageNext !== undefined) {
      state.productPage += 1;
      renderProducts();
    }
    if (target.dataset.newCategory !== undefined) openCategoryForm();
    if (target.dataset.cancelCategory !== undefined) $("[data-category-form]").classList.add("hidden");
    if (target.dataset.editCategory) openCategoryForm(state.categories.find((item) => item.id === target.dataset.editCategory));
    if (target.dataset.deleteCategory && confirm("Delete this category?")) {
      await api(`categories/${target.dataset.deleteCategory}`, { method: "DELETE" });
      await loadAll();
    }
    if (target.dataset.restoreRate) {
      const rate = state.goldRates.find((item) => item.id === target.dataset.restoreRate);
      await api("gold-rates", { method: "POST", body: JSON.stringify(rate) });
      await loadAll();
      toast("Rate restored");
    }
    if (target.dataset.statusEnquiry) {
      const enquiry = state.enquiries.find((item) => item.id === target.dataset.statusEnquiry);
      const next = enquiry.status === "New" ? "Contacted" : enquiry.status === "Contacted" ? "Closed" : "New";
      await api(`enquiries/${enquiry.id}`, { method: "PUT", body: JSON.stringify({ status: next }) });
      await loadAll();
    }
    if (target.dataset.deleteEnquiry && confirm("Delete this enquiry?")) {
      await api(`enquiries/${target.dataset.deleteEnquiry}`, { method: "DELETE" });
      await loadAll();
    }
    if (target.dataset.galleryDelete !== undefined) {
      state.editingProduct.galleryImages.splice(Number(target.dataset.galleryDelete), 1);
      renderImagePreviews();
    }
    if (target.dataset.galleryUp !== undefined) {
      const index = Number(target.dataset.galleryUp);
      if (index > 0) {
        const gallery = state.editingProduct.galleryImages;
        [gallery[index - 1], gallery[index]] = [gallery[index], gallery[index - 1]];
        renderImagePreviews();
      }
    }
    if (target.dataset.galleryDown !== undefined) {
      const index = Number(target.dataset.galleryDown);
      const gallery = state.editingProduct.galleryImages;
      if (index < gallery.length - 1) {
        [gallery[index + 1], gallery[index]] = [gallery[index], gallery[index + 1]];
        renderImagePreviews();
      }
    }
  } catch (error) {
    toast(error.message);
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-product-search], [data-product-filter]")) {
    state.productPage = 1;
    renderProducts();
  }
  if (event.target.name === "name" && event.target.closest("[data-product-form]")) {
    const form = event.target.form;
    if (!form.elements.slug.value) form.elements.slug.value = event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
});

$("[data-featured-upload]").addEventListener("change", async (event) => {
  if (!event.target.files[0]) return;
  const url = await uploadFile(event.target.files[0], "product-images");
  $("[data-product-form]").elements.featuredImage.value = url;
  renderImagePreviews();
});

$("[data-gallery-upload]").addEventListener("change", async (event) => {
  const urls = [];
  for (const file of event.target.files) urls.push(await uploadFile(file, "product-images"));
  state.editingProduct = { ...(state.editingProduct || {}), galleryImages: urls };
  renderImagePreviews();
});

if (state.token) {
  showApp();
  loadAll().catch((error) => {
    toast(error.message);
    showLogin();
  });
} else {
  showLogin();
}
