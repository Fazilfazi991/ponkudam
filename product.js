const productId = new URLSearchParams(window.location.search).get("id");
const allProducts = [...(window.featuredProducts || []), ...(window.allStandardProducts || []), ...(window.diamondProducts || [])];
const detailMain = document.querySelector("[data-product-detail]");

const renderMissing = () => {
  document.title = "Product Not Found | Ponkudam Gold & Diamonds";
  detailMain.innerHTML = `
    <section class="product-empty">
      <p class="eyebrow">Ponkudam Collections</p>
      <h1>Product Not Found</h1>
      <p>This product page could not be found.</p>
      <a class="btn btn-primary" href="/#collections">Back to Collections</a>
    </section>
  `;
};

const loadSettings = async () =>
  fetch("/api/settings")
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => payload?.settings || {})
    .catch(() => ({}));

const renderProduct = async (product) => {
  if (!product) {
    renderMissing();
    return;
  }

  const image = product.featuredImage || product.image;
  const images = product.galleryImages?.length ? product.galleryImages : product.images?.length ? product.images : [image];

  document.title = `${product.name} | Ponkudam Gold & Diamonds`;
  document.querySelector("[data-product-type]").textContent = product.type || product.category || "Product";
  document.querySelector("[data-product-name]").textContent = product.name;
  document.querySelector("[data-product-price]").textContent = window.formatProductPrice(product);
  document.querySelector("[data-product-description]").textContent = product.fullDescription || product.description || product.shortDescription || "";

  const backHref = product.collectionHref || (product.category ? `/${product.category}` : "/diamond");
  const backLabel = product.collectionHref ? "Back to Featured" : product.category ? `Back to ${product.type || product.category}` : "Back to Diamond";
  document.querySelector("[data-product-back]").href = backHref;
  document.querySelector("[data-product-back]").lastChild.textContent = ` ${backLabel}`;
  document.querySelector("[data-product-more]").href = backHref;
  document.querySelector("[data-product-more]").textContent = product.category ? `View More ${product.type || product.category}` : "View More Diamonds";
  document.querySelector("[data-product-collection-label]").textContent = product.category ? `${product.type || product.category} Collection` : "Diamond Collection";

  const mainImage = document.querySelector("[data-product-main-image]");
  mainImage.src = image;
  mainImage.alt = product.name;

  const thumbs = document.querySelector("[data-product-thumbs]");
  thumbs.innerHTML = images
    .map(
      (item, index) => `
        <button class="${index === 0 ? "active" : ""}" type="button" aria-label="Show ${product.name} image ${index + 1}" data-thumb="${item}">
          <img src="${item}" alt="" loading="lazy" decoding="async">
        </button>
      `
    )
    .join("");

  thumbs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      mainImage.src = button.dataset.thumb;
      thumbs.querySelectorAll("button").forEach((thumb) => thumb.classList.remove("active"));
      button.classList.add("active");
    });
  });

  const settings = await loadSettings();
  const whatsapp = settings.whatsappNumber || "919876543210";
  const message = encodeURIComponent(`Hello Ponkudam, I am interested in this product:\n\nProduct Name: ${product.name}\nProduct Code: ${product.code || product.id}\nProduct Link: ${location.href}\nPrice: ${window.formatProductPrice(product)}`);
  document.querySelector("[data-product-whatsapp]").href = `https://wa.me/${whatsapp}?text=${message}`;
  document.querySelector("[data-product-enquiry]").addEventListener("click", async () => {
    const customerName = prompt("Your name");
    if (!customerName) return;
    const phone = prompt("Phone number") || "";
    const email = prompt("Email") || "";
    const messageText = prompt("Message") || "";
    await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        phone,
        email,
        message: messageText,
        productName: product.name,
        productCode: product.code || product.id,
        productLink: location.href,
      }),
    });
    alert("Enquiry sent.");
  });

  if (window.lucide) window.lucide.createIcons();
};

fetch(`/api/products/${encodeURIComponent(productId || "")}`)
  .then((response) => (response.ok ? response.json() : null))
  .then((payload) => renderProduct(payload?.product || allProducts.find((item) => item.id === productId)))
  .catch(() => renderProduct(allProducts.find((item) => item.id === productId)));
