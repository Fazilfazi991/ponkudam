const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");
const desktopSlider = document.querySelector(".desktop-hero-slider");
const mobileSlider = document.querySelector(".mobile-hero-slider");
const goldRateTexts = [...document.querySelectorAll("[data-gold-rate-text]")];
const manualGoldRateHtml =
  "&#10024; <strong>Gold Rate India:</strong> 24K &#8377;14,002/gm | 22K &#8377;13,666/gm | 22K 8g &#8377;1,09,328 | 18K &#8377;11,342/gm &#10024; <small>Updated Jun 25, 2026</small>";

if (window.lucide) {
  window.lucide.createIcons();
}

menuToggle?.addEventListener("click", () => {
  const isOpen = navMenu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
});

navMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open menu");
  });
});

const setGoldRateText = (html) => {
  goldRateTexts.forEach((element) => {
    element.innerHTML = html;
  });
};

setGoldRateText(manualGoldRateHtml);

const loadGoldRateMarquee = async () => {
  if (!goldRateTexts.length) return;
  try {
    const response = await fetch("/api/gold-rate");
    const payload = response.ok ? await response.json() : null;
    if (!payload?.ok || !payload.display) return;

    if (payload.display.englishMessage || payload.display.malayalamMessage) {
      setGoldRateText(`&#10024; <strong>Gold Rate:</strong> ${payload.display.englishMessage || payload.display.malayalamMessage} &#10024;`);
      return;
    }

    setGoldRateText(
      `&#10024; <strong>Gold Rate India:</strong> 24K &#8377;${payload.display.rate24K}/gm | 22K &#8377;${payload.display.rate22K}/gm | 22K 8g &#8377;${payload.display.rate22K8g}/gm | 18K &#8377;${payload.display.rate18K}/gm &#10024;`
    );
  } catch {
    setGoldRateText(manualGoldRateHtml);
  }
};

loadGoldRateMarquee();

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const revealTargets = [
  ".trust-item",
  ".section-head",
  ".collection-card",
  ".product-card",
  ".promo-banner",
  ".custom-panel",
  ".stats-strip",
  ".testimonial-card",
  ".showroom-banner",
  ".gallery-strip img",
  ".footer-grid > *",
];

if (!reducedMotion && "IntersectionObserver" in window) {
  document.body.classList.add("motion-ready");

  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -40px" }
  );

  revealTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.classList.add("reveal");
      element.style.setProperty("--reveal-delay", `${Math.min(index % 7, 6) * 55}ms`);
      revealObserver.observe(element);
    });
  });
}

const formatStatValue = (value, suffix) => {
  if (suffix === "%") return `${value}%`;
  return `${new Intl.NumberFormat("en-IN").format(value)}${suffix}`;
};

const animateStat = (stat) => {
  const original = stat.textContent.trim();
  const suffix = original.includes("%") ? "%" : original.includes("+") ? "+" : "";
  const target = Number(original.replace(/[^\d]/g, ""));
  if (!target) return;

  const duration = 1200;
  const start = performance.now();

  const tick = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    stat.textContent = formatStatValue(Math.round(target * eased), suffix);
    if (progress < 1) window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
};

if (!reducedMotion && "IntersectionObserver" in window) {
  const statsObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.querySelectorAll("strong").forEach(animateStat);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.45 }
  );

  document.querySelectorAll(".stats-strip").forEach((strip) => statsObserver.observe(strip));
}

const setupHeroSlider = ({ slider, slideSelector, ctaSelector, mediaQuery }) => {
  if (!slider) return;

  const slides = [...slider.querySelectorAll(slideSelector)];
  const dots = [...slider.querySelectorAll(".hero-dots button")];
  const ctas = [...slider.querySelectorAll(ctaSelector)];
  const sliderQuery = window.matchMedia(mediaQuery);
  let currentSlide = 0;
  let sliderTimer;
  let sliderLoaded = false;

  const showSlide = (index) => {
    currentSlide = (index + slides.length) % slides.length;

    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("active", slideIndex === currentSlide);
    });

    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === currentSlide);
    });

    ctas.forEach((cta, ctaIndex) => {
      cta.classList.toggle("active", ctaIndex === currentSlide);
    });
  };

  const startSlider = () => {
    if (sliderTimer) return;
    sliderTimer = window.setInterval(() => {
      showSlide(currentSlide + 1);
    }, 5000);
  };

  const stopSlider = () => {
    window.clearInterval(sliderTimer);
    sliderTimer = undefined;
  };

  const loadDesktopSlider = () => {
    if (sliderLoaded || !sliderQuery.matches) return;
    slides.forEach((slide) => {
      if (slide.dataset.src) {
        slide.loading = "eager";
        slide.src = slide.dataset.src;
      }
    });
    sliderLoaded = true;
    startSlider();
  };

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      stopSlider();
      showSlide(dotIndex);
      loadDesktopSlider();
      if (sliderQuery.matches) startSlider();
    });
  });

  loadDesktopSlider();

  sliderQuery.addEventListener("change", (event) => {
    if (event.matches) {
      loadDesktopSlider();
      startSlider();
    } else {
      stopSlider();
    }
  });
};

setupHeroSlider({
  slider: desktopSlider,
  slideSelector: ".hero-slide",
  ctaSelector: ".hero-slide-cta",
  mediaQuery: "(min-width: 761px)",
});

setupHeroSlider({
  slider: mobileSlider,
  slideSelector: ".mobile-hero-slide",
  ctaSelector: ".mobile-slide-cta",
  mediaQuery: "(max-width: 760px)",
});
