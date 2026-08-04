const target = document.body.dataset.adminRedirect;

if (target && target.startsWith("/admin/")) {
  window.location.replace(`${target}${window.location.search}${window.location.hash}`);
}
