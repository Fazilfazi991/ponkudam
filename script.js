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
  let currentSlide = 0;
  let sliderTimer;

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
    sliderTimer = window.setInterval(() => {
      showSlide(currentSlide + 1);
    }, 5000);
  };

  dots.forEach((dot, dotIndex) => {
    dot.addEventListener("click", () => {
      window.clearInterval(sliderTimer);
      showSlide(dotIndex);
      startSlider();
    });
  });

  startSlider();
}
