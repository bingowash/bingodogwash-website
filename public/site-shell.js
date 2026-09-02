(() => {
  const toggle = document.querySelector(".menu-toggle");
  const links = document.querySelector(".nav-links");

  document.querySelectorAll('.nav-links a[href="dog-walker-club.html"]').forEach((link) => {
    link.textContent = "Dog Walker Directory";
  });

  if (!location.pathname.startsWith("/admin")) {
    document.querySelectorAll(".nav-links").forEach((nav) => {
      if (nav.querySelector('a[href*="top-dog-competition"]')) return;
      const link = document.createElement("a");
      link.href = "/top-dog-competition.html";
      link.textContent = "Top Dog Competition";
      const account = [...nav.querySelectorAll("a")].find((item) => /account/i.test(item.textContent));
      nav.insertBefore(link, account || null);
    });
  }

  if (toggle && links) {
    if (!links.id) links.id = "primary-navigation";
    toggle.setAttribute("aria-controls", links.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Toggle navigation");

    const closeMenu = () => {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    };

    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    links.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && links.classList.contains("open")) {
        closeMenu();
        toggle.focus();
      }
    });
  }

  const path = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === path) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  let basket = [];
  try {
    const storedBasket = JSON.parse(localStorage.getItem("bingoBasket") || "[]");
    if (Array.isArray(storedBasket)) basket = storedBasket;
  } catch {
    basket = [];
  }

  document.querySelectorAll("[data-basket-count]").forEach((element) => {
    element.textContent = String(basket.length);
  });
})();
