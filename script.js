const menuToggle = document.querySelector(".menu-toggle");
const navMenu = document.querySelector(".nav-menu");
const desktopSlider = document.querySelector(".desktop-hero-slider");

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

if (desktopSlider) {
  const slides = [...desktopSlider.querySelectorAll(".hero-slide")];
  const dots = [...desktopSlider.querySelectorAll(".hero-dots button")];
  const ctas = [...desktopSlider.querySelectorAll(".hero-slide-cta")];
  const desktopSliderQuery = window.matchMedia("(min-width: 761px)");
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
    if (sliderLoaded || !desktopSliderQuery.matches) return;
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
      if (desktopSliderQuery.matches) startSlider();
    });
  });

  loadDesktopSlider();

  desktopSliderQuery.addEventListener("change", (event) => {
    if (event.matches) {
      loadDesktopSlider();
      startSlider();
    } else {
      stopSlider();
    }
  });
}
