const categoryData = {
  bangles: {
    title: "Bangles",
    eyebrow: "Ponkudam Collections",
    copy: "Explore handcrafted bangles with traditional detail, polished finishes, and timeless celebration-ready design.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_58%20AM%20(4).webp",
    products: Array.from({ length: 8 }, (_, index) => ({
      name: `Heritage Gold Bangle ${String(index + 1).padStart(2, "0")}`,
      image: `images/bangles/webp/ponkudam_featured_product_${String(index + 1).padStart(2, "0")}_800x1000.webp`,
    })),
  },
  earrings: {
    title: "Earrings",
    eyebrow: "Ponkudam Collections",
    copy: "Discover statement earrings and graceful daily-wear styles crafted to frame every moment beautifully.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_58%20AM%20(3).webp",
    products: Array.from({ length: 8 }, (_, index) => ({
      name: `Diamond Drop Earrings ${String(index + 1).padStart(2, "0")}`,
      image: `images/earings/webp/ponkudam_pdf2_product_${String(index + 1).padStart(2, "0")}_800x1000.webp`,
    })),
  },
  necklaces: {
    title: "Necklaces",
    eyebrow: "Ponkudam Collections",
    copy: "A curated showcase of necklace designs for weddings, milestones, and refined everyday elegance.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_24_57%20AM%20(2).webp",
    products: Array.from({ length: 11 }, (_, index) => ({
      name: `Signature Necklace ${String(index + 1).padStart(2, "0")}`,
      image: `images/necklaces/webp/ponkudam_pdf3_product_${String(index + 1).padStart(2, "0")}_800x1000.webp`,
    })),
  },
  pendants: {
    title: "Pendants",
    eyebrow: "Ponkudam Collections",
    copy: "Elegant pendant sets and refined pieces designed for gifting, occasions, and signature styling.",
    heroImage: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(5).webp",
    products: Array.from({ length: 5 }, (_, index) => ({
      name: `Diamond Pendant ${String(index + 1).padStart(2, "0")}`,
      image: `images/pendants/webp/ponkudam_pdf4_product_${String(index + 1).padStart(2, "0")}_800x1000.webp`,
    })),
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
  grid.innerHTML = data.products
    .map(
      (product) => `
        <article class="product-card category-product-card">
          <button class="heart" type="button" aria-label="Add ${product.name} to wishlist"><i data-lucide="heart"></i></button>
          <img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async">
          <h3>${product.name}</h3>
          <button class="bag" type="button" aria-label="Enquire about ${product.name}"><i data-lucide="message-circle"></i></button>
        </article>
      `
    )
    .join("");

  document.querySelectorAll(".category-tabs a").forEach((link) => {
    const href = link.getAttribute("href");
    link.classList.toggle("active", href === `${currentCategory}.html`);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}
