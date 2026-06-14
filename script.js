const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");
const desktopSlider = document.querySelector(".desktop-hero-slider");
const mobileSlider = document.querySelector(".mobile-hero-slider");

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
