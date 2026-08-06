const adminDestinations = [
  { href: "/admin/", label: "Overview" },
  { href: "/admin/stripe.html", label: "Payments" },
  { href: "/admin/gift-cards.html", label: "Gift Cards" },
  { href: "/admin/professionals.html", label: "Professionals" },
  { href: "/admin/competition.html", label: "Competition" },
  { href: "/admin/marketing.html", label: "Marketing" },
  { href: "https://bingodogwash.com/", label: "Public Site", external: true }
];

function normaliseAdminPath(pathname) {
  if (pathname === "/admin" || pathname === "/admin/index.html") return "/admin/";
  return pathname;
}

function initialiseAdminShell() {
  const nav = document.querySelector(".site-header .nav");
  const links = nav?.querySelector(".nav-links");
  const toggle = nav?.querySelector(".menu-toggle");
  if (!nav || !links) return;

  const currentPath = normaliseAdminPath(location.pathname);
  links.id = "admin-primary-navigation";
  links.setAttribute("aria-label", "Admin sections");
  links.replaceChildren(...adminDestinations.map((destination) => {
    const link = document.createElement("a");
    link.href = destination.href;
    link.textContent = destination.label;
    if (destination.external) {
      link.target = "_blank";
      link.rel = "noopener";
    } else if (currentPath === destination.href) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    return link;
  }));

  if (toggle) {
    toggle.setAttribute("aria-controls", links.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open admin navigation");
  }
}

initialiseAdminShell();
