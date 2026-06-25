const categoryData = {
  bangles: {
    title: "Bangles",
    eyebrow: "Ponkudam Collections",
    copy: "Explore handcrafted bangles with traditional detail, polished finishes, and timeless celebration-ready design.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_58%20AM%20(4).webp",
    products: window.standardProducts?.bangles || [],
  },
  earrings: {
    title: "Earrings",
    eyebrow: "Ponkudam Collections",
    copy: "Discover statement earrings and graceful daily-wear styles crafted to frame every moment beautifully.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_58%20AM%20(3).webp",
    products: window.standardProducts?.earrings || [],
  },
  necklaces: {
    title: "Necklaces",
    eyebrow: "Ponkudam Collections",
    copy: "A curated showcase of necklace designs for weddings, milestones, and refined everyday elegance.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_57%20AM%20(2).webp",
    products: window.standardProducts?.necklaces || [],
  },
  pendants: {
    title: "Pendants",
    eyebrow: "Ponkudam Collections",
    copy: "Elegant pendant sets and refined pieces designed for gifting, occasions, and signature styling.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(5).webp",
    products: window.standardProducts?.pendants || [],
  },
  diamond: {
    title: "Diamond",
    eyebrow: "Diamond Collection",
    copy: "Explore diamond bangles, bracelets, and pendants with individual product pages and clear pricing.",
    heroImage: "images/bangles/Diamond/bangle-47900/bangle-47900/bangle-47900-07-wearing-shot.png",
    products: window.diamondProducts || [],
  },
};

const currentCategory = document.body.dataset.category;
const data = categoryData[currentCategory];

if (data) {
  document.title = `${data.title} | Ponkudam Gold & Diamonds`;
  document.querySelector("[data-category-title]").textContent = data.title;
  document.querySelector("[data-category-eyebrow]").textContent = data.eyebrow;
  document.querySelector("[data-category-copy]").textContent = data.copy;

  const heroImage = document.querySelector("[data-category-hero-image]");
  heroImage.src = data.heroImage;
  heroImage.alt = `${data.title} collection`;

  const grid = document.querySelector("[data-category-grid]");
  const renderProducts = (products) => {
    grid.innerHTML = products
      .map((product) => {
        const productUrl = product.id ? `product.html?id=${encodeURIComponent(product.id)}` : "";
        const title = product.type ? `${product.type} / ${product.name}` : product.name;
        const image = product.featuredImage || product.image;
        const price = `<p>${window.formatProductPrice(product)}</p>`;
        const wishIcon = productUrl
          ? `<span class="heart" aria-hidden="true"><i data-lucide="heart"></i></span>`
          : `<button class="heart" type="button" aria-label="Add ${product.name} to wishlist"><i data-lucide="heart"></i></button>`;
        const cardContent = `
          ${wishIcon}
          <img src="${image}" alt="${product.name}" loading="lazy" decoding="async">
          <h3>${title}</h3>
          ${price}
        `;

        return productUrl
          ? `<a class="product-card category-product-card" href="${productUrl}">${cardContent}</a>`
          : `<article class="product-card category-product-card">${cardContent}</article>`;
      })
      .join("");
    if (window.lucide) window.lucide.createIcons();
  };

  renderProducts(data.products);

  fetch(`/api/public-products?category=${encodeURIComponent(currentCategory)}`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      if (payload?.ok && payload.products?.length) renderProducts(payload.products);
    })
    .catch(() => {});

  document.querySelectorAll(".category-tabs a").forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === `/${currentCategory}`);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
