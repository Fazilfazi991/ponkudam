const formatProductPrice = (product) => {
  if (product.priceMode === "contact") return "Contact for latest price";
  if (product.priceMode === "variable") return "Price may vary based on gold rate";
  if (product.price) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(product.price);
  }

  return product.priceLabel || "Price on request";
};

const createCategoryProducts = ({ category, count, imagePrefix, namePrefix, type, description }) =>
  Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const name = `${namePrefix} ${number}`;
    const image = imagePrefix(number);

    return {
      id: `${category}-${number}`,
      name,
      type,
      category,
      image,
      images: [image],
      priceLabel: "Price on request",
      description,
    };
  });

const standardProducts = {
  bangles: createCategoryProducts({
    category: "bangles",
    count: 8,
    imagePrefix: (number) => `images/bangles/webp/ponkudam_featured_product_${number}_800x1000.webp`,
    namePrefix: "Heritage Gold Bangle",
    type: "Bangles",
    description: "A handcrafted bangle from Ponkudam's gold collection, designed with traditional detailing and polished occasion-ready finishing.",
  }),
  earrings: createCategoryProducts({
    category: "earrings",
    count: 8,
    imagePrefix: (number) => `images/earings/webp/ponkudam_pdf2_product_${number}_800x1000.webp`,
    namePrefix: "Diamond Drop Earrings",
    type: "Earrings",
    description: "A graceful earring design made to frame the face with refined shine for celebrations, gifting, and daily elegance.",
  }),
  necklaces: createCategoryProducts({
    category: "necklaces",
    count: 11,
    imagePrefix: (number) => `images/necklaces/webp/ponkudam_pdf3_product_${number}_800x1000.webp`,
    namePrefix: "Signature Necklace",
    type: "Necklaces",
    description: "A signature necklace design from Ponkudam, crafted for weddings, milestones, and refined statement styling.",
  }),
  pendants: createCategoryProducts({
    category: "pendants",
    count: 5,
    imagePrefix: (number) => `images/pendants/webp/ponkudam_pdf4_product_${number}_800x1000.webp`,
    namePrefix: "Diamond Pendant",
    type: "Pendants",
    description: "An elegant pendant design suited for gifting, personal styling, and graceful occasion wear.",
  }),
};

const featuredProducts = [
  {
    id: "featured-heritage-emerald-temple-necklace",
    name: "Heritage Emerald Temple Necklace",
    type: "Necklaces",
    category: "necklaces",
    price: 345000,
    image: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(1).webp",
    images: ["images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(1).webp"],
    description: "A statement emerald temple necklace with rich gold detailing, crafted for bridal styling and grand celebrations.",
  },
  {
    id: "featured-diamond-floral-drop-earrings",
    name: "Diamond Floral Drop Earrings",
    type: "Earrings",
    category: "earrings",
    price: 128000,
    image: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(2).webp",
    images: ["images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_09%20AM%20(2).webp"],
    description: "A floral drop earring design with diamond-inspired brilliance and a graceful occasion-ready profile.",
  },
  {
    id: "featured-classic-filigree-gold-bangle",
    name: "Classic Filigree Gold Bangle",
    type: "Bangles",
    category: "bangles",
    price: 98500,
    image: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(3).webp",
    images: ["images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(3).webp"],
    description: "A classic filigree gold bangle with intricate detailing and a refined festive finish.",
  },
  {
    id: "featured-solitaire-diamond-engagement-ring",
    name: "Solitaire Diamond Engagement Ring",
    type: "Rings",
    collectionHref: "/#featured",
    price: 135000,
    image: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(4).webp",
    images: ["images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(4).webp"],
    description: "A solitaire diamond engagement ring with a clean gold band and timeless centre-stone styling.",
  },
  {
    id: "featured-peacock-diamond-pendant-set",
    name: "Peacock Diamond Pendant Set",
    type: "Pendants",
    category: "pendants",
    price: 162000,
    image: "images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(5).webp",
    images: ["images/ChatGPT%20Image%20Jun%2014,%202026,%2006_33_10%20AM%20(5).webp"],
    description: "A peacock-inspired diamond pendant set with ornate gold detail, made for elegant gifting and celebrations.",
  },
];

window.standardProducts = standardProducts;
window.allStandardProducts = Object.values(standardProducts).flat();
window.featuredProducts = featuredProducts;
window.formatProductPrice = formatProductPrice;
